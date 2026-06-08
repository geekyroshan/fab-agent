/**
 * Email Service - Resend Integration
 * Sends AI Readiness Report emails after consultation sessions
 */

import { Resend } from 'resend';
import { config } from '../config/env.js';
import { Lead, Analysis, ScoreBandInfo, EnhancedRecommendation, CaseReference, ScoreTierInfo } from '../types/index.js';

// Initialize Resend client (only if API key is configured)
let resend: Resend | null = null;

if (config.resendApiKey) {
  resend = new Resend(config.resendApiKey);
}

// Email templates per score band (updated band names)
const EMAIL_TEMPLATES: Record<string, {
  subject: string;
  preheader: string;
  ctaText: string;
}> = {
  'Strong Foundation': {
    subject: 'Your AI Readiness Report: Strong Foundation Detected',
    preheader: 'Strong foundation for AI. Let\'s plan your next steps together.',
    ctaText: 'Book Strategy Call'
  },
  'Develop': {
    subject: 'Your AI Readiness Report: Good Foundation',
    preheader: 'Good foundation detected. A strategy session can help define your first project.',
    ctaText: 'Book Strategy Call'
  },
  'Exploring': {
    subject: 'Your AI Readiness Report: Clear Potential',
    preheader: 'You have real potential. Let\'s map your AI roadmap together.',
    ctaText: 'Book Strategy Call'
  },
  'Early Stage': {
    subject: 'Your AI Readiness Report: Building Your Foundation',
    preheader: 'Great first step! Let\'s explore what\'s possible for your business.',
    ctaText: 'Book Strategy Call'
  }
};

/**
 * Get color hex for score band
 */
function getScoreBandColorHex(color: string): string {
  switch (color) {
    case 'blue': return '#3b82f6';
    case 'green': return '#22c55e';
    case 'amber': return '#eab308';
    case 'red': return '#ef4444';
    default: return '#6b7280';
  }
}

/**
 * Build v2.1 enhanced recommendations HTML for email
 */
function buildRecommendationsHtml(recs?: EnhancedRecommendation[]): string {
  if (!recs || recs.length === 0) return '';

  const typeConfig: Record<string, { color: string; label: string }> = {
    quick_win: { color: '#eab308', label: 'Quick Win' },
    ai_use_case: { color: '#3b82f6', label: 'AI Use Case' },
    strategy_call: { color: '#22c55e', label: 'Next Step' },
  };

  const recsHtml = recs.slice(0, 3).map(rec => {
    const cfg = typeConfig[rec.type] || { color: '#6b7280', label: rec.type };
    return `
      <div style="margin-bottom: 16px; padding: 14px; background: #f9fafb; border-radius: 8px; border-left: 4px solid ${cfg.color};">
        <div style="margin-bottom: 6px;">
          <span style="display: inline-block; padding: 2px 8px; background: ${cfg.color}; color: #fff; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase;">${cfg.label}</span>
        </div>
        <div style="font-size: 14px; font-weight: 600; color: #111827; margin-bottom: 4px;">${rec.title}</div>
        <div style="font-size: 13px; color: #4b5563; line-height: 1.5;">${rec.description}</div>
      </div>
    `;
  }).join('');

  return `
    <div style="margin: 24px 0;">
      <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #111827;">Recommendations</h3>
      ${recsHtml}
    </div>
  `;
}

/**
 * Build v2.1 case references HTML for email
 */
function buildCaseReferencesHtml(refs?: CaseReference[]): string {
  if (!refs || refs.length === 0) return '';

  const refsHtml = refs.slice(0, 2).map(ref => {
    const quoteHtml = ref.quote ? `
      <div style="margin-top: 8px; padding: 8px 12px; background: #f3f4f6; border-radius: 6px; font-style: italic; font-size: 12px; color: #6b7280;">
        "${ref.quote}"${ref.quoteAuthor ? ` — ${ref.quoteAuthor}` : ''}
      </div>
    ` : '';

    return `
      <div style="margin-bottom: 14px; padding: 14px; background: #f0fdf4; border-radius: 8px;">
        <div style="font-size: 13px; font-weight: 600; color: #111827;">${ref.clientName} <span style="font-size: 11px; color: #6b7280; font-weight: normal;">| ${ref.industry}</span></div>
        <div style="font-size: 13px; font-weight: 600; color: #22c55e; margin-top: 4px;">${ref.headline}</div>
        <div style="font-size: 12px; color: #4b5563; margin-top: 4px; line-height: 1.5;">${ref.detail}</div>
        ${quoteHtml}
      </div>
    `;
  }).join('');

  return `
    <div style="margin: 24px 0;">
      <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #111827;">Relevant Experience</h3>
      ${refsHtml}
    </div>
  `;
}

/**
 * Build CTA section with v2.1 score-tier-specific label
 */
function buildCtaHtml(analysis: Analysis, scoreBandInfo: ScoreBandInfo, colorHex: string, calLink: string): string {
  const tierInfo = analysis.scoreTierInfo;
  const ctaLabel = tierInfo?.ctaLabel || 'Book Strategy Call';
  const ctaMessage = tierInfo?.ctaMessage || scoreBandInfo.ctaMessage;
  const tierColorHex = tierInfo
    ? (tierInfo.color === 'green' ? '#22c55e' : tierInfo.color === 'amber' ? '#eab308' : '#ef4444')
    : colorHex;

  return `
    <div style="text-align: center; margin: 32px 0 24px 0; padding: 24px; background: ${tierColorHex}; border-radius: 12px;">
      <p style="margin: 0 0 16px 0; color: #fff; font-size: 16px;">${ctaMessage}</p>
      <a href="${calLink}" style="display: inline-block; padding: 14px 32px; background: #fff; color: ${tierColorHex}; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
        ${ctaLabel}
      </a>
      <p style="margin: 16px 0 0 0; color: rgba(255,255,255,0.8); font-size: 12px;">30 minutes with our AI Readiness Experts</p>
    </div>
  `;
}

/**
 * Generate HTML email content for AI Readiness Report
 * No financial numbers - only score, band, headline, and qualitative insights
 */
function generateReportEmailHtml(lead: Lead, analysis: Analysis): string {
  const enterprise = analysis.enterpriseMetrics;
  const scoreBandInfo = enterprise?.scoreBandInfo || {
    band: 'Exploring',
    headline: 'Clear Potential, Time to Plan',
    ctaMessage: 'Click Book Strategy Call to learn more.',
    color: 'amber'
  };

  const score = enterprise?.strategicFitScore || analysis.fitScore;
  const colorHex = getScoreBandColorHex(scoreBandInfo.color);
  const calLink = 'https://cal.com/allysai/30min';

  // Build dimension bars HTML
  const dimensions = enterprise?.strategicFitComponents;
  const dimensionBarsHtml = dimensions ? `
    <div style="margin: 20px 0;">
      <div style="margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span style="font-size: 12px; color: #6b7280;">Problem Clarity</span>
          <span style="font-size: 12px; color: #6b7280;">${dimensions.problemClarity}/20</span>
        </div>
        <div style="background: #e5e7eb; border-radius: 4px; height: 8px;">
          <div style="background: ${dimensions.problemClarity >= 15 ? '#22c55e' : dimensions.problemClarity >= 10 ? '#eab308' : '#ef4444'}; width: ${(dimensions.problemClarity / 20) * 100}%; height: 100%; border-radius: 4px;"></div>
        </div>
      </div>
      <div style="margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span style="font-size: 12px; color: #6b7280;">Data Readiness</span>
          <span style="font-size: 12px; color: #6b7280;">${dimensions.dataReadiness}/20</span>
        </div>
        <div style="background: #e5e7eb; border-radius: 4px; height: 8px;">
          <div style="background: ${dimensions.dataReadiness >= 15 ? '#22c55e' : dimensions.dataReadiness >= 10 ? '#eab308' : '#ef4444'}; width: ${(dimensions.dataReadiness / 20) * 100}%; height: 100%; border-radius: 4px;"></div>
        </div>
      </div>
      <div style="margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span style="font-size: 12px; color: #6b7280;">Business Urgency</span>
          <span style="font-size: 12px; color: #6b7280;">${dimensions.businessUrgency}/20</span>
        </div>
        <div style="background: #e5e7eb; border-radius: 4px; height: 8px;">
          <div style="background: ${dimensions.businessUrgency >= 15 ? '#22c55e' : dimensions.businessUrgency >= 10 ? '#eab308' : '#ef4444'}; width: ${(dimensions.businessUrgency / 20) * 100}%; height: 100%; border-radius: 4px;"></div>
        </div>
      </div>
      <div style="margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span style="font-size: 12px; color: #6b7280;">AI Maturity</span>
          <span style="font-size: 12px; color: #6b7280;">${dimensions.aiMaturity}/20</span>
        </div>
        <div style="background: #e5e7eb; border-radius: 4px; height: 8px;">
          <div style="background: ${dimensions.aiMaturity >= 15 ? '#22c55e' : dimensions.aiMaturity >= 10 ? '#eab308' : '#ef4444'}; width: ${(dimensions.aiMaturity / 20) * 100}%; height: 100%; border-radius: 4px;"></div>
        </div>
      </div>
      <div style="margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span style="font-size: 12px; color: #6b7280;">Stakeholder Alignment</span>
          <span style="font-size: 12px; color: #6b7280;">${dimensions.stakeholderAlignment}/20</span>
        </div>
        <div style="background: #e5e7eb; border-radius: 4px; height: 8px;">
          <div style="background: ${dimensions.stakeholderAlignment >= 15 ? '#22c55e' : dimensions.stakeholderAlignment >= 10 ? '#eab308' : '#ef4444'}; width: ${(dimensions.stakeholderAlignment / 20) * 100}%; height: 100%; border-radius: 4px;"></div>
        </div>
      </div>
    </div>
  ` : '';

  // Build use cases HTML
  const useCases = enterprise?.identifiedUseCases || [];
  const useCasesHtml = useCases.length > 0 ? `
    <div style="margin: 20px 0; padding: 16px; background: #f0fdf4; border-radius: 8px; border-left: 4px solid #22c55e;">
      <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #166534;">Top Use Cases Identified</h3>
      ${useCases.slice(0, 3).map(uc => `
        <div style="margin-bottom: 8px;">
          <strong style="color: #15803d;">${uc.name}</strong>
          <span style="color: #4b5563;"> — ${uc.description}</span>
        </div>
      `).join('')}
    </div>
  ` : '';

  // Build opportunity snapshot HTML (directional labels only, no dollar amounts)
  const snapshot = enterprise?.opportunitySnapshot;
  const snapshotHtml = snapshot ? `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 24px 0;">
      <div style="padding: 16px; background: #f9fafb; border-radius: 8px; text-align: center;">
        <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">ROI Potential</div>
        <div style="font-size: 18px; font-weight: bold; color: ${colorHex};">${snapshot.roiPotential}</div>
      </div>
      <div style="padding: 16px; background: #f9fafb; border-radius: 8px; text-align: center;">
        <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Est. Impact</div>
        <div style="font-size: 16px; font-weight: bold; color: #22c55e;">${snapshot.estimatedImpact}</div>
        <div style="font-size: 10px; color: #9ca3af;">annual value</div>
      </div>
      <div style="padding: 16px; background: #f9fafb; border-radius: 8px; text-align: center;">
        <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Time to Results</div>
        <div style="font-size: 16px; font-weight: bold; color: #111827;">${snapshot.timeToFirstResults}</div>
      </div>
      <div style="padding: 16px; background: #f9fafb; border-radius: 8px; text-align: center;">
        <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Payback Speed</div>
        <div style="font-size: 14px; font-weight: bold; color: #111827;">${snapshot.paybackSpeed}</div>
      </div>
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your AI Readiness Report</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="background: #000; padding: 24px; border-radius: 8px 8px 0 0;">
      <h1 style="margin: 0; color: #fff; font-size: 24px;">AllysAI</h1>
      <p style="margin: 8px 0 0 0; color: #9ca3af; font-size: 14px;">Your AI Readiness Report</p>
    </div>

    <!-- Main Content -->
    <div style="background: #fff; padding: 24px; border-radius: 0 0 8px 8px;">
      <p style="margin: 0 0 16px 0; color: #4b5563;">Hi ${lead.name},</p>
      <p style="margin: 0 0 24px 0; color: #4b5563;">Thank you for completing your AI Readiness Assessment. Here's a summary of your results:</p>

      <!-- Score Hero -->
      <div style="text-align: center; padding: 24px; background: linear-gradient(135deg, ${colorHex}15 0%, ${colorHex}05 100%); border-radius: 12px; margin-bottom: 24px;">
        <div style="display: inline-block; width: 100px; height: 100px; border-radius: 50%; border: 8px solid ${colorHex}; position: relative;">
          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);">
            <span style="font-size: 32px; font-weight: bold; color: ${colorHex};">${score}</span>
            <span style="font-size: 14px; color: #6b7280; display: block;">/ 100</span>
          </div>
        </div>
        <div style="margin-top: 16px;">
          <span style="display: inline-block; padding: 6px 16px; background: ${colorHex}; color: #fff; border-radius: 16px; font-size: 14px; font-weight: 600;">${scoreBandInfo.band}</span>
        </div>
        <h2 style="margin: 16px 0 0 0; color: #111827; font-size: 20px;">${scoreBandInfo.headline}</h2>
      </div>

      <!-- Dimension Bars -->
      ${dimensionBarsHtml}

      <!-- Opportunity Snapshot (directional labels only) -->
      ${snapshotHtml}

      <!-- Use Cases -->
      ${useCasesHtml}

      <!-- Executive Summary -->
      ${analysis.executiveSummary ? `
        <div style="margin: 24px 0; padding: 16px; background: #f9fafb; border-radius: 8px;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #111827;">Executive Summary</h3>
          <p style="margin: 0; font-size: 14px; color: #4b5563; line-height: 1.6;">${analysis.executiveSummary}</p>
        </div>
      ` : ''}

      <!-- v2.1 Enhanced Recommendations -->
      ${buildRecommendationsHtml(analysis.enhancedRecommendations)}

      <!-- v2.1 Relevant Experience (Case References) -->
      ${buildCaseReferencesHtml(analysis.caseReferences)}

      <!-- CTA (v2.1 score-tier-specific) -->
      ${buildCtaHtml(analysis, scoreBandInfo, colorHex, calLink)}

      <!-- Footer -->
      <div style="text-align: center; padding-top: 24px; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px;">
          <strong>AllysAI</strong> | allysai.com
        </p>
        <p style="margin: 0; color: #9ca3af; font-size: 11px;">
          Confidential — prepared for ${lead.company}
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Send AI Readiness Report email to prospect
 */
export async function sendReportEmail(lead: Lead, analysis: Analysis): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  if (!resend) {
    console.log('Email service not configured - RESEND_API_KEY not set');
    return {
      success: false,
      error: 'Email service not configured'
    };
  }

  const scoreBand = analysis.enterpriseMetrics?.scoreBandInfo?.band || 'Exploring';
  const template = EMAIL_TEMPLATES[scoreBand] || EMAIL_TEMPLATES['Exploring'];

  try {
    const { data, error } = await resend.emails.send({
      from: config.resendFromEmail || 'AllysAI Readiness Expert <readiness@allysai.com>',
      to: lead.email,
      subject: template.subject,
      html: generateReportEmailHtml(lead, analysis),
      tags: [
        { name: 'score_band', value: scoreBand },
        { name: 'company', value: lead.company },
        { name: 'industry', value: lead.industry || 'unknown' }
      ]
    });

    if (error) {
      console.error('Failed to send report email:', error);
      return {
        success: false,
        error: error.message
      };
    }

    console.log(`Report email sent to ${lead.email} (${scoreBand}):`, data?.id);
    return {
      success: true,
      messageId: data?.id
    };
  } catch (error) {
    console.error('Error sending report email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Check if email service is configured
 */
export function isEmailServiceConfigured(): boolean {
  return resend !== null;
}
