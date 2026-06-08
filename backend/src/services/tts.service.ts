import { config } from '../config/env.js';
import OpenAI from 'openai';

// OpenAI TTS is fallback only — ElevenLabs is primary.
// If OpenAI key has no credits, ElevenLabs handles all TTS.
const openai = new OpenAI({ apiKey: config.openaiApiKey });

export interface TTSOptions {
  voiceId?: string;
  model?: string;
  signal?: AbortSignal;
}

// ElevenLabs TTS (primary - lowest latency)
async function elevenLabsTTS(text: string, options: TTSOptions = {}): Promise<Buffer> {
  const voiceId = options.voiceId || config.elevenLabsVoiceId;

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': config.elevenLabsApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability: 0.35,          // More dynamic/expressive
          similarity_boost: 0.7,    // Natural variation
          style: 0.6,               // Expressive/engaging
          use_speaker_boost: true,
          speed: 1.1,               // Slightly faster than natural
        },
      }),
      signal: options.signal,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs TTS failed: ${error}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// OpenAI TTS (fallback)
async function openaiTTS(text: string, options: TTSOptions = {}): Promise<Buffer> {
  const response = await openai.audio.speech.create({
    model: 'tts-1',
    voice: 'onyx',
    input: text,
    response_format: 'mp3',
  });

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Main TTS function with fallback
export async function synthesizeSpeech(text: string, options: TTSOptions = {}): Promise<Buffer> {
  // Don't synthesize empty text
  if (!text.trim()) {
    throw new Error('Empty text provided for TTS');
  }

  // Try ElevenLabs first
  if (config.elevenLabsApiKey) {
    try {
      return await elevenLabsTTS(text, options);
    } catch (error: any) {
      if (error.name === 'AbortError') throw error;
      console.error('ElevenLabs TTS failed, falling back to OpenAI:', error);
    }
  }

  // Fallback to OpenAI
  return await openaiTTS(text, options);
}

// Preload voice (warm up connection)
export async function warmupTTS(): Promise<void> {
  try {
    await synthesizeSpeech('Hello.', {});
    console.log('TTS warmed up successfully');
  } catch (error) {
    console.error('TTS warmup failed:', error);
  }
}
