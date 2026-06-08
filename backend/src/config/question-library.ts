/**
 * FAB SME AI Onboarding — Linear question script.
 *
 * Replaces the AllysAI industry × use case branches with a single linear
 * 9-question flow modelled on Whoop's guided onboarding (one question per
 * screen, conversational, second person). Agent phrasing is verbatim from
 * the PRD section 4 — do not paraphrase.
 *
 * Q3 and Q8 use the [Company] placeholder which the runtime must replace
 * with the company name captured in Q2.
 */

export type FabQuestionId =
  | 'q1_name'
  | 'q2_company'
  | 'q3_what_does'
  | 'q4_size_stage'
  | 'q5_cross_border'
  | 'q6_payment_terms'
  | 'q7_payment_method'
  | 'q8_headache'
  | 'q9_growth_optional';

export interface FabQuestion {
  id: FabQuestionId;
  order: number;
  /** Exact verbatim phrasing from PRD section 4. May contain [Company]. */
  agentAsks: string;
  /** What this question captures (for analytics + downstream answer keys). */
  captures: string;
  /** Why we ask — used by the synthesis prompt for traceability. */
  why: string;
  /** FAB product names this answer can surface in the report. */
  unlocks: string[];
  /** Optional questions can be skipped without breaking the flow. */
  isOptional?: boolean;
  /** True when agentAsks contains [Company] and must be hydrated at runtime. */
  requiresCompanyName?: boolean;
}

export const FAB_QUESTIONS: ReadonlyArray<FabQuestion> = [
  {
    id: 'q1_name',
    order: 1,
    agentAsks: 'First, who am I speaking with?',
    captures: 'name',
    why: 'Sets a personal tone for the rest of the conversation.',
    unlocks: ['personal tone'],
  },
  {
    id: 'q2_company',
    order: 2,
    agentAsks: "And what's the name of your business?",
    captures: 'company',
    why: 'Triggers the company research step that reflects sector, size, and what they do back to the SME.',
    unlocks: ['company research'],
  },
  {
    id: 'q3_what_does',
    order: 3,
    agentAsks: 'In a sentence, what does [Company] actually do day to day?',
    captures: 'businessDescription',
    why: 'Confirms or fills the sector/activity picture so recommendations are tailored to the actual operation, not the trade licence.',
    unlocks: ['sector tailoring'],
    requiresCompanyName: true,
  },
  {
    id: 'q4_size_stage',
    order: 4,
    agentAsks: 'How big is the team right now, roughly, and how long have you been going?',
    captures: 'teamSizeAndYearsOperating',
    why: 'Drives account tier (Basic vs Advantage) and signals card programme fit.',
    unlocks: [
      'Business Basic Account',
      'Business Advantage Account',
      'Commercial Credit Card',
    ],
  },
  {
    id: 'q5_cross_border',
    order: 5,
    agentAsks: 'Do you buy from or sell to anyone outside the UAE?',
    captures: 'crossBorder',
    why: 'Surfaces trade and FX needs. Cross-border activity is the single strongest signal for Trade & Working Capital and FX Solutions.',
    unlocks: [
      'Letter of Credit',
      'Bank Guarantee / Standby LC',
      'Documentary Collection',
      'Trade Financing',
      'Spot FX',
      'FX Hedging / Forwards',
    ],
  },
  {
    id: 'q6_payment_terms',
    order: 6,
    agentAsks: 'When you invoice a customer, how long until you actually get paid?',
    captures: 'paymentTerms',
    why: 'Reveals the cash conversion gap. Long terms + delivered contracts is the trigger for the Working Capital Intelligence flagship.',
    unlocks: [
      'Working Capital Loan',
      'Invoice Discounting',
      'Working Capital Intelligence',
    ],
  },
  {
    id: 'q7_payment_method',
    order: 7,
    agentAsks: 'Do customers pay you by card, in store or online?',
    captures: 'paymentMethod',
    why: 'Identifies card acceptance and e-commerce needs, mapped to the Magnati ecosystem.',
    unlocks: [
      'Magnati POS',
      'Magnati Business in a Box',
      'Magnati e-commerce',
    ],
  },
  {
    id: 'q8_headache',
    order: 8,
    agentAsks: "What's the biggest financial headache in running [Company] right now?",
    captures: 'biggestHeadache',
    why: 'Stated pain becomes the lead anchor for the report — recommendations are prioritised around this answer.',
    unlocks: ['report prioritisation'],
    requiresCompanyName: true,
  },
  {
    id: 'q9_growth_optional',
    order: 9,
    agentAsks: 'Anything big coming up — hiring, new premises, new equipment?',
    captures: 'growthPlans',
    why: 'Captures forward-looking needs that map to Asset Financing and Mortgage.',
    unlocks: ['Asset Financing', 'Commercial Mortgage', 'Residential Mortgage'],
    isOptional: true,
  },
];

/**
 * Return the question after the given zero-based index, or null if there
 * are no more questions in the script.
 */
export function nextQuestion(currentIndex: number): FabQuestion | null {
  const nextIdx = currentIndex + 1;
  if (nextIdx < 0 || nextIdx >= FAB_QUESTIONS.length) {
    return null;
  }
  return FAB_QUESTIONS[nextIdx];
}

/**
 * Return the question at the given zero-based index, or null if out of range.
 */
export function getQuestionByIndex(index: number): FabQuestion | null {
  if (index < 0 || index >= FAB_QUESTIONS.length) {
    return null;
  }
  return FAB_QUESTIONS[index];
}

/**
 * Return the question for a known FabQuestionId, or null if not found.
 */
export function getQuestionById(id: FabQuestionId): FabQuestion | null {
  return FAB_QUESTIONS.find((q) => q.id === id) ?? null;
}

/**
 * Total number of questions in the script.
 * When includeOptional is false, optional questions (e.g. Q9) are excluded.
 */
export function totalQuestions(includeOptional: boolean): number {
  if (includeOptional) {
    return FAB_QUESTIONS.length;
  }
  return FAB_QUESTIONS.filter((q) => !q.isOptional).length;
}

/**
 * Hydrate [Company] placeholder in a question's prompt if required.
 * Returns the original prompt unchanged when no substitution is needed.
 */
export function renderAgentPrompt(
  question: FabQuestion,
  companyName?: string,
): string {
  if (!question.requiresCompanyName) {
    return question.agentAsks;
  }
  const safeName = (companyName ?? '').trim() || 'your business';
  return question.agentAsks.replace(/\[Company\]/g, safeName);
}
