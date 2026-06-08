import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { getPipelineService, removePipelineService } from '../services/pipeline.service.js';
import { getSession, getLeadBySession } from '../services/database.service.js';
import { ServerMessage } from '../types/index.js';

export function setupWebSocket(wss: WebSocketServer): void {
  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    const sessionId = extractSessionId(req.url);

    if (!sessionId) {
      ws.close(4000, 'Session ID required');
      return;
    }

    // Verify session exists
    const session = getSession(sessionId);
    if (!session) {
      ws.close(4001, 'Session not found');
      return;
    }

    console.log(`WebSocket connected for session: ${sessionId}`);

    const pipeline = getPipelineService(sessionId);

    // Send connection confirmation
    sendMessage(ws, { type: 'connected', sessionId });

    // Subscribe to pipeline events
    pipeline.on('state', (state) => {
      sendMessage(ws, { type: 'state', state });
    });

    pipeline.on('transcription', (text, final) => {
      sendMessage(ws, { type: 'transcription', text, final });
    });

    pipeline.on('response', (text, processingTime) => {
      sendMessage(ws, { type: 'response', text, processingTime });
    });

    pipeline.on('audio', (data) => {
      sendMessage(ws, { type: 'audio', data });
    });

    pipeline.on('metrics', (data) => {
      sendMessage(ws, { type: 'metrics', data });
    });

    pipeline.on('interrupted', () => {
      sendMessage(ws, { type: 'interrupted' });
    });

    pipeline.on('error', (message) => {
      sendMessage(ws, { type: 'error', message });
    });

    // FAB onboarding events
    pipeline.on('progress', (data) => {
      sendMessage(ws, { type: 'progress', data } as any);
    });

    pipeline.on('research', (data) => {
      sendMessage(ws, { type: 'research', data } as any);
    });

    pipeline.on('report', (data) => {
      // Attach the canonical lead + fabAnswers so the frontend has the
      // company name / owner name without needing a separate fetch. The
      // backend backfilled these in SQL when Q1/Q2 were captured.
      const lead = getLeadBySession(sessionId);
      const enriched = {
        ...data,
        companyName: lead?.fabAnswers?.companyName || lead?.company || undefined,
        userName: lead?.fabAnswers?.name || lead?.name || undefined,
        fabAnswers: lead?.fabAnswers,
      };
      sendMessage(ws, { type: 'report', data: enriched } as any);
    });

    pipeline.on('speechStarted', () => {
      // Optionally notify frontend that speech was detected
    });

    // IMPORTANT: Set up message handler BEFORE initialize so we don't miss messages
    // Handle incoming messages
    ws.on('message', async (data, isBinary) => {
      try {
        // Try to parse as JSON first for text messages
        const str = data.toString();
        let isJsonMessage = false;
        try {
          if (str.startsWith('{')) {
            JSON.parse(str);
            isJsonMessage = true;
          }
        } catch {}

        if (!isJsonMessage && (isBinary || Buffer.isBuffer(data))) {
          // Binary audio data
          const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
          pipeline.processAudioChunk(buffer);
        } else {
          // JSON control message
          const message = JSON.parse(str);

          switch (message.type) {
            case 'text':
              await pipeline.processText(message.data, 'text');
              break;

            case 'control':
              if (message.action === 'start') {
                pipeline.startRecording();
              } else if (message.action === 'stop') {
                pipeline.stopRecording();
              } else if (message.action === 'stop_speaking') {
                pipeline.interrupt();
              }
              break;

            case 'analyze':
              try {
                const report = await pipeline.analyze();
                sendMessage(ws, { type: 'report', data: report } as any);
              } catch (error) {
                sendMessage(ws, { type: 'analysis_error', message: 'Analysis failed' });
              }
              break;

            default:
              console.warn('Unknown message type:', message.type);
          }
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    });

    // Handle disconnect
    ws.on('close', () => {
      console.log(`WebSocket disconnected for session: ${sessionId}`);
      removePipelineService(sessionId);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error(`WebSocket error for session ${sessionId}:`, error);
    });

    // Initialize pipeline AFTER all event handlers are set up
    // This way messages sent during greeting generation are queued and processed
    try {
      await pipeline.initialize();
    } catch (error) {
      console.error('Pipeline initialization failed:', error);
      sendMessage(ws, { type: 'error', message: 'Failed to initialize session' });
    }
  });
}

function extractSessionId(url: string | undefined): string | null {
  if (!url) return null;

  // URL format: /ws/chat/:sessionId or /ws/chat?sessionId=xxx
  const pathMatch = url.match(/\/ws\/chat\/([a-zA-Z0-9-]+)/);
  if (pathMatch) return pathMatch[1];

  // Also support query parameter
  const urlObj = new URL(url, 'http://localhost');
  return urlObj.searchParams.get('sessionId');
}

function sendMessage(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}
