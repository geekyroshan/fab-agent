import { useEffect, useCallback, useRef, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useSessionStore } from '../stores/sessionStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { useMicrophone } from '../hooks/useMicrophone';
import { useSession } from '../hooks/useSession';
import { ChatMessage } from '../components/ChatMessage';
import { ChatInput } from '../components/ChatInput';
import { VoiceButton } from '../components/VoiceButton';
import { TypingIndicator } from '../components/TypingIndicator';
import { FabReportCard } from '../components/FabReportCard';
import { generateFabPDFReport } from '../utils/pdfGenerator';

export function ConsultationPage() {
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isEndingSession, setIsEndingSession] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const {
    sessionId,
    lead,
    messages,
    pipelineState,
    isConnected,
    currentTranscript,
    setVoiceModeActive,
    reset,
    fabReport,
    companyResearch,
    currentQuestionIndex,
    totalQuestions,
  } = useSessionStore();

  const { sendText, sendAudio, sendControl, stopAudio } = useWebSocket();
  const { endSession } = useSession();

  // Voice mode with continuous streaming
  const { isActive: isVoiceModeActive, toggleVoiceMode } = useMicrophone({
    onAudioData: (data) => {
      sendAudio(data);
    },
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentTranscript, fabReport]);

  // Handle voice mode toggle
  const handleVoiceToggle = useCallback(() => {
    if (isVoiceModeActive) {
      sendControl('stop');
      stopAudio();
      setVoiceModeActive(false);
    } else {
      sendControl('start');
      setVoiceModeActive(true);
    }
    toggleVoiceMode();
  }, [isVoiceModeActive, toggleVoiceMode, sendControl, stopAudio, setVoiceModeActive]);

  // Compute the canonical company name. Priority:
  //   1. The companyName the backend stuffed onto the report event payload
  //      (it backfilled lead.company in SQL when Q2 was captured).
  //   2. The fabAnswers store, if the frontend captured it.
  //   3. The initial lead.company from /api/session/start (usually empty).
  const resolvedCompanyName = useCallback((): string | undefined => {
    const fromReport = (fabReport as unknown as { companyName?: string } | null)?.companyName;
    const fromAnswers = useSessionStore.getState().fabAnswers.companyName;
    return fromReport || fromAnswers || lead?.company || undefined;
  }, [fabReport, lead]);

  // Handle PDF export — FAB report PDF
  const handleExport = useCallback(async () => {
    if (isExporting || !lead || !sessionId || !fabReport) return;

    setIsExporting(true);
    try {
      generateFabPDFReport({
        lead,
        report: fabReport,
        sessionId,
        generatedAt: new Date().toISOString(),
        companyName: resolvedCompanyName(),
      });
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, lead, sessionId, fabReport, resolvedCompanyName]);

  // Handle end session (optionally with PDF download)
  const handleEndSession = useCallback(
    async (downloadPdf = false) => {
      if (isEndingSession || !lead || !sessionId) return;

      setIsEndingSession(true);
      try {
        if (downloadPdf && fabReport) {
          generateFabPDFReport({
            lead,
            report: fabReport,
            sessionId,
            generatedAt: new Date().toISOString(),
            companyName: resolvedCompanyName(),
          });
        }

        await endSession();

        if (isVoiceModeActive) {
          sendControl('stop');
          stopAudio();
          setVoiceModeActive(false);
        }

        reset();
        navigate('/');
      } catch (error) {
        console.error('End session failed:', error);
      } finally {
        setIsEndingSession(false);
        setShowEndConfirm(false);
      }
    },
    [
      isEndingSession,
      lead,
      sessionId,
      fabReport,
      endSession,
      isVoiceModeActive,
      sendControl,
      stopAudio,
      setVoiceModeActive,
      reset,
      navigate,
      resolvedCompanyName,
    ]
  );

  const isProcessing = pipelineState === 'processing';
  const isDisabled = isProcessing || !isConnected;

  if (!sessionId || !lead) {
    return <Navigate to="/" replace />;
  }

  // Progress (clamped)
  const progressTotal = Math.max(totalQuestions, 1);
  const progressIndex = Math.min(Math.max(currentQuestionIndex, 0), progressTotal);
  const progressPct = (progressIndex / progressTotal) * 100;

  // Treat `fabReport` as "real" only when it has the minimum required structure.
  // An empty object or partial payload should never reveal the report card.
  // This is a defence-in-depth check: the backend should only ever emit a fully
  // formed report at the end of the flow, but if anything upstream goes wrong
  // we'd rather show nothing than a half-rendered card.
  const hasValidReport =
    !!fabReport &&
    typeof fabReport.snapshot === 'string' &&
    fabReport.snapshot.trim().length > 0 &&
    Array.isArray(fabReport.recommendations) &&
    fabReport.recommendations.length > 0;

  // Show reflect-back pill briefly when research arrives but no report yet
  const showReflectBackPill =
    !!companyResearch && companyResearch.source !== 'failed' && !hasValidReport;

  const companyName = resolvedCompanyName();

  return (
    <div className="h-[100dvh] flex flex-col bg-fab-cream overflow-hidden">
      {/* Header */}
      <header className="h-14 lg:h-16 flex items-center justify-between px-4 lg:px-6 border-b border-gray-200 bg-fab-navy text-white shrink-0">
        <div className="flex items-center gap-3">
          <img
            src="/fab-logo.svg"
            alt="FAB"
            className="h-7 lg:h-8 w-auto brightness-0 invert"
          />
          <span className="hidden sm:inline text-[11px] tracking-[0.18em] text-white/70">
            SME ONBOARDING
          </span>
        </div>

        <div className="flex items-center gap-2 lg:gap-3">
          {isVoiceModeActive && (
            <span className="hidden sm:flex text-[10px] bg-white/15 px-2 py-1 rounded-full items-center gap-1.5 animate-pulse">
              <span className="w-1.5 h-1.5 bg-white rounded-full" />
              <span className="hidden md:inline">VOICE ACTIVE</span>
            </span>
          )}
          <a
            href="https://cal.com/fab/sme"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] lg:text-xs bg-white text-fab-navy px-3 py-1.5 rounded hover:bg-fab-cream transition-colors font-medium"
          >
            <span className="hidden sm:inline">Talk to a Relationship Manager</span>
            <span className="sm:hidden">Talk to RM</span>
          </a>
          <button
            onClick={() => setShowEndConfirm(true)}
            className="text-[11px] lg:text-xs bg-white/10 text-white px-2 py-1 lg:px-3 lg:py-1.5 rounded hover:bg-white/20 transition-colors flex items-center gap-1"
          >
            <span className="hidden sm:inline">End</span>
            <span className="sm:hidden">End</span>
          </button>
        </div>
      </header>

      {/* Progress bar */}
      <div className="shrink-0 bg-white border-b border-gray-200 px-4 lg:px-6 py-2.5">
        <div className="flex items-center justify-between text-[11px] text-fab-muted mb-1.5">
          <span className="tracking-wider">
            {hasValidReport
              ? 'YOUR FAB SETUP'
              : `QUESTION ${Math.min(progressIndex + 1, progressTotal)} OF ${progressTotal}`}
          </span>
          {!hasValidReport && (
            <span className="text-fab-navy font-medium">
              {Math.round(progressPct)}%
            </span>
          )}
        </div>
        <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-fab-navy transition-all duration-500 ease-out"
            style={{ width: `${hasValidReport ? 100 : progressPct}%` }}
          />
        </div>
      </div>

      {/* Main chat area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 lg:px-8 py-4 lg:py-6 overscroll-contain bg-fab-cream">
          <div className="max-w-3xl mx-auto">
            {messages.map((message, index) => (
              <ChatMessage
                key={message.id}
                message={message}
                index={index}
                showMuteButton={isVoiceModeActive}
                onMuteAudio={() => {
                  sendControl('stop_speaking');
                  stopAudio();
                }}
              />
            ))}

            {/* Current transcript (interim) */}
            {currentTranscript && (
              <div className="mb-3 lg:mb-6 text-sm text-fab-muted italic">
                "{currentTranscript}"
              </div>
            )}

            {/* Reflect-back pill */}
            {showReflectBackPill && (
              <div className="my-4 flex justify-center">
                <span className="inline-flex items-center gap-2 text-xs text-fab-navy bg-white border border-fab-navy/20 rounded-full px-3 py-1.5 shadow-sm">
                  <span className="w-1.5 h-1.5 bg-fab-navy rounded-full animate-pulse" />
                  Putting your setup together...
                </span>
              </div>
            )}

            {/* Typing indicator */}
            {isProcessing && <TypingIndicator />}

            {/* Final report (inline at end of chat) — only when report is fully formed */}
            {hasValidReport && fabReport && (
              <div className="mt-6 mb-6">
                <FabReportCard report={fabReport} companyName={companyName} />

                <div className="mt-5 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={handleExport}
                    disabled={isExporting}
                    className="
                      flex-1 inline-flex items-center justify-center gap-2
                      bg-fab-navy text-white font-medium px-5 py-3 rounded-md
                      hover:bg-fab-navy-dark transition-colors
                      disabled:opacity-60 disabled:cursor-not-allowed
                    "
                  >
                    {isExporting ? 'Preparing PDF...' : 'Download PDF report'}
                  </button>
                  <a
                    href="https://cal.com/fab/sme"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="
                      flex-1 inline-flex items-center justify-center gap-2
                      bg-white text-fab-navy font-medium px-5 py-3 rounded-md
                      border border-fab-navy/20 hover:bg-fab-cream transition-colors
                    "
                  >
                    Talk to a Relationship Manager
                  </a>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Bottom Area — voice + input */}
        <div className="shrink-0 border-t border-gray-200 bg-white">
          <div className="max-w-3xl mx-auto px-3 lg:px-6 py-2.5 flex items-center gap-3">
            <VoiceButton
              isVoiceModeActive={isVoiceModeActive}
              pipelineState={pipelineState}
              onToggle={handleVoiceToggle}
              disabled={!isConnected}
              compact
            />
            <div className="flex-1">
              <ChatInput onSubmit={sendText} disabled={isDisabled} />
            </div>
          </div>
          {pipelineState === 'speaking' && (
            <div className="max-w-3xl mx-auto px-3 lg:px-6 pb-2 flex justify-end">
              <button
                onClick={() => {
                  sendControl('stop_speaking');
                  stopAudio();
                }}
                className="text-[11px] bg-fab-red/10 text-fab-red px-3 py-1 rounded hover:bg-fab-red/20 transition-colors"
              >
                Stop speaking
              </button>
            </div>
          )}
        </div>
      </main>

      {/* End Session Confirmation Modal */}
      {showEndConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl border border-gray-200">
            <h3 className="text-lg font-semibold mb-2 text-fab-navy">
              End onboarding?
            </h3>
            <p className="text-sm text-fab-muted mb-6 leading-relaxed">
              You can download your FAB setup report as a PDF.
            </p>

            <div className="flex flex-col gap-3">
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowEndConfirm(false)}
                  disabled={isEndingSession}
                  className="px-4 py-2 text-sm bg-fab-cream text-fab-text rounded hover:bg-fab-cream/70 transition-colors disabled:opacity-50"
                >
                  Continue
                </button>
                <button
                  onClick={() => handleEndSession(false)}
                  disabled={isEndingSession}
                  className="px-4 py-2 text-sm bg-fab-red/10 text-fab-red rounded hover:bg-fab-red/20 transition-colors disabled:opacity-70"
                >
                  {isEndingSession ? 'Ending...' : 'End'}
                </button>
              </div>
              <button
                onClick={() => handleEndSession(true)}
                disabled={isEndingSession || !fabReport}
                className="
                  w-full px-4 py-2.5 text-sm bg-fab-navy text-white rounded
                  hover:bg-fab-navy-dark transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed
                  flex items-center justify-center gap-2
                "
                title={!fabReport ? 'Report not ready yet' : undefined}
              >
                {isEndingSession ? 'Preparing report...' : 'Download PDF & end'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
