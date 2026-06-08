import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface FabKnowledgeDocument {
  id: string;
  category: string;       // e.g. "Accounts", "Trade & Working Capital"
  product: string;        // e.g. "Business Advantage Account"
  title: string;          // human-readable
  content: string;        // descriptive copy (no rates / fees / balances)
  triggers: string[];     // phrases an SME might say that should surface this product
}

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}

/**
 * Build the embedding text. We deliberately concatenate
 *   product + " — " + content + " | Triggers: " + triggers.join(", ")
 * so that semantic match works on both the descriptive copy AND the
 * trigger phrases an SME is likely to utter verbatim.
 */
function buildEmbeddingText(doc: FabKnowledgeDocument): string {
  const triggerLine = doc.triggers && doc.triggers.length > 0
    ? ` | Triggers: ${doc.triggers.join(', ')}`
    : '';
  return `${doc.product} — ${doc.content}${triggerLine}`;
}

async function main() {
  console.log('Starting Pinecone population (FAB SME KB)...\n');

  // Check required environment variables
  if (!process.env.PINECONE_API_KEY) {
    console.error('PINECONE_API_KEY not set');
    process.exit(1);
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not set');
    process.exit(1);
  }

  // Load FAB products knowledge base — supports both the `{metadata, documents}`
  // shape and a top-level array, since the KB has been evolving.
  const kbPath = path.resolve(__dirname, '../knowledge/fab-products-kb.json');
  const kbData = JSON.parse(fs.readFileSync(kbPath, 'utf-8'));
  const documents: FabKnowledgeDocument[] = Array.isArray(kbData) ? kbData : kbData.documents;

  console.log(`Loaded ${documents.length} FAB product documents from knowledge base\n`);

  // Initialize Pinecone. Modern serverless indexes resolve by name alone;
  // only pin the host if explicitly configured.
  const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  const indexName = process.env.PINECONE_INDEX || 'fab-sme-kb';
  const index = process.env.PINECONE_HOST
    ? pinecone.index(indexName, process.env.PINECONE_HOST)
    : pinecone.index(indexName);

  console.log(`Connected to Pinecone index: ${indexName}\n`);

  // Generate embeddings and prepare vectors
  const vectors = [];

  for (const doc of documents) {
    console.log(`Processing: ${doc.id} - ${doc.product}`);

    const textToEmbed = buildEmbeddingText(doc);
    const embedding = await generateEmbedding(textToEmbed);

    vectors.push({
      id: doc.id,
      values: embedding,
      metadata: {
        category: doc.category,
        product: doc.product,
        title: doc.title,
        content: doc.content,
        triggers: doc.triggers ?? [],
      },
    });

    // Rate limiting - wait 100ms between embeddings
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log(`\nGenerated ${vectors.length} embeddings\n`);

  // Upsert in batches of 100
  const batchSize = 100;
  for (let i = 0; i < vectors.length; i += batchSize) {
    const batch = vectors.slice(i, i + batchSize);
    await index.upsert(batch);
    console.log(`Upserted batch ${Math.floor(i / batchSize) + 1}`);
  }

  console.log(`\n✓ Successfully populated Pinecone with ${vectors.length} FAB product documents`);

  // Verify by querying with a realistic SME utterance
  console.log('\nVerifying with test query...');
  const testQuery = 'We buy stock from overseas suppliers and our customers pay us 60 days later.';
  const testEmbedding = await generateEmbedding(testQuery);

  const results = await index.query({
    vector: testEmbedding,
    topK: 5,
    includeMetadata: true,
  });

  console.log('\nTest query results:');
  results.matches?.forEach((match, i) => {
    const category = match.metadata?.category ?? 'unknown';
    const product = match.metadata?.product ?? match.metadata?.title ?? match.id;
    console.log(`  ${i + 1}. [${category}] ${product} (score: ${match.score?.toFixed(3)})`);
  });

  console.log('\n✓ Population complete!');
}

main().catch(console.error);
