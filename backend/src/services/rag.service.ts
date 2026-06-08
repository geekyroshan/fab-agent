import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { config } from '../config/env.js';

// Embeddings require direct OpenAI (not available on OpenRouter).
// Falls back to local keyword search if embedding call fails.
const openai = new OpenAI({ apiKey: config.openaiApiKey });

// Local knowledge base (loaded on startup)
interface KBDocument {
  id: string;
  category: string;
  /** Pre-FAB-rename: held the legacy doc title. Optional going forward. */
  title?: string;
  /** FAB SME KB exposes a `product` name on each doc. */
  product?: string;
  content: string;
  /** Trigger phrases — SME-style utterances that should surface this doc. */
  triggers?: string[];
  embedding?: number[];
}

let localKB: KBDocument[] = [];
let pinecone: Pinecone | null = null;
let pineconeIndex: any = null;

// Load local knowledge base — prefers fab-products-kb.json, falls back to legacy file
// for safety during transitions.
function loadLocalKB(): void {
  try {
    const candidates = [
      path.resolve(process.cwd(), 'knowledge/fab-products-kb.json'),
      path.resolve(process.cwd(), 'knowledge/readiness-kb.json'),
    ];
    const kbPath = candidates.find((p) => fs.existsSync(p));
    if (kbPath) {
      const data = JSON.parse(fs.readFileSync(kbPath, 'utf-8'));
      // New KB is an array; legacy was `{ documents: [...] }`.
      localKB = Array.isArray(data) ? data : (data.documents || []);
      console.log(`Loaded ${localKB.length} documents from ${path.basename(kbPath)}`);
    }

    // Try to load embeddings if they exist
    const embeddingsPath = path.resolve(process.cwd(), 'knowledge/embeddings.json');
    if (fs.existsSync(embeddingsPath)) {
      const embeddings = JSON.parse(fs.readFileSync(embeddingsPath, 'utf-8'));
      localKB.forEach((doc) => {
        if (embeddings[doc.id]) {
          doc.embedding = embeddings[doc.id];
        }
      });
      console.log('Loaded pre-computed embeddings');
    }
  } catch (error) {
    console.error('Failed to load local KB:', error);
  }
}

// Initialize Pinecone (if enabled)
function initPinecone(): void {
  if (!config.enablePinecone || !config.pineconeApiKey) {
    console.log('Pinecone disabled — using local knowledge base search');
    return;
  }

  try {
    pinecone = new Pinecone({ apiKey: config.pineconeApiKey });
    const indexName = config.pineconeIndex || 'fab-sme-kb';
    pineconeIndex = config.pineconeHost
      ? pinecone.index(indexName, config.pineconeHost)
      : pinecone.index(indexName);
    console.log(`Pinecone initialized with index: ${indexName}`);
  } catch (error) {
    console.error('Failed to initialize Pinecone:', error);
    pinecone = null;
    pineconeIndex = null;
  }
}

// Generate embedding for text
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}

// Cosine similarity between two vectors
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Local keyword-based search (fast, no embeddings needed)
function localKeywordSearch(question: string, topK: number = 5): KBDocument[] {
  const keywords = question.toLowerCase().split(/\s+/).filter((w) => w.length > 2);

  const scored = localKB.map((doc) => {
    const text = `${doc.product || doc.title || ''} ${doc.content} ${doc.category} ${(doc.triggers || []).join(' ')}`.toLowerCase();
    let score = 0;

    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        score += 1;
        // Boost for title matches
        if ((doc.product || doc.title || '').toLowerCase().includes(keyword)) {
          score += 2;
        }
      }
    }

    return { doc, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((s) => s.doc);
}

// Local semantic search (requires pre-computed embeddings)
async function localSemanticSearch(
  question: string,
  topK: number = 5,
  threshold: number = 0.25
): Promise<KBDocument[]> {
  // If no embeddings, fall back to keyword search
  const docsWithEmbeddings = localKB.filter((doc) => doc.embedding && doc.embedding.length > 0);
  if (docsWithEmbeddings.length === 0) {
    console.log('No embeddings found, using keyword search');
    return localKeywordSearch(question, topK);
  }

  try {
    const queryEmbedding = await generateEmbedding(question);

    const scored = docsWithEmbeddings.map((doc) => ({
      doc,
      score: cosineSimilarity(queryEmbedding, doc.embedding!),
    }));

    return scored
      .filter((s) => s.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((s) => s.doc);
  } catch (error) {
    console.error('Semantic search failed, falling back to keyword:', error);
    return localKeywordSearch(question, topK);
  }
}

// Pinecone search
async function pineconeSearch(
  question: string,
  topK: number = 5,
  threshold: number = 0.25
): Promise<string | null> {
  if (!pineconeIndex) return null;

  try {
    const embedding = await generateEmbedding(question);

    const results = await pineconeIndex.query({
      vector: embedding,
      topK,
      includeMetadata: true,
    });

    if (!results.matches || results.matches.length === 0) {
      return null;
    }

    const relevant = results.matches.filter((match: any) => match.score >= threshold);

    if (relevant.length === 0) {
      return null;
    }

    return relevant
      .map((match: any) => {
        const metadata = match.metadata || {};
        return `[${metadata.category || 'info'}] ${metadata.product || metadata.title || ''}\n${metadata.content || ''}`;
      })
      .join('\n---\n');
  } catch (error) {
    console.error('Pinecone query failed:', error);
    return null;
  }
}

// Main query function - tries Pinecone first, falls back to local
export async function queryKnowledgeBase(
  question: string,
  topK: number = 5,
  scoreThreshold: number = 0.25
): Promise<string | null> {
  // Initialize on first use
  if (localKB.length === 0) {
    loadLocalKB();
  }

  if (config.enablePinecone && !pinecone) {
    initPinecone();
  }

  // Try Pinecone first if enabled
  if (pineconeIndex) {
    const pineconeResult = await pineconeSearch(question, topK, scoreThreshold);
    if (pineconeResult) {
      return pineconeResult;
    }
  }

  // Fall back to local search
  const localResults = await localSemanticSearch(question, topK, scoreThreshold);

  if (localResults.length === 0) {
    // Last resort: keyword search
    const keywordResults = localKeywordSearch(question, topK);
    if (keywordResults.length === 0) {
      return null;
    }
    return keywordResults
      .map((doc) => `[${doc.category}] ${doc.product || doc.title || ''}\n${doc.content}`)
      .join('\n---\n');
  }

  return localResults
    .map((doc) => `[${doc.category}] ${doc.product || doc.title || ''}\n${doc.content}`)
    .join('\n---\n');
}

// Check if RAG is available (always true with local KB)
export function isRAGEnabled(): boolean {
  return true; // Local KB is always available
}

// Get all documents (for admin/debug)
export function getAllDocuments(): KBDocument[] {
  if (localKB.length === 0) {
    loadLocalKB();
  }
  return localKB;
}

// Initialize on module load
loadLocalKB();
