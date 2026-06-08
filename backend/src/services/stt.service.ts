import { EventEmitter } from 'events';
import OpenAI from 'openai';
import { config } from '../config/env.js';
import { TranscriptResult, VADConfig } from '../types/index.js';

// STT uses Whisper which requires direct OpenAI (not available on OpenRouter).
// If OpenAI key has no credits, voice input will be unavailable — text mode still works.
const openai = new OpenAI({ apiKey: config.openaiApiKey });

// Optimized VAD Configuration - Tuned for mobile environments
const VAD_CONFIG: VADConfig = {
  noiseFloorPercentile: 20,        // Lower percentile for better noise estimation on mobile
  voiceThresholdMultiplier: 1.5,   // Lower = more sensitive (was 2.0)
  consecutiveVoiceFrames: 2,       // Fast speech detection
  silenceTimeoutMs: 1000,          // More tolerant of natural pauses (was 600ms)
  preBufferFrames: 8,              // More pre-buffer to capture speech onset on mobile
  minAudioLengthMs: 250,           // Accept shorter utterances (was 350ms)
  sampleRate: 16000,
  chunkSize: 4096,
};

// Max buffer duration in ms — auto-finalize after this to prevent unbounded memory growth
const MAX_BUFFER_DURATION_MS = 60000; // 60 seconds

// Only filter very short echo artifacts - not legitimate user responses
const ECHO_PHRASES = [
  'thank you for watching',
  'thanks for watching',
  'please subscribe',
  'like and subscribe',
];

export class STTService extends EventEmitter {
  private audioBuffer: Buffer[] = [];
  private bufferByteSize = 0;
  private preBuffer: Buffer[] = [];
  private noiseFloorSamples: number[] = [];
  private consecutiveVoiceFrames = 0;
  private consecutiveSilenceFrames = 0;
  private isSpeaking = false;
  private silenceTimer: NodeJS.Timeout | null = null;
  private isTranscribing = false;
  private chunkCount = 0;
  private lastTranscriptTime = 0;

  // Echo cancellation state
  private isTTSPlaying = false;
  private ttsEndTime = 0;
  private echoCooldownMs = 400; // Reduced from 800ms for faster response after TTS ends

  constructor() {
    super();
  }

  // Call this when TTS starts playing
  setTTSPlaying(playing: boolean): void {
    this.isTTSPlaying = playing;
    if (!playing) {
      this.ttsEndTime = Date.now();
      console.log('[STT] TTS ended, starting echo cooldown');
    } else {
      console.log('[STT] TTS started, ignoring microphone input');
    }
    // Reset speech detection when TTS state changes
    this.reset();
  }

  processAudioChunk(chunk: Buffer): void {
    this.chunkCount++;

    // ECHO CANCELLATION: Ignore audio while TTS is playing or during cooldown
    if (this.isTTSPlaying) {
      return;
    }

    // Cooldown period after TTS ends to avoid echo
    const timeSinceTTS = Date.now() - this.ttsEndTime;
    if (this.ttsEndTime > 0 && timeSinceTTS < this.echoCooldownMs) {
      return;
    }

    // Don't process if currently transcribing
    if (this.isTranscribing) return;

    const rms = this.calculateRMS(chunk);
    this.updateNoiseFloor(rms);

    const isVoice = this.detectVoice(rms);

    // Manage pre-buffer
    this.preBuffer.push(chunk);
    if (this.preBuffer.length > VAD_CONFIG.preBufferFrames) {
      this.preBuffer.shift();
    }

    if (isVoice) {
      this.consecutiveVoiceFrames++;
      this.consecutiveSilenceFrames = 0;

      if (!this.isSpeaking && this.consecutiveVoiceFrames >= VAD_CONFIG.consecutiveVoiceFrames) {
        this.isSpeaking = true;
        this.audioBuffer = [...this.preBuffer];
        this.bufferByteSize = this.preBuffer.reduce((sum, b) => sum + b.length, 0);
        console.log('[STT] Speech detected - listening...');
        this.emit('speechStarted');
      }

      if (this.isSpeaking) {
        this.audioBuffer.push(chunk);
        this.bufferByteSize += chunk.length;
        this.resetSilenceTimer();

        // Auto-finalize if buffer exceeds max duration (prevents unbounded memory growth)
        const currentDurationMs = (this.bufferByteSize / 2 / VAD_CONFIG.sampleRate) * 1000;
        if (currentDurationMs >= MAX_BUFFER_DURATION_MS) {
          console.log(`[STT] Max buffer duration reached (${(currentDurationMs / 1000).toFixed(0)}s), auto-finalizing`);
          this.finalizeSpeech();
          return;
        }
      }
    } else {
      this.consecutiveVoiceFrames = 0;
      this.consecutiveSilenceFrames++;

      if (this.isSpeaking) {
        this.audioBuffer.push(chunk);
        this.bufferByteSize += chunk.length;
        this.startSilenceTimer();
      }
    }

    // Periodic logging (less frequent)
    if (this.chunkCount % 200 === 0) {
      const threshold = this.getNoiseFloor() * VAD_CONFIG.voiceThresholdMultiplier;
      const status = this.isSpeaking ? 'SPEAKING' : (this.isTTSPlaying ? 'TTS_PLAYING' : 'silent');
      console.log(`[STT] #${this.chunkCount} RMS:${rms.toFixed(0)} Thresh:${threshold.toFixed(0)} ${status}`);
    }
  }

  private calculateRMS(chunk: Buffer): number {
    const samples = new Int16Array(chunk.buffer, chunk.byteOffset, chunk.length / 2);
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }
    return Math.sqrt(sum / samples.length);
  }

  private updateNoiseFloor(rms: number): void {
    if (!this.isSpeaking) {
      this.noiseFloorSamples.push(rms);
      if (this.noiseFloorSamples.length > 200) {
        this.noiseFloorSamples.shift();
      }
    }
  }

  private getNoiseFloor(): number {
    if (this.noiseFloorSamples.length < 10) return 300; // Lower default for more sensitivity
    const sorted = [...this.noiseFloorSamples].sort((a, b) => a - b);
    const idx = Math.floor(sorted.length * (VAD_CONFIG.noiseFloorPercentile / 100));
    return Math.max(sorted[idx] || 300, 150); // Lower minimum noise floor for mobile sensitivity
  }

  private detectVoice(rms: number): boolean {
    const threshold = this.getNoiseFloor() * VAD_CONFIG.voiceThresholdMultiplier;
    return rms > threshold;
  }

  private startSilenceTimer(): void {
    if (this.silenceTimer) return;

    this.silenceTimer = setTimeout(() => {
      this.finalizeSpeech();
    }, VAD_CONFIG.silenceTimeoutMs);
  }

  private resetSilenceTimer(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  private async finalizeSpeech(): Promise<void> {
    this.resetSilenceTimer();

    if (!this.isSpeaking || this.audioBuffer.length === 0) {
      this.reset();
      return;
    }

    const audioData = Buffer.concat(this.audioBuffer);
    const durationMs = (audioData.length / 2 / VAD_CONFIG.sampleRate) * 1000;

    console.log(`[STT] Speech ended - duration: ${durationMs.toFixed(0)}ms`);

    // Minimum duration check
    if (durationMs < VAD_CONFIG.minAudioLengthMs) {
      console.log(`[STT] Too short (${durationMs.toFixed(0)}ms < ${VAD_CONFIG.minAudioLengthMs}ms), ignoring`);
      this.reset();
      return;
    }

    // Debounce: Prevent rapid-fire transcriptions (reduced from 1000ms)
    const timeSinceLastTranscript = Date.now() - this.lastTranscriptTime;
    if (timeSinceLastTranscript < 500) {
      console.log(`[STT] Debounce: Only ${timeSinceLastTranscript}ms since last transcript, ignoring`);
      this.reset();
      return;
    }

    this.isTranscribing = true;
    this.isSpeaking = false;

    try {
      console.log('[STT] Transcribing with Whisper...');
      const result = await this.transcribe(audioData);

      console.log(`[STT] Raw result: "${result.text}" (confidence: ${result.confidence.toFixed(2)})`);

      // Validate transcript
      const validationResult = this.validateTranscript(result);

      if (validationResult.valid) {
        this.lastTranscriptTime = Date.now();
        this.emit('finalTranscript', result);
      } else {
        console.log(`[STT] Rejected: ${validationResult.reason}`);
      }
    } catch (error) {
      console.error('[STT] Transcription error:', error);
      this.emit('error', error);
    } finally {
      this.reset();
      this.isTranscribing = false;
    }
  }

  private validateTranscript(result: TranscriptResult): { valid: boolean; reason?: string } {
    const text = result.text.trim().toLowerCase();

    // Check confidence threshold - lowered for mobile environments
    if (result.confidence < 0.25) {
      return { valid: false, reason: `Low confidence: ${result.confidence.toFixed(2)}` };
    }

    // Check for empty text
    if (text.length < 2) {
      return { valid: false, reason: 'Text too short' };
    }

    // Check for known Whisper hallucination artifacts
    for (const phrase of ECHO_PHRASES) {
      if (text.includes(phrase)) {
        return { valid: false, reason: `Whisper hallucination detected: "${phrase}"` };
      }
    }

    // Check for repetitive patterns (echo artifacts) - only for 4+ word repetitions
    const words = text.split(/\s+/);
    if (words.length >= 4) {
      const uniqueWords = new Set(words.map(w => w.toLowerCase()));
      if (uniqueWords.size === 1) {
        return { valid: false, reason: 'Repetitive pattern detected (likely echo)' };
      }
    }

    return { valid: true };
  }

  private async transcribe(audioBuffer: Buffer): Promise<TranscriptResult> {
    const wavBuffer = this.convertToWav(audioBuffer);
    const file = new File([wavBuffer], 'audio.wav', { type: 'audio/wav' });

    const response = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      response_format: 'verbose_json',
      language: 'en',
    });

    const confidence = this.calculateConfidence(response);

    return {
      text: response.text,
      confidence,
      language: response.language || 'en',
    };
  }

  private calculateConfidence(response: any): number {
    if (!response.segments || response.segments.length === 0) {
      return 0.4;
    }

    let totalLogProb = 0;
    let totalSegments = 0;

    for (const seg of response.segments) {
      if (seg.avg_logprob !== undefined) {
        totalLogProb += seg.avg_logprob;
        totalSegments++;
      }
    }

    if (totalSegments === 0) return 0.4;

    const avgLogProb = totalLogProb / totalSegments;

    // Check no_speech_prob - but be more lenient
    const noSpeechProb = response.segments[0]?.no_speech_prob || 0;
    if (noSpeechProb > 0.7) {
      return 0.15; // Only reject if very high no_speech probability
    }

    return Math.min(1, Math.max(0, Math.exp(avgLogProb)));
  }

  private convertToWav(pcmBuffer: Buffer): Buffer {
    const numChannels = 1;
    const sampleRate = VAD_CONFIG.sampleRate;
    const bitsPerSample = 16;
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const dataSize = pcmBuffer.length;
    const headerSize = 44;

    const wavBuffer = Buffer.alloc(headerSize + dataSize);

    wavBuffer.write('RIFF', 0);
    wavBuffer.writeUInt32LE(36 + dataSize, 4);
    wavBuffer.write('WAVE', 8);
    wavBuffer.write('fmt ', 12);
    wavBuffer.writeUInt32LE(16, 16);
    wavBuffer.writeUInt16LE(1, 20);
    wavBuffer.writeUInt16LE(numChannels, 22);
    wavBuffer.writeUInt32LE(sampleRate, 24);
    wavBuffer.writeUInt32LE(byteRate, 28);
    wavBuffer.writeUInt16LE(blockAlign, 32);
    wavBuffer.writeUInt16LE(bitsPerSample, 34);
    wavBuffer.write('data', 36);
    wavBuffer.writeUInt32LE(dataSize, 40);
    pcmBuffer.copy(wavBuffer, 44);

    return wavBuffer;
  }

  reset(): void {
    this.audioBuffer = [];
    this.bufferByteSize = 0;
    this.consecutiveVoiceFrames = 0;
    this.consecutiveSilenceFrames = 0;
    this.isSpeaking = false;
    this.resetSilenceTimer();
  }

  interrupt(): void {
    console.log('[STT] Interrupted');
    this.reset();
    this.isTranscribing = false;
  }
}

// Singleton instance per session
const instances = new Map<string, STTService>();

export function getSTTService(sessionId: string): STTService {
  if (!instances.has(sessionId)) {
    instances.set(sessionId, new STTService());
  }
  return instances.get(sessionId)!;
}

export function removeSTTService(sessionId: string): void {
  const instance = instances.get(sessionId);
  if (instance) {
    instance.removeAllListeners();
    instances.delete(sessionId);
  }
}
