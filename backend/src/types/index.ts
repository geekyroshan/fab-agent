// Session and Lead types
export interface Lead {
  id?: number;
  sessionId: string;
  name: string;
  email: string;
  company: string;
  role: string;
  industry: string;
  aiStatus: 'not_started' | 'exploring' | 'pocs' | 'production' | 'ai_first';
  useCases: string;
  createdAt?: string;
  // FAB SME onboarding additions (optional — older Leads predate these fields)
  fabAnswers?: FabAnswers;
  companyResearch?: CompanyResearch;
}

// =============================================================================
// FAB SME Onboarding Types (PRD section 4–7)
// =============================================================================

/**
 * Per-question answers captured during the linear FAB onboarding flow.
 * Field names align with the captures listed in FAB_QUESTIONS.
 */
export interface FabAnswers {
  name?: string;                // Q1
  companyName?: string;         // Q2
  businessDescription?: string; // Q3
  teamSize?: string;            // Q4 (parsed from "how big is the team")
  yearsOperating?: string;      // Q4 (parsed from "how long have you been going")
  crossBorder?: string;         // Q5 (yes/no + detail)
  paymentTerms?: string;        // Q6
  paymentMethod?: string;       // Q7
  biggestHeadache?: string;     // Q8
  growthPlans?: string;         // Q9 (optional)
}

/**
 * Output of the research step (PRD section 3, stage 2).
 * 'source' tells the agent how confidently to reflect the data back:
 * - 'live'   : fresh lookup succeeded with usable signal
 * - 'backup' : pre-vetted backup company loaded (demo resilience)
 * - 'thin'   : lookup returned little — ask, don't assert
 * - 'failed' : lookup failed entirely — fall back to Q3 only
 */
export interface CompanyResearch {
  sector?: string;
  approximateSize?: string;
  whatTheyDo?: string;
  source: 'live' | 'backup' | 'thin' | 'failed';
  raw?: string;
}

/**
 * One product recommendation in the final report (PRD section 6.C).
 * Every recommendation must cite the triggering fact the SME shared.
 */
export interface FabRecommendation {
  product: string;          // e.g. "Business Advantage Account"
  category: string;         // e.g. "Accounts"
  reason: string;           // why this product fits this SME
  triggeringFact: string;   // the exact answer that triggered this rec
  isProactive?: boolean;    // true for the "you didn't ask, but..." item
}

/**
 * The final 3-section report (PRD section 6).
 */
export interface FabReport {
  snapshot: string;                     // Section A — business snapshot paragraph
  needs: string[];                      // Section B — 3-5 bullet needs
  recommendations: FabRecommendation[]; // Section C — 3-5 items incl. one proactive
  startingPoint: string;                // closing one-liner: tier + 2-3 priorities + next step
}

export interface Session {
  id: string;
  createdAt: string;
  endedAt?: string;
  source: 'readiness_webapp' | 'api';
  status: 'active' | 'completed' | 'abandoned';
}

// Message types
export interface Message {
  id?: number;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  inputType: 'voice' | 'text';
  createdAt?: string;
}

// Analysis types
export interface ReadinessMetrics {
  dataInfrastructure: number;
  technicalCapability: number;
  organizationalAlignment: number;
  useCaseClarity: number;
  total: number;
}

// Strategic Fit Score Components (0-20 each, total 0-100) - Per Spec v2
export interface StrategicFitComponents {
  problemClarity: number;       // 0-20: Vague (2-5) → Quantified (15-20)
  dataReadiness: number;        // 0-20: Manual (2-5) → Connected systems (18-20)
  businessUrgency: number;      // 0-20: Exploring (2-5) → Urgent (18-20)
  aiMaturity: number;           // 0-20: Greenfield (2-4) → Advanced (17-20)
  stakeholderAlignment: number; // 0-20: Early Champion (2-5) → Decision Maker (18-20)
}

// Opportunity Snapshot metrics per Spec v2
export interface OpportunitySnapshot {
  roiPotential: 'Moderate' | 'High' | 'Very High';      // Visual scale, not percentage
  estimatedImpact: '5-figure' | '6-figure' | '7-figure'; // Based on team size
  timeToFirstResults: '1-3 months' | '3-6 months' | '4-8 months';
  paybackSpeed: 'Fast (under 6 months)' | 'Fast (under 12 months)' | 'Standard (6-12 months)' | 'Standard (6-18 months)';
}

// Use Case mapping per Spec v2
export interface IdentifiedUseCase {
  name: string;           // e.g., "AI Sales Companion"
  description: string;    // One sentence solving their specific pain
  painSignal: string;     // The detected pain point
}

// Dimension text per score range (for reports)
export interface DimensionText {
  problemClarity: string;
  dataReadiness: string;
  businessUrgency: string;
  aiMaturity: string;
  stakeholderAlignment: string;
}

// Score band info per Spec v2
export type ScoreBand = 'Early Stage' | 'Exploring' | 'Develop' | 'Strong Foundation';
export interface ScoreBandInfo {
  band: ScoreBand;
  headline: string;
  ctaMessage: string;
  color: 'red' | 'amber' | 'green' | 'blue';
}

export interface EnterpriseMetrics {
  // Strategic Fit Score (PRIMARY qualification metric per Spec v2)
  strategicFitScore: number;          // 0-100 total score (5 dimensions × 0-20)
  strategicFitComponents: StrategicFitComponents;
  dimensionText: DimensionText;       // Text descriptions for each dimension

  // Opportunity Snapshot (per Spec v2)
  opportunitySnapshot: OpportunitySnapshot;

  // Identified Use Cases (max 3, per Spec v2)
  identifiedUseCases: IdentifiedUseCase[];

  // Score Band Info (per Spec v2)
  scoreBandInfo: ScoreBandInfo;

  // Financial Projections
  projectedAnnualSavings: number;     // $50K - $2M range
  projectedAnnualSavingsLow: number;
  projectedAnnualSavingsHigh: number;
  implementationCost: number;
  paybackPeriodMonths: number;        // 6-18 months range
  roiPercent: number;                 // 18-45% range

  // Efficiency Metrics
  timeToValueMonths: number;          // 2-12 months
  timeToValueWeeks: number;           // DEPRECATED: kept for backwards compat
  processEfficiencyGain: number;      // 20-65% range
  headcountImpact: string;

  // Risk Assessment
  implementationRisk: 'Low' | 'Medium' | 'High';
  dataReadinessRisk: 'Low' | 'Medium' | 'High';
  adoptionRisk: 'Low' | 'Medium' | 'High';

  // Industry Benchmarks
  industryAvgROI: number;
  industryAvgTimeToValue: number;
  competitorAdoptionRate: number;

  // Conversion Triggers (for real-time call-to-action prompts)
  conversionTriggers: {
    highStrategicFit: boolean;        // Score > 70
    highROI: boolean;                 // ROI > 30%
    urgencyDetected: boolean;         // Urgency keywords found
    revenueImpact: boolean;           // Revenue/sales mentioned
    founderWithClearPain: boolean;    // Founder/CEO + clear pain (new per spec)
  };

  // Strategic Insights
  quickWins: string[];
  strategicInitiatives: string[];
  riskMitigations: string[];
}

export interface Analysis {
  id?: number;
  sessionId: string;
  readinessScore: number;
  fitScore: number;
  roiEstimate: number;
  efficiencyEstimate: number;
  keyObservations: string[];
  recommendations: string[];
  // New enterprise fields (stored as JSON)
  enterpriseMetrics?: EnterpriseMetrics;
  executiveSummary?: string;
  industryContext?: string;
  nextSteps?: string[];
  createdAt?: string;
  // v2.1 fields (stored as JSON)
  enhancedRecommendations?: EnhancedRecommendation[];
  specificUseCases?: SpecificUseCase[];
  caseReferences?: CaseReference[];
  scoreTierInfo?: ScoreTierInfo;
}

// Pipeline state
export type PipelineState = 'idle' | 'listening' | 'processing' | 'speaking';

// Conversation context
export interface ConversationContext {
  sessionId: string;
  lead: Lead;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  metrics: {
    readiness: number;
    fit: number;
    roi: number;
    efficiency: number;
  };
}

// WebSocket message types
export type ClientMessage =
  | { type: 'audio'; data: ArrayBuffer }
  | { type: 'text'; data: string }
  | { type: 'control'; action: 'start' | 'stop' }
  | { type: 'analyze' };

export type ServerMessage =
  | { type: 'transcription'; text: string; final: boolean }
  | { type: 'response'; text: string; processingTime: number }
  | { type: 'audio'; data: string }
  | { type: 'state'; state: PipelineState }
  | { type: 'metrics'; data: Partial<Analysis> }
  | { type: 'interrupted' }
  | { type: 'error'; message: string }
  | { type: 'connected'; sessionId: string }
  | { type: 'analysis_complete'; data: Analysis }
  | { type: 'analysis_error'; message: string }
  | { type: 'progress'; data: { currentQuestionIndex: number; totalQuestions: number } }
  | { type: 'research'; data: CompanyResearch }
  | { type: 'report'; data: FabReport };

// STT types
export interface TranscriptResult {
  text: string;
  confidence: number;
  language: string;
}

// VAD config
export interface VADConfig {
  noiseFloorPercentile: number;
  voiceThresholdMultiplier: number;
  consecutiveVoiceFrames: number;
  silenceTimeoutMs: number;
  preBufferFrames: number;
  minAudioLengthMs: number;
  sampleRate: number;
  chunkSize: number;
}

// Knowledge base document
export interface KnowledgeDocument {
  id: string;
  category: string;
  title: string;
  content: string;
}

// =============================================================================
// v2.1 Types — 3-Phase Conversation, Specific Use Cases, Impact Framing
// =============================================================================

// Conversation phases per v2.1 spec
export type ConversationPhase = 'anchor' | 'dig_in' | 'deliver';

// Industry category mapping (13 existing → 8 v2.1 + Cross-Industry)
export type IndustryCategory =
  | 'Pharma & Healthcare'
  | 'Airlines & Aviation'
  | 'Logistics & Supply Chain'
  | 'Real Estate & Property'
  | 'Government & Public Sector'
  | 'Retail & E-commerce'
  | 'Financial Services'
  | 'Education & Training'
  | 'Cross-Industry';

// Map existing 13 industries to v2.1 categories
export const INDUSTRY_CATEGORY_MAP: Record<string, IndustryCategory> = {
  'Healthcare': 'Pharma & Healthcare',
  'Technology': 'Cross-Industry',
  'Finance & Banking': 'Financial Services',
  'Manufacturing': 'Cross-Industry',
  'Retail & E-commerce': 'Retail & E-commerce',
  'Education': 'Education & Training',
  'Real Estate': 'Real Estate & Property',
  'Legal Services': 'Cross-Industry',
  'Consulting': 'Cross-Industry',
  'Media & Entertainment': 'Cross-Industry',
  'Transportation & Logistics': 'Logistics & Supply Chain',
  'Energy & Utilities': 'Cross-Industry',
  'Other': 'Cross-Industry',
};

// Data points collected during conversation (target: 10)
export interface DataPointsCollected {
  businessProblem: boolean;
  currentProcess: boolean;
  teamSize: boolean;
  dataLocation: boolean;
  urgency: boolean;
  aiMaturity: boolean;
  volume: boolean;          // how many X per month/week
  currentCost: boolean;     // time or money spent
  decisionMaker: boolean;
  idealOutcome: boolean;
}

// Response pattern tracker to avoid repetition
export interface ResponsePatternTracker {
  usedOpeners: string[];       // track first words of each response
  insightsShared: number;      // count industry insights shared
  questionsAsked: number;      // total questions asked
  multiQuestionTurns: number;  // turns with 2+ questions
}

// v2.1 specific use case with prospect data baked in
export interface SpecificUseCase {
  name: string;
  description: string;           // includes prospect-specific data
  painSignal: string;
  prospectData?: string;         // e.g., "~25 monthly SMEs, team of 5"
  impactFraming?: ImpactFraming;
}

// Impact framing per v2.1 (operational, not financial)
export interface ImpactFraming {
  timeRecovered?: string;        // e.g., "~15 hours/week freed from manual prep"
  speedToOutcome?: string;       // e.g., "Onboarding in days, not weeks"
  scaleUnlocked?: string;        // e.g., "Handle 3x volume without adding headcount"
  errorReduction?: string;       // e.g., "Eliminate 80% of manual data entry errors"
  teamFocusShift?: string;       // e.g., "Reps focus on selling, not admin"
}

// Enhanced recommendation (3 types per v2.1)
export interface EnhancedRecommendation {
  type: 'quick_win' | 'ai_use_case' | 'strategy_call';
  title: string;
  description: string;
  icon?: string;  // 'lightning' | 'robot' | 'phone'
}

// Case reference for social proof
export interface CaseReference {
  clientName: string;
  industry: string;
  product: string;
  headline: string;           // e.g., "+45% HCP meetings in 90 days"
  detail: string;             // 1-2 sentence result description
  quote?: string;             // client quote if available
  quoteAuthor?: string;
}

// v2.1 Score Tiers (replaces 5-band with 3-tier)
export type ScoreTier = 'build_first' | 'assess_and_act' | 'fast_track';
export interface ScoreTierInfo {
  tier: ScoreTier;
  label: string;              // "Build First" | "Assess & Act" | "Fast Track"
  headline: string;
  tone: string;               // "honest/foundational" | "encouraging/pilot" | "action-oriented/kickoff"
  ctaLabel: string;           // "Workshop" | "Strategy Call" | "Pilot Kickoff"
  ctaMessage: string;
  color: 'red' | 'amber' | 'green';
}

// v2.1 conversation context passed through pipeline
export interface V21ConversationContext {
  phase: ConversationPhase;
  dataPointsCollected: DataPointsCollected;
  responsePatternTracker: ResponsePatternTracker;
  assistantMessageCount: number;
  industryCategory: IndustryCategory;
}
