import { useEffect, useRef, useCallback } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { ServerMessage, Message, FullAnalysis } from '../types';

// Use current host for WebSocket to leverage Vite proxy
const getWsUrl = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
};

// Analysis resolver type for Promise-based requestAnalysis
interface AnalysisResolver {
  resolve: (data: FullAnalysis) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const analysisResolverRef = useRef<AnalysisResolver | null>(null);

  const {
    sessionId,
    setConnected,
    addMessage,
    updateMetrics,
    setPipelineState,
    setCurrentTranscript,
    setError,
    setAnalysisData,
    setAnalysisComplete,
    setMinInteractionsReached,
    // Kept on the store but no longer auto-fired from message count — see 'response' handler.
    setFabReport,
    setCompanyResearch,
    setProgress,
  } = useSessionStore();

  // Initialize audio context - resume if suspended (needed for mobile)
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    // Resume if suspended (required by mobile browsers after user gesture)
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  // Play audio from queue
  const playNextAudio = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;

    const audioContext = initAudioContext();
    isPlayingRef.current = true;

    const buffer = audioQueueRef.current.shift()!;
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    currentSourceRef.current = source;

    source.onended = () => {
      currentSourceRef.current = null;
      isPlayingRef.current = false;
      playNextAudio();
    };

    source.start();
  }, [initAudioContext]);

  // Handle incoming audio
  const handleAudio = useCallback(async (base64Audio: string) => {
    try {
      const audioContext = initAudioContext();
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const audioBuffer = await audioContext.decodeAudioData(bytes.buffer);
      audioQueueRef.current.push(audioBuffer);
      playNextAudio();
    } catch (error) {
      console.error('Audio decode error:', error);
    }
  }, [initAudioContext, playNextAudio]);

  // Stop audio playback
  const stopAudio = useCallback(() => {
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
      } catch {
        // Already stopped
      }
      currentSourceRef.current = null;
    }
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!sessionId || wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(`${getWsUrl()}/ws/chat/${sessionId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const message: ServerMessage = JSON.parse(event.data);

        switch (message.type) {
          case 'connected':
            console.log('Session connected:', message.sessionId);
            break;

          case 'state':
            setPipelineState(message.state);
            break;

          case 'transcription':
            if (message.final) {
              const userMessage: Message = {
                id: `user-${Date.now()}`,
                role: 'user',
                content: message.text,
                timestamp: new Date(),
                inputType: 'voice',
              };
              addMessage(userMessage);
              setCurrentTranscript('');
            } else {
              setCurrentTranscript(message.text);
            }
            break;

          case 'response':
            const assistantMessage: Message = {
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              content: message.text,
              timestamp: new Date(),
            };
            addMessage(assistantMessage);
            // NOTE: Do NOT auto-trigger `analyze` here. In the FAB onboarding flow,
            // the report is emitted by the backend pipeline ONLY after all 8 questions
            // have real answers (or Q9 was triggered/skipped via shouldSkipOptional).
            // The legacy "≥4 messages → analyze" trigger from AllysAI was responsible
            // for the "report appears after typing 'hi'" bug. Leave the analyze plumbing
            // in place for explicit user-triggered requests via requestAnalysis(), but
            // do not fire it automatically based on message count.
            break;

          case 'audio':
            if (useSessionStore.getState().isVoiceModeActive) {
              handleAudio(message.data);
            }
            break;

          case 'metrics':
            updateMetrics(message.data);
            break;

          case 'analysis_complete':
            // Store the analysis data
            setAnalysisData(message.data);
            setAnalysisComplete(true, useSessionStore.getState().messages.length);
            setMinInteractionsReached(true);
            // Sync metrics with analysis data for consistency between sidebar and PDF
            updateMetrics({
              readiness: message.data.readinessScore,
              fit: message.data.fitScore,
              roi: message.data.roiEstimate,
              efficiency: message.data.efficiencyEstimate,
              keyObservations: message.data.keyObservations,
              recommendations: message.data.recommendations,
              enterpriseMetrics: message.data.enterpriseMetrics,
              executiveSummary: message.data.executiveSummary,
              industryContext: message.data.industryContext,
              nextSteps: message.data.nextSteps,
            });
            // Resolve pending analysis promise
            if (analysisResolverRef.current) {
              clearTimeout(analysisResolverRef.current.timeoutId);
              analysisResolverRef.current.resolve(message.data);
              analysisResolverRef.current = null;
            }
            break;

          case 'analysis_error':
            // Reject pending analysis promise
            if (analysisResolverRef.current) {
              clearTimeout(analysisResolverRef.current.timeoutId);
              analysisResolverRef.current.reject(new Error(message.message));
              analysisResolverRef.current = null;
            }
            setError(message.message);
            break;

          case 'interrupted':
            stopAudio();
            setPipelineState('listening');
            break;

          case 'error':
            setError(message.message);
            break;

          // FAB SME onboarding WS messages
          case 'report':
            setFabReport(message.data);
            break;

          case 'progress':
            setProgress(
              message.data.currentQuestionIndex,
              message.data.totalQuestions
            );
            break;

          case 'research':
            setCompanyResearch(message.data);
            break;
        }
      } catch (error) {
        console.error('Message parse error:', error);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setConnected(false);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('Connection error');
    };
  }, [sessionId, setConnected, addMessage, updateMetrics, setPipelineState, setCurrentTranscript, setError, setAnalysisData, setAnalysisComplete, setMinInteractionsReached, setFabReport, setCompanyResearch, setProgress, handleAudio, stopAudio]);

  // Disconnect
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    stopAudio();
  }, [stopAudio]);

  // Send text message
  const sendText = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: new Date(),
        inputType: 'text',
      };
      addMessage(userMessage);
      wsRef.current.send(JSON.stringify({ type: 'text', data: text }));
    }
  }, [addMessage]);

  // Send audio chunk
  const sendAudio = useCallback((audioData: ArrayBuffer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(audioData);
    }
  }, []);

  // Send control message
  const sendControl = useCallback((action: 'start' | 'stop' | 'stop_speaking') => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'control', action }));
    }
  }, []);

  // Request analysis - returns Promise that resolves when analysis completes
  const requestAnalysis = useCallback((timeoutMs = 30000): Promise<FullAnalysis> => {
    return new Promise((resolve, reject) => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      // Clear any existing resolver
      if (analysisResolverRef.current) {
        clearTimeout(analysisResolverRef.current.timeoutId);
        analysisResolverRef.current.reject(new Error('Analysis superseded'));
      }

      // Set up timeout
      const timeoutId = setTimeout(() => {
        if (analysisResolverRef.current) {
          analysisResolverRef.current.reject(new Error('Analysis timed out'));
          analysisResolverRef.current = null;
        }
      }, timeoutMs);

      analysisResolverRef.current = { resolve, reject, timeoutId };
      wsRef.current.send(JSON.stringify({ type: 'analyze' }));
    });
  }, []);

  // Auto-connect when sessionId changes
  useEffect(() => {
    if (sessionId) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [sessionId, connect, disconnect]);

  return {
    connect,
    disconnect,
    sendText,
    sendAudio,
    sendControl,
    requestAnalysis,
    stopAudio,
  };
}
