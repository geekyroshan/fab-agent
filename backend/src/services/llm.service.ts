import OpenAI from 'openai';
import { config, chatModel } from '../config/env.js';
import { buildSystemPrompt, buildGreetingPrompt, FALLBACK_RESPONSES } from '../config/prompts.js';
import {
  Lead,
  ConversationContext,
  FabAnswers,
  CompanyResearch,
} from '../types/index.js';
import { FabQuestion } from '../config/question-library.js';

// OpenRouter for chat completions, fall back to direct OpenAI.
const openai = new OpenAI(
  config.openRouterApiKey
    ? { apiKey: config.openRouterApiKey, baseURL: 'https://openrouter.ai/api/v1' }
    : { apiKey: config.openaiApiKey }
);

// =============================================================================
// Public API
// =============================================================================

export interface GenerateOptions {
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  isVoice?: boolean;
  fabAnswers?: FabAnswers;
  currentQuestionIndex?: number;
  companyResearch?: CompanyResearch;
  /** True if the previous user reply did not yield a usable answer
   *  for the current question — the LLM must rephrase, never repeat. */
  isReasking?: boolean;
}

/**
 * Generate the next assistant reply for the FAB onboarding flow.
 * Tries OpenAI first, falls back to Claude.
 */
export async function generateResponse(
  userMessage: string,
  context: ConversationContext,
  ragContext: string | null,
  options: GenerateOptions = {}
): Promise<string> {
  const startTime = Date.now();

  try {
    const response = await generateWithOpenAI(userMessage, context, ragContext, options);
    console.log(`LLM response generated in ${Date.now() - startTime}ms`);
    return response;
  } catch (error: any) {
    if (error.name === 'AbortError') throw error;
    console.error('OpenAI failed, trying Claude:', error.message);

    try {
      const response = await generateWithClaude(userMessage, context, ragContext, options);
      console.log(`Claude fallback response in ${Date.now() - startTime}ms`);
      return response;
    } catch (claudeError: any) {
      if (claudeError.name === 'AbortError') throw claudeError;
      console.error('Claude also failed:', claudeError.message);
      return FALLBACK_RESPONSES.error;
    }
  }
}

/**
 * Generate the initial Q1 greeting line. Deterministic so the demo is consistent.
 */
export async function generateGreeting(lead: Lead): Promise<string> {
  // The greeting is intentionally fixed text — no LLM call needed. We keep this
  // async to preserve the existing call-site signature.
  return buildGreetingPrompt(lead);
}

/**
 * Track response opener (first 3-4 words). Used for telemetry / pattern checks.
 */
export function extractOpener(response: string): string {
  const words = response.trim().split(/\s+/).slice(0, 4);
  return words.join(' ');
}

/**
 * Extract the relevant FabAnswers slot from a user reply given the question
 * that prompted it. Fast: uses gpt-4o-mini, with simple parsing fast-paths
 * for the deterministic early questions (Q1 name, Q2 company).
 */
export async function extractFabAnswerFromUserMessage(
  question: FabQuestion,
  userMessage: string
): Promise<Partial<FabAnswers>> {
  const cleanReply = userMessage.trim();
  if (!cleanReply) return {};

  // Each question carries an `id` (or `field`) hint. We map question.id → FabAnswers key.
  const targetKey = inferAnswerKey(question);
  if (!targetKey) return {};

  // Fast paths: name + company are short enough that we just take the user's reply verbatim.
  if (targetKey === 'name') {
    const extracted = extractFirstName(cleanReply);
    // If the reply was just a greeting / filler ("hi", "hello"), do NOT write a name.
    // Returning an empty patch keeps the name slot unfilled so progress stays on Q1
    // and the system prompt's "push gently on vague answers" rule can re-ask cleanly.
    if (!extracted) return {};
    return { name: extracted };
  }
  if (targetKey === 'companyName') {
    const stripped = stripFiller(cleanReply);
    // Same defensive treatment for Q2 — a one-word greeting is not a company name.
    if (!stripped || NON_NAME_TOKENS.has(stripped.toLowerCase())) return {};
    return { companyName: stripped };
  }

  // For the remaining slots, run a quick gpt-4o-mini structured extraction
  // with per-question COMPLETENESS rules. If the reply is missing required
  // pieces, we return empty so the pipeline won't advance and the agent
  // will probe for the missing piece next turn.
  try {
    const completenessRule = completenessRuleForQuestion(question.id);
    const response = await openai.chat.completions.create({
      model: chatModel('gpt-4o-mini'),
      messages: [
        {
          role: 'system',
          content:
            'You extract a single piece of information from a short user reply for a banker-grade onboarding. Return only valid JSON. Mirror the user\'s words verbatim — never invent or assume facts. Default to ACCEPTING any reply that meaningfully addresses the question; only mark incomplete when a clearly required piece is explicitly missing.',
        },
        {
          role: 'user',
          content: `Question asked: "${question.agentAsks}"
User reply: "${cleanReply}"

${completenessRule}

Return JSON: { "value": string, "complete": boolean }
- value: the user's literal answer relevant to the question, normalised to one short clause. Never paraphrase, never assume context the user didn't provide.
- complete: default to TRUE. Set to false ONLY when the completeness rule above is clearly violated (e.g. a bare "yes" for Q5 with no direction/country, a bare number with no time unit for Q6, a bare number with no duration for Q4). If the reply is a reasonable sentence that touches on the question topic, complete is true even if some adjacent detail isn't explicit.

When complete is false, also set value to "" so the agent can probe.`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 160,
      temperature: 0.0,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return {};

    const parsed = JSON.parse(content) as { value?: string; complete?: boolean };
    const value = (parsed.value || '').trim();
    // Hard gate: drop if explicitly marked incomplete OR if value is empty.
    // But also: if value is non-empty AND of reasonable length, accept it
    // even when complete is somehow missing from the response (defensive).
    if (!value) return {};
    if (parsed.complete === false) return {};
    return { [targetKey]: value } as Partial<FabAnswers>;
  } catch (err) {
    console.error('extractFabAnswerFromUserMessage failed:', err);
    // On extractor error, fall back to accepting the raw reply rather than
    // stalling the conversation — the agent can still probe in the system
    // prompt if it looks lazy.
    return cleanReply.length >= 2 ? ({ [targetKey]: cleanReply } as Partial<FabAnswers>) : {};
  }
}

/**
 * Per-question completeness rule passed to the extractor. These mirror the
 * probing rules in the system prompt, but enforced at extraction time so the
 * pipeline doesn't advance until we have a real answer.
 */
function completenessRuleForQuestion(qid: string): string {
  switch (qid) {
    case 'q3_what_does':
      return 'Completeness rule: reject ONLY if the reply is a single non-descriptive word ("yes", "ok", "stuff", "things"). Any short sentence describing the business activity is complete.';
    case 'q4_size_stage':
      return 'Completeness rule: reject ONLY if the reply is a bare number ("5", "12", "20") with no time/duration context (no "year(s)", "month(s)", "going for", "since", "established", "started", etc.) AND no count of people. If the reply mentions either staff count OR years OR both, mark complete. Acceptable examples: "18 staff, 5 years" (complete), "we are 5 of us, started last year" (complete), "5" alone (incomplete — could be staff or years), "5 staff" (complete — staff implied), "5 years" (complete — duration implied).';
    case 'q5_cross_border':
      return 'Completeness rule: reject ONLY if the reply is a bare "yes" with no follow-on detail (no direction, no country, no product). A bare "no", "only UAE", "domestic" is complete (means no cross-border). Any "yes" combined with direction (buying/selling/import/export) OR a country/region is complete.';
    case 'q6_payment_terms':
      return 'Completeness rule: reject ONLY if the reply is a bare number ("30", "60") with NO unit/context. Anything with "days", "weeks", "months", "upfront", "immediately", "on the spot", "30 days", "net 60" etc. is complete.';
    case 'q7_payment_method':
      return 'Completeness rule: reject ONLY if the reply is a bare "yes" or "no" with no method mentioned. Any specific method (card, bank transfer, cash, online, POS, cheque, e-commerce, etc.) — even a single word — is complete.';
    case 'q8_headache':
      return 'Completeness rule: reject ONLY if the reply is a single generic word ("cash flow", "growth", "money", "nothing") with no specific detail. Any sentence or phrase describing a specific pain point is complete.';
    case 'q9_growth_optional':
      return 'Completeness rule: a clear "no" / "nothing big" / "not really" is complete. Any mention of a specific upcoming thing (hiring, premises, equipment, expansion) is complete.';
    default:
      return 'Completeness rule: accept any reply that directly addresses the question.';
  }
}

// =============================================================================
// Internals
// =============================================================================

async function generateWithOpenAI(
  userMessage: string,
  context: ConversationContext,
  ragContext: string | null,
  options: GenerateOptions
): Promise<string> {
  const systemPrompt = buildSystemPrompt(
    context.lead,
    ragContext || undefined,
    options.fabAnswers,
    options.currentQuestionIndex ?? 0,
    options.companyResearch,
    options.isReasking ?? false,
  );

  const recentHistory = context.history.slice(-8);

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...recentHistory.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user', content: userMessage },
  ];

  const model = chatModel(options.isVoice ? 'gpt-4o-mini' : 'gpt-4o');
  const maxTokens = options.isVoice ? 150 : (options.maxTokens || 200);

  const response = await openai.chat.completions.create(
    {
      model,
      messages,
      max_tokens: maxTokens,
      temperature: options.temperature ?? 0.7,
    },
    { signal: options.signal }
  );

  return response.choices[0]?.message?.content || FALLBACK_RESPONSES.error;
}

async function generateWithClaude(
  userMessage: string,
  context: ConversationContext,
  ragContext: string | null,
  options: GenerateOptions
): Promise<string> {
  if (!config.anthropicApiKey) {
    throw new Error('Anthropic API key not configured');
  }

  const systemPrompt = buildSystemPrompt(
    context.lead,
    ragContext || undefined,
    options.fabAnswers,
    options.currentQuestionIndex ?? 0,
    options.companyResearch,
    options.isReasking ?? false,
  );

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-latest',
      max_tokens: options.maxTokens || 200,
      system: systemPrompt,
      messages: [
        ...context.history.map((msg) => ({ role: msg.role, content: msg.content })),
        { role: 'user', content: userMessage },
      ],
    }),
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = (await response.json()) as { content: Array<{ text?: string }> };
  return data.content[0]?.text || FALLBACK_RESPONSES.error;
}

// Set of valid FabAnswers keys for fast runtime checks.
const FAB_ANSWER_KEYS: ReadonlySet<keyof FabAnswers> = new Set<keyof FabAnswers>([
  'name',
  'companyName',
  'businessDescription',
  'teamSize',
  'yearsOperating',
  'crossBorder',
  'paymentTerms',
  'paymentMethod',
  'biggestHeadache',
  'growthPlans',
]);

/** Map a FabQuestion to the FabAnswers slot it targets. */
function inferAnswerKey(question: FabQuestion): keyof FabAnswers | null {
  // If `captures` is already a valid FabAnswers key, use it.
  const captures = (question.captures || '') as keyof FabAnswers;
  if (FAB_ANSWER_KEYS.has(captures)) return captures;

  // Q4 captures both teamSize and yearsOperating in one answer — default to teamSize
  // (the LLM extractor returns a single string; pipeline can split later if needed).
  if (question.captures === 'teamSizeAndYearsOperating') return 'teamSize';

  // Fallback: infer from id keywords.
  const id = (question.id || '').toLowerCase();
  if (id.includes('name') && !id.includes('company')) return 'name';
  if (id.includes('company') || id.includes('business_name')) return 'companyName';
  if (id.includes('what_does') || id.includes('description')) return 'businessDescription';
  if (id.includes('size') || id.includes('team') || id.includes('stage')) return 'teamSize';
  if (id.includes('cross') || id.includes('border')) return 'crossBorder';
  if (id.includes('payment_term')) return 'paymentTerms';
  if (id.includes('payment_method')) return 'paymentMethod';
  if (id.includes('headache')) return 'biggestHeadache';
  if (id.includes('growth')) return 'growthPlans';
  return null;
}

// Greetings / fillers that must never end up stored as a person's name.
// If the user's entire Q1 reply is one of these, we treat the answer as missing
// rather than store "Hi" in the name slot — the LLM will then naturally re-ask.
const NON_NAME_TOKENS = new Set([
  'hi',
  'hey',
  'hello',
  'yo',
  'hiya',
  'sup',
  'morning',
  'afternoon',
  'evening',
  'ok',
  'okay',
  'sure',
  'yes',
  'no',
  'nope',
  'yeah',
  'thanks',
  'thank you',
  'thx',
]);

function extractFirstName(reply: string): string {
  // Tolerate "I'm Omar", "My name is Omar", "Omar here", "It's Omar".
  const cleaned = reply
    .replace(/^(hi|hey|hello|yo|hiya)[,!. ]+/i, '')
    .replace(/^(i'?m|i am|it'?s|this is|my name is|name'?s)\s+/i, '')
    .trim();
  const firstToken = cleaned.split(/[\s,.;]+/)[0] || cleaned;
  if (firstToken.length === 0) return '';

  // Reject standalone greetings/fillers so we don't store "Hi" as the lead's name.
  const lowerToken = firstToken.toLowerCase();
  const lowerWhole = reply.trim().toLowerCase();
  if (NON_NAME_TOKENS.has(lowerToken) || NON_NAME_TOKENS.has(lowerWhole)) {
    return '';
  }

  // Capitalise nicely.
  return firstToken.charAt(0).toUpperCase() + firstToken.slice(1);
}

function stripFiller(reply: string): string {
  // Apply filler-prefix strips iteratively so phrases like
  // "it's called Hayat Coffee Roasters" → "Hayat Coffee Roasters" (not "called Hayat...").
  let s = reply.trim();
  const fillerPatterns = [
    /^(it'?s|that'?s|this is|the company is|the business is|we are|we'?re|i'?m|we go by|we trade as|trading as|known as|operating as)\s+/i,
    /^(my company is|my business is|the name is|name'?s|called|named|our name is)\s+/i,
    /^(well|so|um|uh|er|like|basically|honestly|actually|just|okay|ok),?\s+/i,
  ];

  let changed = true;
  while (changed) {
    changed = false;
    for (const p of fillerPatterns) {
      const next = s.replace(p, '');
      if (next !== s) {
        s = next;
        changed = true;
      }
    }
  }

  return s.replace(/[.!?]+$/, '').trim();
}
