import OpenAI from 'openai';
import { config, chatModel } from '../config/env.js';
import {
  Lead,
  FabAnswers,
  FabReport,
  FabRecommendation,
} from '../types/index.js';
import { getMessages, saveFabReport } from './database.service.js';
import { queryKnowledgeBase } from './rag.service.js';
import { buildReportPrompt } from '../config/prompts.js';
import { FAB_QUESTIONS } from '../config/question-library.js';

// OpenRouter for chat (gpt-4o), fall back to direct OpenAI.
const openai = new OpenAI(
  config.openRouterApiKey
    ? { apiKey: config.openRouterApiKey, baseURL: 'https://openrouter.ai/api/v1' }
    : { apiKey: config.openaiApiKey }
);

// =============================================================================
// Public: generate the 3-section FAB report
// =============================================================================

export async function generateFabReport(sessionId: string, lead: Lead): Promise<FabReport> {
  const fabAnswers: FabAnswers = lead.fabAnswers || ({} as FabAnswers);
  const companyResearch = lead.companyResearch;

  // Build a RAG query from the highest-signal captured answers.
  const ragQuery = [
    fabAnswers.businessDescription,
    fabAnswers.biggestHeadache,
    fabAnswers.crossBorder,
    fabAnswers.paymentTerms,
  ]
    .filter((s) => s && s.trim().length > 0)
    .join(' | ');

  let ragContext: string | null = null;
  try {
    ragContext = ragQuery ? await queryKnowledgeBase(ragQuery, 5, 0.2) : null;
  } catch (err) {
    console.error('RAG lookup failed for report generation:', err);
    ragContext = null;
  }

  const prompt = buildReportPrompt(lead, fabAnswers, companyResearch, ragContext || undefined);

  try {
    const response = await openai.chat.completions.create({
      model: chatModel('gpt-4o'),
      messages: [
        {
          role: 'system',
          content:
            'You are a FAB SME relationship manager finalising a tailored onboarding report. Return only valid JSON conforming to the FabReport shape. No commentary, no markdown.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 1800,
      temperature: 0.4,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty report response');

    const parsed = JSON.parse(content) as Partial<FabReport>;
    const report = validateAndCoerceReport(parsed, fabAnswers);

    // Touch sessionId for downstream callers (some auditors expect it on the saved record).
    saveFabReport(sessionId, report);
    return report;
  } catch (err) {
    console.error('FAB report generation failed, using fallback:', err);
    const fallback = buildMinimalFallbackReport(lead, fabAnswers);
    try {
      saveFabReport(sessionId, fallback);
    } catch (saveErr) {
      console.error('Failed to persist fallback report:', saveErr);
    }
    return fallback;
  }
}

// =============================================================================
// Public: lightweight progress indicator
// =============================================================================

export function getQuickProgress(
  lead: Lead,
  _messageCount: number
): { currentQuestionIndex: number; totalQuestions: number; questionsRemaining: number } {
  const totalQuestions = FAB_QUESTIONS.length;
  const fa = lead.fabAnswers;

  if (!fa) {
    return { currentQuestionIndex: 0, totalQuestions, questionsRemaining: totalQuestions };
  }

  // Map FAB_QUESTIONS order to the FabAnswers slot it captures.
  // The other agent's FabQuestion has a `field` (or `answerKey`) pointing into FabAnswers,
  // but to stay decoupled we infer by id substring with a sensible fallback ordering.
  const slotForIndex: Array<keyof FabAnswers> = [
    'name',
    'companyName',
    'businessDescription',
    'teamSize',
    'crossBorder',
    'paymentTerms',
    'paymentMethod',
    'biggestHeadache',
    'growthPlans',
  ];

  let filled = 0;
  for (let i = 0; i < Math.min(slotForIndex.length, totalQuestions); i++) {
    const key = slotForIndex[i];
    const v = fa[key];
    if (typeof v === 'string' && v.trim().length > 0) {
      filled++;
    } else {
      break; // linear flow — stop at first empty
    }
  }

  const currentQuestionIndex = Math.min(filled, totalQuestions - 1);
  return {
    currentQuestionIndex,
    totalQuestions,
    questionsRemaining: Math.max(0, totalQuestions - filled),
  };
}

// =============================================================================
// Validation + fallback
// =============================================================================

function validateAndCoerceReport(parsed: Partial<FabReport>, fabAnswers: FabAnswers): FabReport {
  const snapshot = typeof parsed.snapshot === 'string' && parsed.snapshot.trim().length > 0
    ? parsed.snapshot.trim()
    : '';
  const needs = Array.isArray(parsed.needs) ? parsed.needs.filter((n) => typeof n === 'string' && n.trim().length > 0) : [];
  const rawRecs = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];

  const recommendations: FabRecommendation[] = rawRecs
    .filter((r): r is FabRecommendation => !!r && typeof r === 'object' && typeof (r as any).product === 'string')
    .map((r) => ({
      product: r.product,
      category: typeof r.category === 'string' ? r.category : 'Accounts',
      reason: typeof r.reason === 'string' ? r.reason : '',
      triggeringFact: typeof r.triggeringFact === 'string' ? r.triggeringFact : '',
      isProactive: !!r.isProactive,
    }));

  // Ensure exactly one proactive item.
  const proactiveCount = recommendations.filter((r) => r.isProactive).length;
  if (recommendations.length > 0 && proactiveCount === 0) {
    recommendations[recommendations.length - 1].isProactive = true;
  } else if (proactiveCount > 1) {
    let seen = false;
    for (const r of recommendations) {
      if (r.isProactive) {
        if (seen) r.isProactive = false;
        else seen = true;
      }
    }
  }

  const startingPoint = typeof parsed.startingPoint === 'string' && parsed.startingPoint.trim().length > 0
    ? parsed.startingPoint.trim()
    : '';

  // If anything critical is missing, fall through to fallback.
  if (!snapshot || needs.length === 0 || recommendations.length === 0 || !startingPoint) {
    return buildMinimalFallbackReport(undefined, fabAnswers);
  }

  return { snapshot, needs, recommendations, startingPoint };
}

function buildMinimalFallbackReport(lead: Lead | undefined, fabAnswers: FabAnswers): FabReport {
  const companyName = fabAnswers.companyName || lead?.company || 'your business';
  const description = fabAnswers.businessDescription || 'your operations';
  const headache = fabAnswers.biggestHeadache || 'managing day-to-day cash flow';

  const snapshot = `${companyName} — ${description}. Team size noted as ${fabAnswers.teamSize || 'shared during the call'}. Cross-border activity: ${fabAnswers.crossBorder || 'not specified'}. Payment terms: ${fabAnswers.paymentTerms || 'not specified'}. The standout focus area is: ${headache}.`;

  const needs: string[] = [
    `A core banking setup that fits ${companyName}'s current stage.`,
    `Working capital support for the cash-flow patterns described.`,
    `Spend control tools the founder can use day to day.`,
  ];
  if (fabAnswers.crossBorder && /yes|import|export/i.test(fabAnswers.crossBorder)) {
    needs.push('Trade and FX support for cross-border activity.');
  }
  if (fabAnswers.paymentMethod && /card|online|pos/i.test(fabAnswers.paymentMethod)) {
    needs.push('Acceptance tools so customers can pay by card or online.');
  }

  const recommendations: FabRecommendation[] = [
    {
      product: 'Business Advantage Account',
      category: 'Accounts',
      reason: 'Core day-to-day operating account at the right tier for a growing SME.',
      triggeringFact: `Team size and stage: ${fabAnswers.teamSize || 'as described'}.`,
      isProactive: false,
    },
    {
      product: 'Working Capital Loan',
      category: 'Loans',
      reason: 'Bridges the gap between paying suppliers and getting paid by customers.',
      triggeringFact: `Payment terms: ${fabAnswers.paymentTerms || headache}.`,
      isProactive: false,
    },
    {
      product: 'Commercial Credit Card',
      category: 'Commercial Cards',
      reason: 'Spend control and short-term liquidity for operational expenses.',
      triggeringFact: `Stated headache: ${headache}.`,
      isProactive: false,
    },
    {
      product: 'FAB SME Rewards',
      category: 'Rewards',
      reason: 'Adjacent value the founder may not be thinking about — earns back on existing spend.',
      triggeringFact: 'Proactive RM flag, not raised by the user.',
      isProactive: true,
    },
  ];

  const startingPoint = `Start with a Business Advantage Account, add a Working Capital Loan and a Commercial Credit Card for cash-flow and spend control, then kick off the setup with your relationship manager.`;

  return { snapshot, needs, recommendations, startingPoint };
}

// =============================================================================
// Backward-compat shim — pipeline.service.ts and chat.handler.ts still call
// the old names. Until the final integration pass, expose stubs so the
// codebase still compiles. These return MINIMAL data and should NOT be relied
// on for real output — generateFabReport / getQuickProgress are the truth.
// =============================================================================

export async function analyzeReadiness(sessionId: string, lead: Lead): Promise<any> {
  // Delegate to the new FAB report so behaviour is at least correct.
  const report = await generateFabReport(sessionId, lead);
  return {
    sessionId,
    readinessScore: 0,
    fitScore: 0,
    roiEstimate: 0,
    efficiencyEstimate: 0,
    keyObservations: report.needs,
    recommendations: report.recommendations.map((r) => `${r.product} — ${r.reason}`),
    nextSteps: [report.startingPoint],
    fabReport: report,
  };
}

export function getQuickMetrics(
  lead: Lead,
  messageCount: number,
  _conversationHistory?: Array<{ role: string; content: string }>
): {
  readiness: number;
  fit: number;
  roi: number;
  efficiency: number;
} {
  const progress = getQuickProgress(lead, messageCount);
  const pct = Math.round((progress.currentQuestionIndex / Math.max(1, progress.totalQuestions)) * 100);
  return {
    readiness: pct,
    fit: pct,
    roi: 0,
    efficiency: 0,
  };
}
