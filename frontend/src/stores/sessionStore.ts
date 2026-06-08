import { create } from 'zustand';
import {
  Lead,
  Message,
  Metrics,
  PipelineState,
  FullAnalysis,
  FabAnswers,
  CompanyResearch,
  FabReport,
} from '../types';

interface SessionState {
  sessionId: string | null;
  lead: Lead | null;
  messages: Message[];
  metrics: Metrics;
  pipelineState: PipelineState;
  isConnected: boolean;
  currentTranscript: string;
  error: string | null;
  analysisComplete: boolean;
  lastAnalysisMessageCount: number;
  analysisData: FullAnalysis | null;
  minInteractionsReached: boolean;
  isVoiceModeActive: boolean;

  // FAB onboarding state
  fabAnswers: FabAnswers;
  companyResearch: CompanyResearch | null;
  fabReport: FabReport | null;
  currentQuestionIndex: number;
  totalQuestions: number;

  // Actions
  setSessionId: (id: string) => void;
  setLead: (lead: Lead) => void;
  addMessage: (message: Message) => void;
  updateMetrics: (metrics: Partial<Metrics>) => void;
  setPipelineState: (state: PipelineState) => void;
  setConnected: (connected: boolean) => void;
  setCurrentTranscript: (transcript: string) => void;
  setError: (error: string | null) => void;
  setAnalysisComplete: (complete: boolean, messageCount?: number) => void;
  setAnalysisData: (data: FullAnalysis | null) => void;
  setMinInteractionsReached: (reached: boolean) => void;
  setVoiceModeActive: (active: boolean) => void;

  // FAB actions
  setFabAnswers: (answers: Partial<FabAnswers>) => void;
  setCompanyResearch: (research: CompanyResearch | null) => void;
  setFabReport: (report: FabReport | null) => void;
  setProgress: (currentQuestionIndex: number, totalQuestions: number) => void;

  reset: () => void;
}

const initialMetrics: Metrics = {
  readiness: 0,
  fit: 0,
  roi: 0,
  efficiency: 0,
  keyObservations: [],
  recommendations: [],
};

const initialFabAnswers: FabAnswers = {};
const initialTotalQuestions = 8;

export const useSessionStore = create<SessionState>((set) => ({
  sessionId: null,
  lead: null,
  messages: [],
  metrics: initialMetrics,
  pipelineState: 'idle',
  isConnected: false,
  currentTranscript: '',
  error: null,
  analysisComplete: false,
  lastAnalysisMessageCount: 0,
  analysisData: null,
  minInteractionsReached: false,
  isVoiceModeActive: false,

  // FAB initial state
  fabAnswers: initialFabAnswers,
  companyResearch: null,
  fabReport: null,
  currentQuestionIndex: 0,
  totalQuestions: initialTotalQuestions,

  // Setting a new sessionId implies a brand-new onboarding. Wipe any FAB
  // artefacts (report, research, answers, progress) from a previous session
  // so the frontend never carries a stale report into a fresh chat. This is
  // the in-memory equivalent of "clearing persist storage" — without it, an
  // SPA navigation back to /onboarding then forward into a new chat would
  // briefly render the previous report before the WS reconnected.
  setSessionId: (id) =>
    set((state) => {
      if (state.sessionId === id) {
        return { sessionId: id };
      }
      return {
        sessionId: id,
        messages: [],
        metrics: initialMetrics,
        pipelineState: 'idle',
        currentTranscript: '',
        error: null,
        analysisComplete: false,
        lastAnalysisMessageCount: 0,
        analysisData: null,
        minInteractionsReached: false,
        isVoiceModeActive: false,
        fabAnswers: initialFabAnswers,
        companyResearch: null,
        fabReport: null,
        currentQuestionIndex: 0,
        totalQuestions: initialTotalQuestions,
      };
    }),

  setLead: (lead) => set({ lead }),

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  updateMetrics: (metrics) =>
    set((state) => ({
      metrics: { ...state.metrics, ...metrics },
    })),

  setPipelineState: (pipelineState) => set({ pipelineState }),

  setConnected: (isConnected) => set({ isConnected }),

  setCurrentTranscript: (currentTranscript) => set({ currentTranscript }),

  setError: (error) => set({ error }),

  setAnalysisComplete: (complete, messageCount) =>
    set((state) => ({
      analysisComplete: complete,
      lastAnalysisMessageCount: messageCount ?? state.lastAnalysisMessageCount,
    })),

  setAnalysisData: (data) => set({ analysisData: data }),

  setMinInteractionsReached: (reached) => set({ minInteractionsReached: reached }),

  setVoiceModeActive: (active) => set({ isVoiceModeActive: active }),

  // FAB setters (immutable updates)
  setFabAnswers: (answers) =>
    set((state) => ({
      fabAnswers: { ...state.fabAnswers, ...answers },
    })),

  setCompanyResearch: (companyResearch) => set({ companyResearch }),

  setFabReport: (fabReport) => set({ fabReport }),

  setProgress: (currentQuestionIndex, totalQuestions) =>
    set({ currentQuestionIndex, totalQuestions }),

  reset: () =>
    set({
      sessionId: null,
      lead: null,
      messages: [],
      metrics: initialMetrics,
      pipelineState: 'idle',
      isConnected: false,
      currentTranscript: '',
      error: null,
      analysisComplete: false,
      lastAnalysisMessageCount: 0,
      analysisData: null,
      minInteractionsReached: false,
      isVoiceModeActive: false,
      fabAnswers: initialFabAnswers,
      companyResearch: null,
      fabReport: null,
      currentQuestionIndex: 0,
      totalQuestions: initialTotalQuestions,
    }),
}));
