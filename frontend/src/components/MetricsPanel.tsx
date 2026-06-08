import { useState, useEffect } from 'react';
import { Metrics, StrategicFitComponents, ScoreBandInfo } from '../types';

interface MetricsPanelProps {
  metrics: Metrics;
  isConnected: boolean;
  onExport: () => void;
  isExporting?: boolean;
  insightsReady?: boolean;
  minInteractionsReached?: boolean;
  onEndSession?: () => void;
}

export function MetricsPanel({ metrics, isConnected, onExport, isExporting = false, insightsReady = true, minInteractionsReached = false, onEndSession }: MetricsPanelProps) {
  const enterprise = metrics.enterpriseMetrics;

  // Conversion trigger state for call-to-action prompt
  const [showConversionPrompt, setShowConversionPrompt] = useState(false);
  const [conversionMessage, setConversionMessage] = useState('');

  // Check for conversion triggers (per Spec v2 Section 5.1)
  useEffect(() => {
    if (enterprise?.conversionTriggers && minInteractionsReached) {
      const triggers = enterprise.conversionTriggers;
      if (triggers.founderWithClearPain) {
        setConversionMessage('You have the clarity and authority to move on this. Click Book Strategy Call to set up a focused 30-minute session.');
        setShowConversionPrompt(true);
      } else if (triggers.highStrategicFit) {
        setConversionMessage("Based on what you're telling me, there's strong alignment here. Click Book Strategy Call to explore this further.");
        setShowConversionPrompt(true);
      } else if (triggers.revenueImpact) {
        setConversionMessage("This sounds like it's directly affecting your bottom line. A focused strategy call could help map a path forward.");
        setShowConversionPrompt(true);
      } else if (triggers.urgencyDetected) {
        setConversionMessage("I can hear this is pressing. Click Book Strategy Call to schedule time with our AI Readiness Experts.");
        setShowConversionPrompt(true);
      }
    }
  }, [enterprise?.conversionTriggers, minInteractionsReached]);

  // Get Strategic Fit Score (PRIMARY qualification metric per Spec v2)
  const strategicFitScore = enterprise?.strategicFitScore ?? metrics.fit;

  // Get Score Band Info (per Spec v2)
  const scoreBandInfo = enterprise?.scoreBandInfo ?? getDefaultScoreBandInfo(strategicFitScore);

  // Get score band color (per Spec v2: 0-30 Red, 31-50 Amber, 51-70 Green, 71-100 Blue)
  const getScoreBandColor = (score: number): string => {
    if (score <= 30) return 'red';
    if (score <= 50) return 'amber';
    if (score <= 70) return 'green';
    return 'blue';
  };

  const scoreBandColor = getScoreBandColor(strategicFitScore);

  return (
    <div className="h-full flex flex-col p-4 lg:p-5 space-y-3 lg:space-y-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[9px] lg:text-[10px] text-allys-muted tracking-widest font-medium">AI READINESS ASSESSMENT</span>
        <span
          className={`
            flex items-center gap-1 lg:gap-1.5 text-[9px] lg:text-[10px] px-1.5 lg:px-2 py-0.5 rounded
            ${isConnected ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}
          `}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
          {isConnected ? 'LIVE' : 'OFFLINE'}
        </span>
      </div>

      {/* Conversion Prompt - Slide-in notification (per Spec v2 Section 5.1) */}
      {showConversionPrompt && (
        <div className="bg-gradient-to-r from-green-900/40 to-emerald-900/40 border border-green-500/50 rounded-lg p-2.5 lg:p-3 animate-pulse-once">
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse mt-0.5 shrink-0" />
            <span className="text-[11px] lg:text-xs text-green-400 font-medium leading-relaxed">{conversionMessage}</span>
          </div>
          <a
            href="https://cal.com/allysai/30min"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 block w-full py-1.5 text-center text-[11px] lg:text-xs font-medium bg-green-500 hover:bg-green-400 text-black rounded transition-colors"
          >
            Book Strategy Call
          </a>
        </div>
      )}

      {/* Hero Score Section - STRATEGIC FIT SCORE (Item 4: more prominent) */}
      <div className="bg-allys-dark/50 p-3 lg:p-4 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] lg:text-[10px] text-allys-muted tracking-wider font-semibold">STRATEGIC FIT SCORE</span>
          {minInteractionsReached && scoreBandInfo && (
            <span className={`text-[9px] lg:text-[10px] font-medium px-1.5 lg:px-2 py-0.5 rounded ${
              scoreBandColor === 'blue' ? 'bg-blue-500/20 text-blue-400' :
              scoreBandColor === 'green' ? 'bg-green-500/20 text-green-400' :
              scoreBandColor === 'amber' ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-red-500/20 text-red-400'
            }`}>
              {scoreBandInfo.band}
            </span>
          )}
        </div>
        <StrategicFitGauge
          score={minInteractionsReached ? strategicFitScore : 0}
          isLoading={!minInteractionsReached}
          components={enterprise?.strategicFitComponents}
        />
        {minInteractionsReached && scoreBandInfo && (
          <div className="mt-2 lg:mt-3 text-[11px] lg:text-xs text-allys-text text-center">
            {scoreBandInfo.headline}
          </div>
        )}
      </div>

      {/* Opportunity Snapshot (per Spec v2 Section D) */}
      {minInteractionsReached && enterprise?.opportunitySnapshot && (
        <div className="bg-allys-dark/50 p-2.5 lg:p-3 rounded-lg">
          <div className="text-[9px] lg:text-[10px] text-allys-muted tracking-wider mb-2">OPPORTUNITY SNAPSHOT</div>
          <div className="grid grid-cols-2 gap-1.5 lg:gap-2">
            <OpportunityMetric
              label="ROI Potential"
              value={enterprise.opportunitySnapshot.roiPotential}
              color={enterprise.opportunitySnapshot.roiPotential === 'Very High' ? 'green' :
                     enterprise.opportunitySnapshot.roiPotential === 'High' ? 'blue' : 'gray'}
            />
            <OpportunityMetric
              label="Est. Impact"
              value={`${enterprise.opportunitySnapshot.estimatedImpact} annual value`}
              color="green"
            />
            <OpportunityMetric
              label="Time to Results"
              value={enterprise.opportunitySnapshot.timeToFirstResults}
            />
            <OpportunityMetric
              label="Payback Speed"
              value={enterprise.opportunitySnapshot.paybackSpeed}
            />
          </div>
        </div>
      )}

      {/* Risk Assessment */}
      {minInteractionsReached && enterprise && (
        <div className="bg-allys-dark/50 p-2.5 lg:p-3 rounded-lg">
          <div className="text-[9px] lg:text-[10px] text-allys-muted tracking-wider mb-1.5 lg:mb-2">RISK ASSESSMENT</div>
          <div className="grid grid-cols-3 gap-1.5 lg:gap-2">
            <RiskIndicator label="Implementation" level={enterprise.implementationRisk || 'Medium'} />
            <RiskIndicator label="Data" level={enterprise.dataReadinessRisk || 'Medium'} />
            <RiskIndicator label="Adoption" level={enterprise.adoptionRisk || 'Medium'} />
          </div>
        </div>
      )}

      {/* Key Observations */}
      <div className="shrink-0">
        <div className="text-[9px] lg:text-[10px] text-allys-muted tracking-wider mb-1.5 lg:mb-2">KEY INSIGHTS</div>
        <div className="space-y-1.5 lg:space-y-2 max-h-24 lg:max-h-28 overflow-y-auto pr-1">
          {minInteractionsReached && metrics.keyObservations && metrics.keyObservations.length > 0 ? (
            metrics.keyObservations.slice(0, 3).map((obs, i) => (
              <div key={i} className="text-[11px] lg:text-xs text-allys-text leading-relaxed border-l-2 border-green-500/50 pl-2">
                {obs}
              </div>
            ))
          ) : (
            <div className="text-[11px] lg:text-xs text-allys-muted italic">
              Continue the conversation to unlock insights...
            </div>
          )}
        </div>
      </div>

      {/* CTA Section (per Spec v2 Section F) */}
      {minInteractionsReached && scoreBandInfo && (
        <div className={`p-2.5 lg:p-3 rounded-lg border ${
          scoreBandColor === 'blue' ? 'bg-blue-900/20 border-blue-500/30' :
          scoreBandColor === 'green' ? 'bg-green-900/20 border-green-500/30' :
          scoreBandColor === 'amber' ? 'bg-yellow-900/20 border-yellow-500/30' :
          'bg-red-900/20 border-red-500/30'
        }`}>
          <p className="text-[11px] lg:text-xs text-allys-text mb-2">{scoreBandInfo.ctaMessage}</p>
          <a
            href="https://cal.com/allysai/30min"
            target="_blank"
            rel="noopener noreferrer"
            className={`block w-full py-2 text-center text-[11px] lg:text-xs font-medium rounded transition-colors ${
              scoreBandColor === 'blue' ? 'bg-blue-500 hover:bg-blue-400 text-white' :
              scoreBandColor === 'green' ? 'bg-green-500 hover:bg-green-400 text-black' :
              scoreBandColor === 'amber' ? 'bg-yellow-500 hover:bg-yellow-400 text-black' :
              'bg-red-500 hover:bg-red-400 text-white'
            }`}
          >
            Book Strategy Call
          </a>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-2 pt-1 lg:pt-2">
        <button
          onClick={onExport}
          disabled={isExporting || !insightsReady}
          className={`w-full py-2 lg:py-2.5 px-3 lg:px-4 rounded font-medium text-xs lg:text-sm transition-colors flex items-center justify-center gap-2 ${
            insightsReady
              ? 'bg-white text-black hover:bg-gray-100 disabled:opacity-70'
              : 'bg-allys-gray text-allys-muted cursor-not-allowed'
          }`}
        >
          {isExporting ? (
            <>
              <svg className="w-3.5 h-3.5 lg:w-4 lg:h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Generating Report...
            </>
          ) : !insightsReady ? (
            <>
              <svg className="w-3.5 h-3.5 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Continue to Unlock Report
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export AI Readiness Report
            </>
          )}
        </button>

        {onEndSession && (
          <button
            onClick={onEndSession}
            className="w-full py-1.5 lg:py-2 px-3 lg:px-4 text-[11px] lg:text-xs text-allys-muted hover:text-red-400 rounded border border-allys-gray hover:border-red-400/50 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-3 h-3 lg:w-3.5 lg:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            End Session
          </button>
        )}
      </div>
    </div>
  );
}

// Opportunity Metric Component
function OpportunityMetric({ label, value, color = 'gray' }: { label: string; value: string; color?: 'green' | 'blue' | 'gray' }) {
  const colorClasses = {
    green: 'text-green-400',
    blue: 'text-blue-400',
    gray: 'text-allys-text'
  };

  return (
    <div className="bg-allys-dark/30 p-2 rounded">
      <div className="text-[8px] text-allys-muted">{label}</div>
      <div className={`text-[10px] font-medium ${colorClasses[color]}`}>{value}</div>
    </div>
  );
}

// Risk Indicator Component
function RiskIndicator({ label, level }: { label: string; level: 'Low' | 'Medium' | 'High' }) {
  const colors = {
    Low: { bg: 'bg-green-500', text: 'text-green-400' },
    Medium: { bg: 'bg-yellow-500', text: 'text-yellow-400' },
    High: { bg: 'bg-red-500', text: 'text-red-400' },
  };
  const color = colors[level] || colors.Medium;

  return (
    <div className="text-center">
      <div className="text-[8px] text-allys-muted mb-1">{label}</div>
      <div className={`text-[10px] font-medium ${color.text}`}>{level}</div>
      <div className="flex justify-center gap-0.5 mt-1">
        <div className={`w-1.5 h-1.5 rounded-full ${level === 'Low' || level === 'Medium' || level === 'High' ? color.bg : 'bg-allys-gray'}`} />
        <div className={`w-1.5 h-1.5 rounded-full ${level === 'Medium' || level === 'High' ? color.bg : 'bg-allys-gray'}`} />
        <div className={`w-1.5 h-1.5 rounded-full ${level === 'High' ? color.bg : 'bg-allys-gray'}`} />
      </div>
    </div>
  );
}

// Strategic Fit Gauge Component - enlarged (Item 4: more prominent)
function StrategicFitGauge({
  score,
  isLoading,
  components
}: {
  score: number;
  isLoading?: boolean;
  components?: StrategicFitComponents;
}) {
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (score / 100) * circumference;

  // Color coding per Spec v2: 0-30 Red, 31-50 Amber, 51-70 Green, 71-100 Blue
  const getScoreColor = (s: number) => {
    if (s <= 30) return '#ef4444'; // Red
    if (s <= 50) return '#eab308'; // Amber
    if (s <= 70) return '#22c55e'; // Green
    return '#3b82f6'; // Blue
  };

  const scoreColor = getScoreColor(score);

  return (
    <div className="flex items-center gap-4">
      {/* Circular Gauge - increased size (Item 4) */}
      <div className="relative shrink-0">
        <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#2a2a2a" strokeWidth="8" />
          {!isLoading && (
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke={scoreColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="transition-all duration-700"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {isLoading ? (
            <span className="text-2xl font-bold text-allys-muted">--</span>
          ) : (
            <>
              <span className="text-2xl font-bold" style={{ color: scoreColor }}>{score}</span>
              <span className="text-[8px] text-allys-muted tracking-wider">/ 100</span>
            </>
          )}
        </div>
      </div>

      {/* Five Dimension Bars (per Spec v2 Section C - 0-20 scale each) */}
      {!isLoading && components && (
        <div className="flex-1 space-y-1.5">
          <DimensionBar label="Problem" value={components.problemClarity} max={20} />
          <DimensionBar label="Data" value={components.dataReadiness} max={20} />
          <DimensionBar label="Urgency" value={components.businessUrgency} max={20} />
          <DimensionBar label="AI Maturity" value={components.aiMaturity} max={20} />
          <DimensionBar label="Stakeholder" value={components.stakeholderAlignment} max={20} />
        </div>
      )}
    </div>
  );
}

// Dimension Bar for Strategic Fit breakdown (per Spec v2 Section C - 0-20 scale)
function DimensionBar({ label, value, max }: { label: string; value: number; max: number }) {
  const percentage = (value / max) * 100;
  const color = percentage >= 75 ? 'bg-green-500' : percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="flex items-center gap-2">
      <span className="text-[8px] text-allys-muted w-14 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-allys-gray rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-[8px] text-allys-muted w-6 text-right">{value}/{max}</span>
    </div>
  );
}

// Default score band info fallback
function getDefaultScoreBandInfo(score: number): ScoreBandInfo {
  if (score <= 30) {
    return {
      band: 'Early Stage',
      headline: 'Building Your AI Foundation',
      ctaMessage: 'Want to explore what\'s possible? Click Book Strategy Call to start.',
      color: 'red'
    };
  }
  if (score <= 50) {
    return {
      band: 'Exploring',
      headline: 'Clear Potential, Time to Plan',
      ctaMessage: 'You have real potential. Click Book Strategy Call to map your AI roadmap.',
      color: 'amber'
    };
  }
  if (score <= 70) {
    return {
      band: 'Develop',
      headline: 'Good Foundation, Assessment Recommended',
      ctaMessage: 'Good foundation detected. Click Book Strategy Call to define your first project.',
      color: 'green'
    };
  }
  if (score <= 85) {
    return {
      band: 'Strong Foundation',
      headline: 'Strong Foundation, Strategy Session Recommended',
      ctaMessage: 'Strong foundation. Click Book Strategy Call to schedule a focused session.',
      color: 'blue'
    };
  }
  return {
    band: 'Strong Foundation',
    headline: 'Excellent Foundation, Detailed Planning Recommended',
    ctaMessage: 'Excellent foundation. Click Book Strategy Call to start detailed planning.',
    color: 'blue'
  };
}
