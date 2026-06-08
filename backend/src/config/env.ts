import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3001', 10),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  nodeEnv: process.env.NODE_ENV || 'development',

  // OpenAI (used for STT/TTS fallback/embeddings)
  openaiApiKey: process.env.OPENAI_API_KEY || '',

  // OpenRouter (used for chat completions - gpt-4o via OpenRouter)
  openRouterApiKey: process.env.OPENROUTER_API_KEY || '',

  // ElevenLabs
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || '',
  elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID || 'wWWn96OtTHu1sn8SRGEr',

  // Pinecone
  pineconeApiKey: process.env.PINECONE_API_KEY || '',
  pineconeHost: process.env.PINECONE_HOST || '',
  pineconeIndex: process.env.PINECONE_INDEX || 'fab-sme-kb',
  enablePinecone: process.env.ENABLE_PINECONE === 'true',

  // Anthropic (fallback)
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',

  // Resend (Email)
  resendApiKey: process.env.RESEND_API_KEY || '',
  resendFromEmail: process.env.RESEND_FROM_EMAIL || 'FAB SME Setup <noreply@example.com>',

  // Google Sheets
  googleSheetsSpreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '',
  googleSheetsCredentials: process.env.GOOGLE_SHEETS_CREDENTIALS || '',

  // Database
  databasePath: process.env.DATABASE_PATH || './data/fab.db',
};

/**
 * Get the correct model name for the active LLM provider.
 * OpenRouter requires 'openai/gpt-4o' format; direct OpenAI uses 'gpt-4o'.
 */
export function chatModel(model: string): string {
  if (config.openRouterApiKey) {
    return `openai/${model}`;
  }
  return model;
}

// Validate required config
export function validateConfig(): void {
  const required = ['openaiApiKey', 'elevenLabsApiKey'] as const;
  const missing = required.filter((key) => !config[key]);

  if (missing.length > 0) {
    console.warn(`Missing required config: ${missing.join(', ')}`);
  }

  if (config.enablePinecone && (!config.pineconeApiKey || !config.pineconeHost)) {
    console.warn('Pinecone enabled but missing API key or host');
  }
}
