import { useState, useRef, useCallback, useEffect } from 'react';

interface UseMicrophoneOptions {
  onAudioData?: (data: ArrayBuffer) => void;
  onError?: (error: Error) => void;
}

export function useMicrophone(options: UseMicrophoneOptions = {}) {
  const [isActive, setIsActive] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // Use refs to avoid stale closures
  const isActiveRef = useRef(false);
  const optionsRef = useRef(options);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Keep refs in sync
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // Convert Float32 to Int16 PCM
  const convertFloat32ToInt16 = useCallback((float32Array: Float32Array): Int16Array => {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16Array;
  }, []);

  // Start continuous voice mode
  const startVoiceMode = useCallback(async () => {
    if (isActiveRef.current) return;

    try {
      console.log('[Mic] Starting voice mode...');

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      console.log('[Mic] Got media stream');
      streamRef.current = stream;
      setHasPermission(true);

      // Create audio context - handle mobile browsers that require resume
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      const audioContext = audioContextRef.current;

      // Resume AudioContext if suspended (mobile Safari requires user gesture)
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      // Create source from stream
      sourceRef.current = audioContext.createMediaStreamSource(stream);

      // Create processor node (4096 samples = ~256ms at 16kHz)
      processorRef.current = audioContext.createScriptProcessor(4096, 1, 1);

      processorRef.current.onaudioprocess = (event) => {
        if (!isActiveRef.current) return;

        const inputData = event.inputBuffer.getChannelData(0);
        const int16Data = convertFloat32ToInt16(inputData);

        if (optionsRef.current.onAudioData) {
          optionsRef.current.onAudioData(int16Data.buffer as ArrayBuffer);
        }
      };

      // Connect nodes
      sourceRef.current.connect(processorRef.current);
      processorRef.current.connect(audioContext.destination);

      // Set active state
      isActiveRef.current = true;
      setIsActive(true);

      console.log('[Mic] Voice mode started - streaming continuously');
    } catch (error) {
      console.error('[Mic] Error starting voice mode:', error);
      setHasPermission(false);
      if (optionsRef.current.onError) {
        optionsRef.current.onError(error as Error);
      }
    }
  }, [convertFloat32ToInt16]);

  // Stop voice mode
  const stopVoiceMode = useCallback(() => {
    console.log('[Mic] Stopping voice mode...');

    isActiveRef.current = false;
    setIsActive(false);

    // Disconnect processor
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    // Disconnect source
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    console.log('[Mic] Voice mode stopped');
  }, []);

  // Toggle voice mode
  const toggleVoiceMode = useCallback(() => {
    if (isActiveRef.current) {
      stopVoiceMode();
    } else {
      startVoiceMode();
    }
  }, [startVoiceMode, stopVoiceMode]);

  // Check permission
  const checkPermission = useCallback(async () => {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      setHasPermission(result.state === 'granted');
      return result.state === 'granted';
    } catch {
      return null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isActiveRef.current) {
        stopVoiceMode();
      }
    };
  }, [stopVoiceMode]);

  return {
    isActive,
    hasPermission,
    startVoiceMode,
    stopVoiceMode,
    toggleVoiceMode,
    checkPermission,
  };
}
