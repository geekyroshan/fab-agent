import { EventEmitter } from 'events';
import { STTService, getSTTService, removeSTTService } from './stt.service.js';
import { synthesizeSpeech } from './tts.service.js';
import {
  generateResponse,
  generateGreeting,
  extractFabAnswerFromUserMessage,
} from './llm.service.js';
import { queryKnowledgeBase } from './rag.service.js';
import { generateFabReport, getQuickProgress } from './analysis.service.js';
import { researchCompany } from './research.service.js';
import {
  getLeadBySession,
  addMessage,
  getMessages,
  updateSessionStatus,
  updateFabAnswers,
  updateCompanyResearch,
  updateLead,
} from './database.service.js';
import {
  PipelineState,
  ConversationContext,
  TranscriptResult,
  FabAnswers,
  CompanyResearch,
  FabReport,
} from '../types/index.js';
import {
  FAB_QUESTIONS,
  FabQuestion,
  getQuestionByIndex,
  renderAgentPrompt,
} from '../config/question-library.js';
import { buildReflectBackPrompt } from '../config/prompts.js';

function stripMarkdownForTTS(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\n{2,}/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export class PipelineService extends EventEmitter {
  private sessionId: string;
  private state: PipelineState = 'idle';
  private sttService: STTService;
  private abortController: AbortController | null = null;
  private context: ConversationContext | null = null;
  private isProcessing = false;
  private isVoiceMode = false;
  private lastQuestionTime = 0;
  private lastQuestion = '';
  private currentGeneration = 0;
  // Tracks the index of the question the agent most recently asked the SME.
  // -1 before any question has been asked (greeting state).
  private askedQuestionIndex = -1;
  // Set true once the synthesis line + report have been sent so we don't loop.
  private reportSent = false;

  constructor(sessionId: string) {
    super();
    this.sessionId = sessionId;
    this.sttService = getSTTService(sessionId);
    this.setupSTTListeners();
  }

  private setupSTTListeners(): void {
    this.sttService.on('speechStarted', () => this.handleSpeechStarted());
    this.sttService.on('finalTranscript', (r: TranscriptResult) => this.handleFinalTranscript(r));
    this.sttService.on('error', (e: Error) => this.emit('error', e.message));
  }

  private setState(newState: PipelineState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.emit('state', newState);
    }
  }

  getState(): PipelineState {
    return this.state;
  }

  async initialize(): Promise<void> {
    const lead = getLeadBySession(this.sessionId);
    if (!lead) {
      throw new Error('Lead not found for session');
    }

    const messages = getMessages(this.sessionId);
    const history = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    this.context = {
      sessionId: this.sessionId,
      lead,
      history,
      metrics: { readiness: 0, fit: 0, roi: 0, efficiency: 0 },
    };

    // Rebuild askedQuestionIndex from what's stored (resilient to reconnects).
    const fa = lead.fabAnswers || {};
    const progress = getQuickProgress(lead, history.length);
    this.askedQuestionIndex = Math.min(progress.currentQuestionIndex, FAB_QUESTIONS.length - 1);

    this.emitProgress();

    if (history.length === 0) {
      await this.sendGreeting();
    }
  }

  private emitProgress(): void {
    if (!this.context) return;
    const progress = getQuickProgress(this.context.lead, this.context.history.length);
    this.emit('progress', {
      currentQuestionIndex: progress.currentQuestionIndex,
      totalQuestions: progress.totalQuestions,
    });
  }

  private async sendGreeting(): Promise<void> {
    if (!this.context) return;
    const generation = ++this.currentGeneration;
    this.isProcessing = true;
    this.setState('processing');

    try {
      const greeting = await generateGreeting(this.context.lead);
      if (!this.isProcessing || this.currentGeneration !== generation) return;

      addMessage({
        sessionId: this.sessionId,
        role: 'assistant',
        content: greeting,
        inputType: 'text',
      });
      this.context.history.push({ role: 'assistant', content: greeting });
      // The greeting embeds Q1.
      this.askedQuestionIndex = 0;
      this.emit('response', greeting, 0);
      this.emitProgress();

      if (this.isVoiceMode) {
        if (!this.isProcessing || this.currentGeneration !== generation) return;
        const audio = await synthesizeSpeech(stripMarkdownForTTS(greeting));
        if (this.currentGeneration === generation) {
          this.emit('audio', audio.toString('base64'));
        }
      }
    } catch (err) {
      console.error('Greeting failed:', err);
      this.emit('error', 'Failed to generate greeting');
    } finally {
      if (this.isProcessing && this.currentGeneration === generation) {
        this.isProcessing = false;
        this.setState('idle');
      }
    }
  }

  processAudioChunk(chunk: Buffer): void {
    if (this.state === 'idle' || this.state === 'listening') {
      this.sttService.processAudioChunk(chunk);
      if (this.state === 'idle') {
        this.setState('listening');
      }
    }
  }

  private handleSpeechStarted(): void {
    if (this.state === 'speaking' || this.isProcessing) {
      this.interrupt();
    }
    this.emit('speechStarted');
  }

  private async handleFinalTranscript(result: TranscriptResult): Promise<void> {
    const text = result.text.trim();
    if (!text) return;

    const now = Date.now();
    if (text === this.lastQuestion && now - this.lastQuestionTime < 3000) {
      console.log('Duplicate utterance ignored');
      return;
    }
    this.lastQuestion = text;
    this.lastQuestionTime = now;

    this.emit('transcription', text, true);
    await this.processText(text, 'voice');
  }

  async processText(text: string, inputType: 'voice' | 'text' = 'text'): Promise<void> {
    if (!this.context) {
      await this.initialize();
    }
    if (this.isProcessing) {
      this.interrupt();
    }

    const generation = ++this.currentGeneration;
    const localAbort = new AbortController();
    this.abortController = localAbort;
    this.isProcessing = true;
    this.setState('processing');

    const startTime = Date.now();

    try {
      // 1) Save user message.
      addMessage({
        sessionId: this.sessionId,
        role: 'user',
        content: text,
        inputType,
      });
      this.context!.history.push({ role: 'user', content: text });

      if (inputType === 'voice') {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, 500);
          localAbort.signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new DOMException('Aborted', 'AbortError'));
          }, { once: true });
        });
        if (localAbort.signal.aborted) return;
      }

      // 2) Extract the FAB answer for the question we just asked.
      const askedQuestion = getQuestionByIndex(this.askedQuestionIndex);
      let extractionSucceeded = false;
      if (askedQuestion) {
        const patch = await extractFabAnswerFromUserMessage(askedQuestion, text);
        if (Object.keys(patch).length > 0) {
          const merged = updateFabAnswers(this.sessionId, patch);
          this.context!.lead.fabAnswers = merged;
          extractionSucceeded = true;

          // Backfill the canonical Lead.name/company columns from the extracted
          // FabAnswers so downstream consumers (PDF, admin views, email
          // templates) see the right values without having to dig into the
          // fab_answers JSON blob.
          const leadPatch: Partial<{ name: string; company: string }> = {};
          if (patch.name && patch.name.trim()) {
            leadPatch.name = patch.name.trim();
          }
          if (patch.companyName && patch.companyName.trim()) {
            leadPatch.company = patch.companyName.trim();
          }
          if (Object.keys(leadPatch).length > 0) {
            try {
              updateLead(this.sessionId, leadPatch);
              if (leadPatch.name) this.context!.lead.name = leadPatch.name;
              if (leadPatch.company) this.context!.lead.company = leadPatch.company;
            } catch (err) {
              console.warn('updateLead backfill failed (non-fatal):', err);
            }
          }
        }
      }
      if (localAbort.signal.aborted) return;

      // 3) Post-Q2 special case: kick off company research before the next reply.
      // Only fire the research call when we actually captured a company name —
      // otherwise we'd be researching the literal user reply ("hi") and surfacing
      // an honest-but-pointless "thin" research event.
      if (askedQuestion?.id === 'q2_company' && extractionSucceeded) {
        const companyName = this.context!.lead.fabAnswers?.companyName || text.trim();
        try {
          const research = await researchCompany(companyName);
          updateCompanyResearch(this.sessionId, research);
          this.context!.lead.companyResearch = research;
          this.emit('research', research);
        } catch (err) {
          console.error('researchCompany failed (non-fatal):', err);
          const failed: CompanyResearch = { source: 'failed' };
          updateCompanyResearch(this.sessionId, failed);
          this.context!.lead.companyResearch = failed;
          this.emit('research', failed);
        }
        if (localAbort.signal.aborted) return;
      }

      // 4) Decide what the assistant should say next.
      // If the extraction failed (junk answer like "hi"), do NOT advance — re-ask
      // the same question so the conversation stays on the rails. This also keeps
      // `isLastQuestionAnswered` honest: the report can only fire when each of the
      // required slots has been filled in order.
      const advance = extractionSucceeded || !askedQuestion;
      const nextQuestionIndex = advance
        ? this.askedQuestionIndex + 1
        : this.askedQuestionIndex;
      const isLastQuestionAnswered =
        advance &&
        (this.askedQuestionIndex >= FAB_QUESTIONS.length - 1
          || (this.askedQuestionIndex >= 7 && this.shouldSkipOptional()));

      let assistantReply: string;

      if (isLastQuestionAnswered && !this.reportSent) {
        // Synthesis line + generate the report.
        assistantReply = 'Putting your setup together. One moment.';
      } else {
        const nextQuestion = getQuestionByIndex(nextQuestionIndex);
        // Build LLM reply that combines optional reflect-back + next question.
        const ragContext = await queryKnowledgeBase(text, 4, 0.2);
        if (localAbort.signal.aborted) return;

        const reply = await generateResponse(
          text,
          this.context!,
          ragContext,
          {
            signal: localAbort.signal,
            isVoice: inputType === 'voice',
            fabAnswers: this.context!.lead.fabAnswers,
            currentQuestionIndex: nextQuestionIndex,
            companyResearch: this.context!.lead.companyResearch,
            // When extraction failed we are re-asking the same question.
            // The prompt builder uses this to enforce a rephrased ask
            // (never repeat verbatim) and the per-question probing rule.
            isReasking: !advance,
          }
        );

        // Defensive: if the LLM forgot to ask the actual next question, append it verbatim.
        // Skip this defensive append when we're re-asking — the LLM is supposed to
        // rephrase, not append the original question on the end.
        if (advance && nextQuestion && !this.replyContainsQuestion(reply, nextQuestion)) {
          const companyName = this.context!.lead.fabAnswers?.companyName;
          assistantReply = `${reply.trim()} ${renderAgentPrompt(nextQuestion, companyName)}`;
        } else {
          assistantReply = reply.trim();
        }
        // Cap so post-report follow-up messages don't push the index past the script.
        // Only advance when we actually accepted an answer (see `advance` above).
        if (advance) {
          this.askedQuestionIndex = Math.min(nextQuestionIndex, FAB_QUESTIONS.length - 1);
        }
      }

      if (localAbort.signal.aborted) return;

      const processingTime = Date.now() - startTime;

      addMessage({
        sessionId: this.sessionId,
        role: 'assistant',
        content: assistantReply,
        inputType: 'text',
      });
      this.context!.history.push({ role: 'assistant', content: assistantReply });

      this.emit('response', assistantReply, processingTime);
      this.emitProgress();

      // 5) If we just sent the synthesis line, generate + emit the report.
      if (isLastQuestionAnswered && !this.reportSent) {
        this.reportSent = true;
        try {
          const report: FabReport = await generateFabReport(this.sessionId, this.context!.lead);
          if (this.currentGeneration === generation) {
            this.emit('report', report);
          }
        } catch (err) {
          console.error('Report generation failed:', err);
          this.emit('error', 'Report generation failed');
        }
      }

      // 6) Voice TTS (unchanged behaviour).
      if (this.isVoiceMode) {
        if (localAbort.signal.aborted || this.currentGeneration !== generation) return;
        this.setState('speaking');
        this.sttService.setTTSPlaying(true);

        try {
          const audio = await synthesizeSpeech(stripMarkdownForTTS(assistantReply), {
            signal: localAbort.signal,
          });
          if (this.currentGeneration === generation && !localAbort.signal.aborted) {
            this.emit('audio', audio.toString('base64'));
          }
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            console.warn('[Pipeline] TTS failed:', err.message);
          }
        }

        const wordCount = assistantReply.split(/\s+/).length;
        const estimatedMs = Math.max(1500, (wordCount / 3.0) * 1000);
        setTimeout(() => {
          if (this.currentGeneration === generation) {
            this.sttService.setTTSPlaying(false);
          }
        }, estimatedMs);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('[Pipeline] Request aborted (barge-in)');
        return;
      }
      console.error('[Pipeline] Error:', error);
      this.emit('error', error.message || 'An error occurred');
    } finally {
      if (this.currentGeneration === generation) {
        this.isProcessing = false;
        this.abortController = null;
        this.setState(this.isVoiceMode ? 'listening' : 'idle');
      }
    }
  }

  /**
   * Heuristic: skip Q9 (growth) if the user has already given a strong headache
   * answer. Keeps the demo flow tight at 8 questions for most paths.
   */
  private shouldSkipOptional(): boolean {
    const headache = this.context?.lead.fabAnswers?.biggestHeadache || '';
    return headache.trim().length > 10;
  }

  private replyContainsQuestion(reply: string, q: FabQuestion): boolean {
    // Loose detection: reply ends with a question mark.
    return /\?\s*$/.test(reply.trim());
  }

  private splitIntoSentences(text: string): string[] {
    const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g) || [text];
    return sentences.map((s) => s.trim()).filter((s) => s.length > 0);
  }

  interrupt(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.currentGeneration++;
    this.sttService.setTTSPlaying(false);
    this.sttService.interrupt();
    this.isProcessing = false;
    this.emit('interrupted');
    this.setState('listening');
  }

  startRecording(): void {
    this.isVoiceMode = true;
    this.setState('listening');
    this.sttService.reset();
  }

  stopRecording(): void {
    this.isVoiceMode = false;
    this.sttService.reset();
    this.sttService.setTTSPlaying(false);
    if (!this.isProcessing) {
      this.setState('idle');
    }
  }

  /** Manually triggered analysis (e.g. from a frontend "finalise" button). */
  async analyze(): Promise<FabReport> {
    if (!this.context) {
      await this.initialize();
    }
    const report = await generateFabReport(this.sessionId, this.context!.lead);
    this.emit('report', report);
    return report;
  }

  cleanup(): void {
    this.interrupt();
    removeSTTService(this.sessionId);
    updateSessionStatus(this.sessionId, 'completed');
    this.removeAllListeners();
  }
}

const instances = new Map<string, PipelineService>();

export function getPipelineService(sessionId: string): PipelineService {
  if (!instances.has(sessionId)) {
    instances.set(sessionId, new PipelineService(sessionId));
  }
  return instances.get(sessionId)!;
}

export function removePipelineService(sessionId: string): void {
  const instance = instances.get(sessionId);
  if (instance) {
    instance.cleanup();
    instances.delete(sessionId);
  }
}
