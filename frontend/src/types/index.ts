export interface Lead {
  name: string;
  email: string;
  company: string;
  role: string;
  industry: string;
  aiStatus: 'not_started' | 'exploring' | 'pocs' | 'production';
  useCases: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  inputType?: 'voice' | 'text';
}

// Strategic Fit Score Components (0-20 each, total 0-100) - Per Spec v2
export interface StrategicFitComponents {
  problemClarity: number;       // 0-20: Vague (2-5) → Quantified (16-20)
  dataReadiness: number;        // 0-20: Manual (2-5) → Connected systems (16-20)
  businessUrgency: number;      // 0-20: Exploring (2-5) → Urgent (16-20)
  aiMaturity: number;           // 0-20: Greenfield (2-4) → Advanced (17-20)
  stakeholderAlignment: number; // 0-20: Early Champion (2-5) → Decision Maker (18-20)
}

// Dimension text descriptions for reports
export interface DimensionText {
  problemClarity: string;
  dataReadiness: string;
  businessUrgency: string;
  aiMaturity: string;
  stakeholderAlignment: string;
}

// Opportunity Snapshot per Spec v2
export interface OpportunitySnapshot {
  roiPotential: 'Moderate' | 'High' | 'Very High';
  estimatedImpact: '5-figure' | '6-figure' | '7-figure';
  timeToFirstResults: '1-3 months' | '3-6 months' | '4-8 months';
  paybackSpeed: 'Fast (under 6 months)' | 'Fast (under 12 months)' | 'Standard (6-12 months)' | 'Standard (6-18 months)';
}

// Identified Use Case per Spec v2
export interface IdentifiedUseCase {
  name: string;
  description: string;
  painSignal: string;
}

// Score Band Info per Spec v2
export type ScoreBand = 'Early Stage' | 'Exploring' | 'Develop' | 'Strong Foundation';
export interface ScoreBandInfo {
  band: ScoreBand;
  headline: string;
  ctaMessage: string;
  color: 'red' | 'amber' | 'green' | 'blue';
}

// Conversion Triggers for call-to-action prompts
export interface ConversionTriggers {
  highStrategicFit: boolean;    // Score > 70
  highROI: boolean;             // ROI > 30%
  urgencyDetected: boolean;     // Urgency keywords found
  revenueImpact: boolean;       // Revenue/sales mentioned
  founderWithClearPain: boolean; // Founder/CEO + clear pain
}

export interface EnterpriseMetrics {
  // Strategic Fit Score (PRIMARY qualification metric per Spec v2)
  strategicFitScore?: number;           // 0-100 total score (5 dimensions × 0-20)
  strategicFitComponents?: StrategicFitComponents;
  dimensionText?: DimensionText;        // Text descriptions for each dimension

  // Opportunity Snapshot (per Spec v2)
  opportunitySnapshot?: OpportunitySnapshot;

  // Identified Use Cases (max 3, per Spec v2)
  identifiedUseCases?: IdentifiedUseCase[];

  // Score Band Info (per Spec v2)
  scoreBandInfo?: ScoreBandInfo;

  // Financial Projections
  projectedAnnualSavings: number;
  projectedAnnualSavingsLow?: number;
  projectedAnnualSavingsHigh?: number;
  implementationCost?: number;
  paybackPeriodMonths: number;
  roiPercent?: number;                  // 18-45% range

  // Efficiency Metrics
  timeToValueMonths?: number;           // 2-12 months
  timeToValueWeeks: number;             // DEPRECATED: kept for backwards compat
  processEfficiencyGain: number;
  headcountImpact?: string;

  // Risk Assessment
  implementationRisk: 'Low' | 'Medium' | 'High';
  dataReadinessRisk: 'Low' | 'Medium' | 'High';
  adoptionRisk: 'Low' | 'Medium' | 'High';

  // Industry Benchmarks
  industryAvgROI: number;
  industryAvgTimeToValue: number;
  competitorAdoptionRate: number;

  // Conversion Triggers
  conversionTriggers?: ConversionTriggers;

  // Strategic Insights
  quickWins?: string[];
  strategicInitiatives?: string[];
  riskMitigations?: string[];
}

export interface Metrics {
  readiness: number;
  fit: number;
  roi: number;
  efficiency: number;
  keyObservations?: string[];
  recommendations?: string[];
  enterpriseMetrics?: EnterpriseMetrics;
  executiveSummary?: string;
  industryContext?: string;
  nextSteps?: string[];
}

export interface Analysis {
  readinessScore: number;
  fitScore: number;
  roiEstimate: number;
  efficiencyEstimate: number;
  keyObservations: string[];
  recommendations: string[];
}

export type PipelineState = 'idle' | 'listening' | 'processing' | 'speaking';

// Full analysis data returned from backend
export interface FullAnalysis {
  readinessScore: number;
  fitScore: number;
  roiEstimate: number;
  efficiencyEstimate: number;
  keyObservations: string[];
  recommendations: string[];
  enterpriseMetrics?: EnterpriseMetrics;
  executiveSummary?: string;
  industryContext?: string;
  nextSteps?: string[];
  // v2.1 fields
  enhancedRecommendations?: EnhancedRecommendation[];
  specificUseCases?: SpecificUseCase[];
  caseReferences?: CaseReference[];
  scoreTierInfo?: ScoreTierInfo;
}

export type ServerMessage =
  | { type: 'connected'; sessionId: string }
  | { type: 'transcription'; text: string; final: boolean }
  | { type: 'response'; text: string; processingTime: number }
  | { type: 'audio'; data: string }
  | { type: 'state'; state: PipelineState }
  | { type: 'metrics'; data: Partial<Metrics> }
  | { type: 'interrupted' }
  | { type: 'error'; message: string }
  | { type: 'analysis_complete'; data: FullAnalysis }
  | { type: 'analysis_error'; message: string }
  // FAB SME onboarding messages
  | { type: 'report'; data: FabReport }
  | { type: 'progress'; data: { currentQuestionIndex: number; totalQuestions: number } }
  | { type: 'research'; data: CompanyResearch };

// =============================================================================
// FAB SME Onboarding Types
// =============================================================================

export interface FabAnswers {
  name?: string;
  companyName?: string;
  businessDescription?: string;
  teamSize?: string;
  yearsOperating?: string;
  crossBorder?: string;
  paymentTerms?: string;
  paymentMethod?: string;
  biggestHeadache?: string;
  growthPlans?: string;
}

export interface CompanyResearch {
  sector?: string;
  approximateSize?: string;
  whatTheyDo?: string;
  source: 'live' | 'backup' | 'thin' | 'failed';
}

export interface FabRecommendation {
  product: string;
  category: string;
  reason: string;
  triggeringFact: string;
  isProactive?: boolean;
}

export interface FabReport {
  snapshot: string;
  needs: string[];
  recommendations: FabRecommendation[];
  startingPoint: string;
}

// =============================================================================
// v2.1 Types — Specific Use Cases, Impact Framing, Recommendations, Case Refs
// =============================================================================

// v2.1 specific use case with prospect data
export interface SpecificUseCase {
  name: string;
  description: string;
  painSignal: string;
  prospectData?: string;
  impactFraming?: ImpactFraming;
}

// Impact framing (operational, not financial)
export interface ImpactFraming {
  timeRecovered?: string;
  speedToOutcome?: string;
  scaleUnlocked?: string;
  errorReduction?: string;
  teamFocusShift?: string;
}

// Enhanced recommendation (3 types per v2.1)
export interface EnhancedRecommendation {
  type: 'quick_win' | 'ai_use_case' | 'strategy_call';
  title: string;
  description: string;
  icon?: string;
}

// Case reference for social proof
export interface CaseReference {
  clientName: string;
  industry: string;
  product: string;
  headline: string;
  detail: string;
  quote?: string;
  quoteAuthor?: string;
}

// v2.1 Score Tiers
export type ScoreTier = 'build_first' | 'assess_and_act' | 'fast_track';
export interface ScoreTierInfo {
  tier: ScoreTier;
  label: string;
  headline: string;
  tone: string;
  ctaLabel: string;
  ctaMessage: string;
  color: 'red' | 'amber' | 'green';
}
