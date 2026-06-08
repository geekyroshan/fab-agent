import jsPDF from 'jspdf';
import {
  Lead,
  Metrics,
  ScoreBandInfo,
  EnhancedRecommendation,
  CaseReference,
  ScoreTierInfo,
  SpecificUseCase,
  FabReport,
} from '../types';

interface ReportData {
  lead: Lead;
  metrics: Metrics;
  generatedAt: string;
  sessionId: string;
  // v2.1 fields
  enhancedRecommendations?: EnhancedRecommendation[];
  specificUseCases?: SpecificUseCase[];
  caseReferences?: CaseReference[];
  scoreTierInfo?: ScoreTierInfo;
}

/**
 * Generate PDF Report (content flows naturally; page breaks only when needed)
 * Sections: Score + Dimensions + Opportunity Snapshot + Use Cases +
 *           Observations + Recommendations + CTA
 */
export function generatePDFReport(data: ReportData): void {
  const { lead, metrics, generatedAt } = data;
  const doc = new jsPDF();
  const enterprise = metrics.enterpriseMetrics;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let yPos = margin;

  // Colors
  const black: [number, number, number] = [0, 0, 0];
  const white: [number, number, number] = [255, 255, 255];
  const red: [number, number, number] = [239, 68, 68];
  const amber: [number, number, number] = [234, 179, 8];
  const green: [number, number, number] = [34, 197, 94];
  const blue: [number, number, number] = [59, 130, 246];
  const gray: [number, number, number] = [107, 114, 128];
  const lightGray: [number, number, number] = [156, 163, 175];
  const darkBg: [number, number, number] = [15, 15, 15];

  // Get score and band info
  const strategicFitScore = enterprise?.strategicFitScore ?? metrics.fit;
  const scoreBandInfo = enterprise?.scoreBandInfo ?? getDefaultScoreBandInfo(strategicFitScore);
  const components = enterprise?.strategicFitComponents;
  const dimensionText = enterprise?.dimensionText;
  const opportunitySnapshot = enterprise?.opportunitySnapshot;
  const identifiedUseCases = enterprise?.identifiedUseCases || [];

  // Get score band color
  const getScoreColor = (score: number): [number, number, number] => {
    if (score <= 30) return red;
    if (score <= 50) return amber;
    if (score <= 70) return green;
    return blue;
  };
  const scoreColor = getScoreColor(strategicFitScore);

  // ====== HELPER FUNCTIONS ======

  const addText = (text: string, x: number, y: number, options: {
    fontSize?: number;
    fontStyle?: 'normal' | 'bold' | 'italic';
    color?: [number, number, number];
    maxWidth?: number;
    align?: 'left' | 'center' | 'right';
  } = {}) => {
    const { fontSize = 10, fontStyle = 'normal', color = black, maxWidth, align = 'left' } = options;
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', fontStyle);
    doc.setTextColor(...color);
    if (maxWidth) {
      doc.text(text, x, y, { maxWidth, align });
    } else {
      doc.text(text, x, y, { align });
    }
  };

  const addLine = (y: number, color: [number, number, number] = [220, 220, 220]) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
  };

  const wrapText = (text: string, maxWidth: number, fontSize: number): string[] => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', 'normal');
    return doc.splitTextToSize(text, maxWidth) as string[];
  };

  const getTextHeight = (lines: string[], fontSize: number, lineSpacing = 1.3): number => {
    return lines.length * fontSize * 0.353 * lineSpacing;
  };

  const footerZone = 22; // Reserve space at bottom for footer
  const maxY = pageHeight - footerZone;

  const addFooter = () => {
    const footerY = pageHeight - 8;
    addText('AllysAI', margin, footerY, { fontSize: 7, fontStyle: 'bold', color: gray });
    addText(' | allysai.com', margin + 16, footerY, { fontSize: 7, color: lightGray });
    addText(`Confidential \u2014 prepared for ${lead.company}`, pageWidth - margin, footerY, { fontSize: 6, color: lightGray, align: 'right' });
  };

  // Add a continuation page with light header + footer, reset yPos
  const addContinuationPage = () => {
    addFooter();
    doc.addPage();
    doc.setFillColor(...darkBg);
    doc.rect(0, 0, pageWidth, 18, 'F');
    addText('AllysAI', margin, 11, { fontSize: 12, fontStyle: 'bold', color: white });
    addText(`AI Readiness Report \u2014 ${lead.company}`, pageWidth - margin, 11, { fontSize: 8, color: lightGray, align: 'right' });
    yPos = 26;
  };

  // Check if we have enough room; if not, break to a new page
  const ensureSpace = (needed: number) => {
    if (yPos + needed > maxY) {
      addContinuationPage();
    }
  };

  // ==========================================================================
  // HEADER + STRATEGIC FIT SCORE + DIMENSIONS + OPPORTUNITY + USE CASES
  // ==========================================================================

  // HEADER
  doc.setFillColor(...darkBg);
  doc.rect(0, 0, pageWidth, 32, 'F');

  addText('AllysAI', margin, 13, { fontSize: 20, fontStyle: 'bold', color: white });
  addText('Your AI Readiness Report', margin, 22, { fontSize: 10, color: lightGray });

  addText(lead.company.toUpperCase(), pageWidth - margin, 13, { fontSize: 10, fontStyle: 'bold', color: white, align: 'right' });
  addText(new Date(generatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), pageWidth - margin, 22, { fontSize: 8, color: lightGray, align: 'right' });

  yPos = 40;
  addText(`Prepared for: ${lead.name}`, margin, yPos, { fontSize: 9, color: gray });
  addText(`${lead.role} | ${lead.industry || 'Technology'}`, pageWidth - margin, yPos, { fontSize: 9, color: gray, align: 'right' });

  yPos = 48;
  addLine(yPos, lightGray);
  yPos += 12;

  // STRATEGIC FIT SCORE - HERO ELEMENT (Item 4: prominent label)
  addText('STRATEGIC FIT SCORE', margin, yPos, { fontSize: 11, fontStyle: 'bold', color: black });
  yPos += 8;

  const heroY = yPos;
  const ringCenterX = margin + 30;
  const ringCenterY = heroY + 22;
  const ringRadius = 20;

  // Background ring
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(5);
  doc.circle(ringCenterX, ringCenterY, ringRadius, 'S');

  // Score ring (colored portion)
  doc.setDrawColor(...scoreColor);
  doc.setLineWidth(5);
  const startAngle = -90 * (Math.PI / 180);
  const segments = 50;
  for (let segIdx = 0; segIdx < segments * (strategicFitScore / 100); segIdx++) {
    const angle1 = startAngle + (segIdx / segments) * 2 * Math.PI;
    const angle2 = startAngle + ((segIdx + 1) / segments) * 2 * Math.PI;
    const x1 = ringCenterX + ringRadius * Math.cos(angle1);
    const y1 = ringCenterY + ringRadius * Math.sin(angle1);
    const x2 = ringCenterX + ringRadius * Math.cos(angle2);
    const y2 = ringCenterY + ringRadius * Math.sin(angle2);
    doc.line(x1, y1, x2, y2);
  }

  // Score displayed prominently
  addText(`${strategicFitScore}`, ringCenterX, ringCenterY + 2, { fontSize: 22, fontStyle: 'bold', color: scoreColor, align: 'center' });
  addText('/ 100', ringCenterX, ringCenterY + 9, { fontSize: 7, color: gray, align: 'center' });

  // Rating label and headline
  const labelX = margin + 65;
  doc.setFillColor(...scoreColor);
  doc.roundedRect(labelX, heroY + 4, 40, 9, 2, 2, 'F');
  addText(scoreBandInfo.band, labelX + 20, heroY + 10, { fontSize: 8, fontStyle: 'bold', color: white, align: 'center' });

  addText(scoreBandInfo.headline, labelX, heroY + 24, { fontSize: 13, fontStyle: 'bold', color: black });

  // Executive summary
  if (metrics.executiveSummary) {
    const summaryMaxWidth = contentWidth - 70;
    const summaryLines = wrapText(metrics.executiveSummary, summaryMaxWidth, 8.5);
    const summaryHeight = getTextHeight(summaryLines, 8.5);

    addText(metrics.executiveSummary, labelX, heroY + 32, { fontSize: 8.5, color: gray, maxWidth: summaryMaxWidth });
    yPos = heroY + 32 + summaryHeight + 8;
  } else {
    yPos = heroY + 50;
  }

  addLine(yPos);
  yPos += 8;

  // READINESS DIMENSIONS (full text for each dimension)
  addText('READINESS DIMENSIONS', margin, yPos, { fontSize: 10, fontStyle: 'bold', color: black });
  yPos += 8;

  if (components) {
    const dimensions = [
      { label: 'Problem Clarity', value: components.problemClarity, text: dimensionText?.problemClarity },
      { label: 'Data Readiness', value: components.dataReadiness, text: dimensionText?.dataReadiness },
      { label: 'Business Urgency', value: components.businessUrgency, text: dimensionText?.businessUrgency },
      { label: 'AI Maturity', value: components.aiMaturity, text: dimensionText?.aiMaturity },
      { label: 'Stakeholder Alignment', value: components.stakeholderAlignment, text: dimensionText?.stakeholderAlignment },
    ];

    dimensions.forEach((dim) => {
      ensureSpace(20); // label + bar + description text
      // Row 1: Label + score + bar
      addText(dim.label, margin, yPos + 4, { fontSize: 8, fontStyle: 'bold', color: black });
      addText(`${dim.value}/20`, margin + 42, yPos + 4, { fontSize: 7.5, color: gray });

      // Bar
      const barX = margin + 55;
      const barWidth = 50;
      const barHeight = 4;
      doc.setFillColor(230, 230, 230);
      doc.roundedRect(barX, yPos + 0.5, barWidth, barHeight, 1.5, 1.5, 'F');

      const fillPercentage = dim.value / 20;
      const fillColor = fillPercentage >= 0.75 ? green : fillPercentage >= 0.5 ? amber : red;
      doc.setFillColor(...fillColor);
      if (fillPercentage > 0) {
        doc.roundedRect(barX, yPos + 0.5, barWidth * fillPercentage, barHeight, 1.5, 1.5, 'F');
      }

      yPos += 7;

      // Row 2: Full dimension description text (wrapped, not truncated)
      if (dim.text) {
        const textMaxWidth = contentWidth - 4;
        const textLines = wrapText(dim.text, textMaxWidth, 7);
        const textHeight = getTextHeight(textLines, 7);
        addText(dim.text, margin + 2, yPos + 3, { fontSize: 7, color: gray, maxWidth: textMaxWidth });
        yPos += textHeight + 4;
      } else {
        yPos += 3;
      }
    });
  }

  yPos += 3;
  addLine(yPos);
  yPos += 8;

  // OPPORTUNITY SNAPSHOT
  ensureSpace(40); // title + 4 cards
  addText('OPPORTUNITY SNAPSHOT', margin, yPos, { fontSize: 10, fontStyle: 'bold', color: black });
  yPos += 7;

  const cardWidth = (contentWidth - 15) / 4;
  const cardHeight = 22;

  if (opportunitySnapshot) {
    // ROI Potential
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(margin, yPos, cardWidth, cardHeight, 2, 2, 'F');
    addText('ROI POTENTIAL', margin + 3, yPos + 6, { fontSize: 6, color: gray });
    const roiColor = opportunitySnapshot.roiPotential === 'Very High' ? green :
                     opportunitySnapshot.roiPotential === 'High' ? blue : gray;
    addText(opportunitySnapshot.roiPotential, margin + 3, yPos + 14, { fontSize: 9, fontStyle: 'bold', color: roiColor });

    // Estimated Impact
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(margin + cardWidth + 5, yPos, cardWidth, cardHeight, 2, 2, 'F');
    addText('ESTIMATED IMPACT', margin + cardWidth + 8, yPos + 6, { fontSize: 6, color: gray });
    addText(`${opportunitySnapshot.estimatedImpact}`, margin + cardWidth + 8, yPos + 13, { fontSize: 8, fontStyle: 'bold', color: green });
    addText('annual value', margin + cardWidth + 8, yPos + 18, { fontSize: 5.5, color: gray });

    // Time to Results
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(margin + (cardWidth + 5) * 2, yPos, cardWidth, cardHeight, 2, 2, 'F');
    addText('TIME TO RESULTS', margin + (cardWidth + 5) * 2 + 3, yPos + 6, { fontSize: 6, color: gray });
    addText(opportunitySnapshot.timeToFirstResults, margin + (cardWidth + 5) * 2 + 3, yPos + 14, { fontSize: 8, fontStyle: 'bold', color: black });

    // Payback Speed
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(margin + (cardWidth + 5) * 3, yPos, cardWidth, cardHeight, 2, 2, 'F');
    addText('PAYBACK SPEED', margin + (cardWidth + 5) * 3 + 3, yPos + 6, { fontSize: 6, color: gray });
    const paybackMain = opportunitySnapshot.paybackSpeed.split('(')[0].trim();
    addText(paybackMain, margin + (cardWidth + 5) * 3 + 3, yPos + 13, { fontSize: 7.5, fontStyle: 'bold', color: black });
    if (opportunitySnapshot.paybackSpeed.includes('(')) {
      addText(`(${opportunitySnapshot.paybackSpeed.split('(')[1]}`, margin + (cardWidth + 5) * 3 + 3, yPos + 18, { fontSize: 5.5, color: gray });
    }
  }

  yPos += cardHeight + 6;
  addLine(yPos);
  yPos += 8;

  // TOP USE CASES IDENTIFIED
  ensureSpace(20); // at least room for title + 1 use case
  addText('TOP USE CASES IDENTIFIED', margin, yPos, { fontSize: 10, fontStyle: 'bold', color: black });
  yPos += 7;

  if (identifiedUseCases.length > 0) {
    identifiedUseCases.slice(0, 3).forEach((useCase) => {
      const descMaxWidth = contentWidth - 12;
      const descLines = wrapText(useCase.description, descMaxWidth, 7.5);
      const descHeight = getTextHeight(descLines, 7.5);

      ensureSpace(descHeight + 14); // room for this use case

      doc.setFillColor(...scoreColor);
      doc.circle(margin + 3, yPos + 2.5, 1.5, 'F');

      addText(useCase.name, margin + 8, yPos + 4, { fontSize: 8.5, fontStyle: 'bold', color: black });
      yPos += 6;

      addText(useCase.description, margin + 8, yPos + 2, { fontSize: 7.5, color: gray, maxWidth: descMaxWidth });
      yPos += descHeight + 5;
    });
  } else {
    addText('Continue the assessment to identify specific AI use cases.', margin, yPos + 4, { fontSize: 8, color: gray, fontStyle: 'italic' });
    yPos += 10;
  }

  // ==========================================================================
  // OBSERVATIONS + 3 RECOMMENDATIONS + CTA + FOOTER
  // (flows naturally from page 1; ensureSpace handles page breaks as needed)
  // ==========================================================================

  yPos += 2;
  addLine(yPos);
  yPos += 8;

  // KEY OBSERVATIONS (top 3)
  if (metrics.keyObservations && metrics.keyObservations.length > 0) {
    addText('KEY OBSERVATIONS', margin, yPos, { fontSize: 10, fontStyle: 'bold', color: black });
    yPos += 8;

    metrics.keyObservations.slice(0, 3).forEach((obs) => {
      const obsMaxWidth = contentWidth - 12;
      const obsLines = wrapText(obs, obsMaxWidth, 8);
      const obsHeight = getTextHeight(obsLines, 8);

      ensureSpace(obsHeight + 8);

      doc.setFillColor(...blue);
      doc.circle(margin + 3, yPos + 2.5, 1.2, 'F');
      addText(obs, margin + 8, yPos + 3.5, { fontSize: 8, color: [60, 60, 60], maxWidth: obsMaxWidth });
      yPos += obsHeight + 4;
    });

    yPos += 4;
    addLine(yPos);
    yPos += 10;
  }

  // RECOMMENDATIONS (v2.1: 3 distinct types — Quick Win / AI Use Case / Strategy Call)
  ensureSpace(20);
  addText('RECOMMENDATIONS', margin, yPos, { fontSize: 10, fontStyle: 'bold', color: black });
  yPos += 8;

  const enhancedRecs = data.enhancedRecommendations;

  if (enhancedRecs && enhancedRecs.length > 0) {
    // v2.1 enhanced recommendations with type icons
    const iconColors: Record<string, [number, number, number]> = {
      quick_win: [234, 179, 8],      // amber
      ai_use_case: [59, 130, 246],    // blue
      strategy_call: [34, 197, 94],   // green
    };
    const iconLabels: Record<string, string> = {
      quick_win: 'QUICK WIN',
      ai_use_case: 'AI USE CASE',
      strategy_call: 'NEXT STEP',
    };

    enhancedRecs.slice(0, 3).forEach((rec) => {
      const titleMaxWidth = contentWidth - 14;
      const descMaxWidth = contentWidth - 14;
      const descLines = wrapText(rec.description, descMaxWidth, 7.5);
      const descHeight = getTextHeight(descLines, 7.5);

      ensureSpace(descHeight + 18);

      // Type badge
      const badgeColor = iconColors[rec.type] || scoreColor;
      const badgeLabel = iconLabels[rec.type] || rec.type.toUpperCase();
      doc.setFillColor(...badgeColor);
      doc.roundedRect(margin, yPos, 28, 5.5, 1.5, 1.5, 'F');
      addText(badgeLabel, margin + 14, yPos + 4, { fontSize: 5.5, fontStyle: 'bold', color: white, align: 'center' });

      yPos += 8;
      addText(rec.title, margin + 2, yPos, { fontSize: 8.5, fontStyle: 'bold', color: black, maxWidth: titleMaxWidth });
      yPos += 5;
      addText(rec.description, margin + 2, yPos, { fontSize: 7.5, color: gray, maxWidth: descMaxWidth });
      yPos += descHeight + 6;
    });
  } else {
    // Fallback: original numbered recommendations
    const recommendations = metrics.recommendations && metrics.recommendations.length > 0
      ? metrics.recommendations.slice(0, 3)
      : [
          'Book a discovery call to explore your specific AI opportunities',
          'Assess your current data and processes for AI readiness',
          'Identify and prioritize your top AI use cases',
        ];

    recommendations.forEach((rec, index) => {
      const recMaxWidth = contentWidth - 14;
      const recLines = wrapText(rec, recMaxWidth, 8.5);
      const recHeight = getTextHeight(recLines, 8.5);

      ensureSpace(recHeight + 10);

      doc.setFillColor(...scoreColor);
      doc.circle(margin + 3, yPos + 2.5, 3.5, 'F');
      addText(`${index + 1}`, margin + 3, yPos + 3.5, { fontSize: 7, fontStyle: 'bold', color: white, align: 'center' });

      addText(rec, margin + 10, yPos + 3.5, { fontSize: 8.5, color: [60, 60, 60], maxWidth: recMaxWidth });
      yPos += recHeight + 6;
    });
  }

  yPos += 6;
  addLine(yPos);
  yPos += 10;

  // RELEVANT EXPERIENCE (v2.1 case references for social proof)
  const caseRefs = data.caseReferences;
  if (caseRefs && caseRefs.length > 0) {
    ensureSpace(30);
    addText('RELEVANT EXPERIENCE', margin, yPos, { fontSize: 10, fontStyle: 'bold', color: black });
    yPos += 8;

    caseRefs.slice(0, 2).forEach((ref) => {
      const detailMaxWidth = contentWidth - 12;
      const detailLines = wrapText(ref.detail, detailMaxWidth, 7.5);
      const detailHeight = getTextHeight(detailLines, 7.5);
      const quoteLines = ref.quote ? wrapText(`"${ref.quote}"`, detailMaxWidth, 7) : [];
      const quoteHeight = ref.quote ? getTextHeight(quoteLines, 7) : 0;

      ensureSpace(detailHeight + quoteHeight + 22);

      // Client name + industry tag
      addText(ref.clientName, margin + 2, yPos + 3, { fontSize: 8.5, fontStyle: 'bold', color: black });
      doc.setFillColor(230, 230, 230);
      const industryTagWidth = Math.min(ref.industry.length * 2.5 + 6, 50);
      doc.roundedRect(margin + 2 + ref.clientName.length * 2.3 + 4, yPos - 0.5, industryTagWidth, 5.5, 1.5, 1.5, 'F');
      addText(ref.industry, margin + 2 + ref.clientName.length * 2.3 + 4 + industryTagWidth / 2, yPos + 3, { fontSize: 5.5, color: gray, align: 'center' });

      yPos += 7;

      // Headline (e.g., "+45% HCP meetings in 90 days")
      addText(ref.headline, margin + 2, yPos + 3, { fontSize: 8, fontStyle: 'bold', color: green });
      yPos += 7;

      // Detail
      addText(ref.detail, margin + 2, yPos + 2, { fontSize: 7.5, color: [60, 60, 60], maxWidth: detailMaxWidth });
      yPos += detailHeight + 3;

      // Optional quote
      if (ref.quote) {
        addText(`"${ref.quote}"`, margin + 6, yPos + 2, { fontSize: 7, fontStyle: 'italic', color: gray, maxWidth: detailMaxWidth - 8 });
        yPos += quoteHeight + 2;
        if (ref.quoteAuthor) {
          addText(`— ${ref.quoteAuthor}`, margin + 6, yPos + 2, { fontSize: 6.5, color: lightGray });
          yPos += 5;
        }
      }

      yPos += 4;
    });

    yPos += 2;
    addLine(yPos);
    yPos += 10;
  }

  // CALL TO ACTION (v2.1: score-tier-specific CTA label)
  const tierInfo = data.scoreTierInfo;
  const ctaLabel = tierInfo?.ctaLabel || 'Book Strategy Call';
  const ctaMessage = tierInfo?.ctaMessage || scoreBandInfo.ctaMessage;
  const ctaTierColor: [number, number, number] = tierInfo
    ? (tierInfo.color === 'green' ? green : tierInfo.color === 'amber' ? amber : red)
    : scoreColor;

  ensureSpace(50);
  doc.setFillColor(...ctaTierColor);
  doc.roundedRect(margin, yPos, contentWidth, 35, 3, 3, 'F');

  const ctaTextColor: [number, number, number] = (ctaTierColor === amber || ctaTierColor === green) ? black : white;
  const ctaLine1 = ctaMessage.length > 60 ? ctaMessage.substring(0, 60) : ctaMessage;
  const ctaLine2 = ctaMessage.length > 60 ? ctaMessage.substring(60) : '';
  addText(ctaLine1, margin + 10, yPos + 12, { fontSize: 10, fontStyle: 'bold', color: ctaTextColor, maxWidth: contentWidth - 60 });
  if (ctaLine2) {
    addText(ctaLine2, margin + 10, yPos + 21, { fontSize: 9, color: ctaTextColor, maxWidth: contentWidth - 60 });
  }

  // CTA Button with tier-specific label
  const buttonX = pageWidth - margin - 42;
  const buttonY = yPos + 7;
  doc.setFillColor(...white);
  doc.roundedRect(buttonX, buttonY, 32, 20, 2, 2, 'F');
  addText(ctaLabel, buttonX + 16, buttonY + 12, { fontSize: 8, fontStyle: 'bold', color: black, align: 'center' });
  doc.link(buttonX, buttonY, 32, 20, { url: 'https://cal.com/allysai/30min' });

  yPos += 42;

  // Footer on last page
  addFooter();

  // Save
  const fileName = `AllysAI-AI-Readiness-Report-${lead.company.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
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

// =============================================================================
// FAB SME Setup Report PDF
// =============================================================================

interface FabReportPdfData {
  lead: Lead;
  report: FabReport;
  sessionId: string;
  generatedAt: string;
  companyName?: string;
}

/**
 * Generate a clean 1-2 page FAB SME Setup PDF report.
 * Sections: Business snapshot, Needs analysis, Recommended FAB setup,
 * Starting point.
 */
export function generateFabPDFReport(data: FabReportPdfData): void {
  const { lead, report, generatedAt } = data;
  const doc = new jsPDF();

  // FAB brand palette
  const fabNavy: [number, number, number] = [0, 61, 165];      // #003DA5
  const fabNavyDark: [number, number, number] = [0, 30, 92];   // #001E5C
  const fabRed: [number, number, number] = [225, 38, 28];      // #E1261C
  const fabGold: [number, number, number] = [163, 126, 44];    // #A37E2C
  const fabCream: [number, number, number] = [244, 241, 234];  // #F4F1EA
  const fabText: [number, number, number] = [26, 26, 26];      // #1A1A1A
  const fabMuted: [number, number, number] = [107, 114, 128];  // #6B7280
  const fabWhite: [number, number, number] = [255, 255, 255];
  const lightBorder: [number, number, number] = [225, 225, 225];

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let yPos = margin;

  const companyName = data.companyName || lead.company || 'your business';

  // Helpers
  const setText = (
    text: string,
    x: number,
    y: number,
    opts: {
      fontSize?: number;
      fontStyle?: 'normal' | 'bold' | 'italic';
      color?: [number, number, number];
      maxWidth?: number;
      align?: 'left' | 'center' | 'right';
    } = {}
  ) => {
    const {
      fontSize = 10,
      fontStyle = 'normal',
      color = fabText,
      maxWidth,
      align = 'left',
    } = opts;
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', fontStyle);
    doc.setTextColor(...color);
    if (maxWidth) {
      doc.text(text, x, y, { maxWidth, align });
    } else {
      doc.text(text, x, y, { align });
    }
  };

  const wrap = (text: string, maxWidth: number, fontSize: number): string[] => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', 'normal');
    return doc.splitTextToSize(text, maxWidth) as string[];
  };

  const heightOf = (lines: string[], fontSize: number, spacing = 1.3): number =>
    lines.length * fontSize * 0.353 * spacing;

  const footerZone = 18;
  const maxY = pageHeight - footerZone;

  const drawFooter = () => {
    const y = pageHeight - 9;
    setText('FAB', margin, y, { fontSize: 7, fontStyle: 'bold', color: fabNavy });
    setText('SME Onboarding', margin + 9, y, { fontSize: 7, color: fabMuted });
    setText(
      `Confidential — prepared for ${companyName}`,
      pageWidth - margin,
      y,
      { fontSize: 6.5, color: fabMuted, align: 'right' }
    );
  };

  const newPage = () => {
    drawFooter();
    doc.addPage();
    // Light continuation header
    doc.setFillColor(...fabNavy);
    doc.rect(0, 0, pageWidth, 14, 'F');
    setText('FAB SME Setup', margin, 9, {
      fontSize: 9,
      fontStyle: 'bold',
      color: fabWhite,
    });
    setText(companyName, pageWidth - margin, 9, {
      fontSize: 8,
      color: fabWhite,
      align: 'right',
    });
    yPos = 22;
  };

  const ensure = (needed: number) => {
    if (yPos + needed > maxY) newPage();
  };

  // ====== HEADER ======
  doc.setFillColor(...fabNavy);
  doc.rect(0, 0, pageWidth, 36, 'F');

  // Red accent
  doc.setFillColor(...fabRed);
  doc.rect(0, 36, pageWidth, 1.5, 'F');

  setText('FAB', margin, 16, {
    fontSize: 22,
    fontStyle: 'bold',
    color: fabWhite,
  });
  setText('SME Setup Report', margin, 26, {
    fontSize: 10,
    color: fabWhite,
  });

  setText(companyName.toUpperCase(), pageWidth - margin, 16, {
    fontSize: 10,
    fontStyle: 'bold',
    color: fabWhite,
    align: 'right',
  });
  setText(
    new Date(generatedAt).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    pageWidth - margin,
    25,
    { fontSize: 8, color: fabWhite, align: 'right' }
  );

  yPos = 48;

  if (lead.name) {
    setText(`Prepared for: ${lead.name}`, margin, yPos, {
      fontSize: 9,
      color: fabMuted,
    });
    yPos += 8;
  }

  // ====== SECTION A — BUSINESS SNAPSHOT ======
  const drawSectionHeader = (idx: string, title: string) => {
    ensure(14);
    setText(idx, margin, yPos, {
      fontSize: 9,
      fontStyle: 'bold',
      color: fabRed,
    });
    setText(title, margin + 8, yPos, {
      fontSize: 12,
      fontStyle: 'bold',
      color: fabNavy,
    });
    yPos += 4;
    // underline
    doc.setDrawColor(...lightBorder);
    doc.setLineWidth(0.3);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 6;
  };

  drawSectionHeader('A', 'Business snapshot');

  const snapshotLines = wrap(report.snapshot, contentWidth, 10);
  const snapshotHeight = heightOf(snapshotLines, 10);
  ensure(snapshotHeight + 4);
  setText(report.snapshot, margin, yPos, {
    fontSize: 10,
    color: fabText,
    maxWidth: contentWidth,
  });
  yPos += snapshotHeight + 8;

  // ====== SECTION B — NEEDS ANALYSIS ======
  drawSectionHeader('B', 'Needs analysis');

  // Cream-tint background block
  const needsStartY = yPos;
  const needsBlockX = margin;
  const needsBlockW = contentWidth;

  // Compute total height first
  let needsBodyHeight = 0;
  const needLineHeights: number[] = [];
  for (const need of report.needs) {
    const lines = wrap(need, needsBlockW - 12, 9.5);
    const h = heightOf(lines, 9.5);
    needLineHeights.push(h);
    needsBodyHeight += h + 4;
  }
  needsBodyHeight += 6;

  ensure(needsBodyHeight + 4);

  doc.setFillColor(...fabCream);
  doc.roundedRect(needsBlockX, needsStartY, needsBlockW, needsBodyHeight, 2, 2, 'F');

  let needsY = needsStartY + 6;
  report.needs.forEach((need, idx) => {
    doc.setFillColor(...fabRed);
    doc.circle(needsBlockX + 6, needsY + 1.5, 1.1, 'F');
    setText(need, needsBlockX + 11, needsY + 2.5, {
      fontSize: 9.5,
      color: fabText,
      maxWidth: needsBlockW - 16,
    });
    needsY += needLineHeights[idx] + 4;
  });

  yPos = needsStartY + needsBodyHeight + 8;

  // ====== SECTION C — RECOMMENDED FAB SETUP ======
  drawSectionHeader('C', 'Recommended FAB setup');

  report.recommendations.forEach((rec) => {
    const reasonLines = wrap(rec.reason, contentWidth - 8, 9.5);
    const reasonH = heightOf(reasonLines, 9.5);
    const factLines = rec.triggeringFact
      ? wrap(`Based on: ${rec.triggeringFact}`, contentWidth - 8, 8)
      : [];
    const factH = factLines.length > 0 ? heightOf(factLines, 8) : 0;
    const cardH = 10 + reasonH + (factH > 0 ? factH + 3 : 0) + 6;

    ensure(cardH + 4);

    // Card outline
    doc.setDrawColor(...lightBorder);
    doc.setLineWidth(0.4);
    doc.roundedRect(margin, yPos, contentWidth, cardH, 2, 2, 'S');

    let cardY = yPos + 6;

    // Product name (bold)
    setText(rec.product, margin + 4, cardY, {
      fontSize: 10.5,
      fontStyle: 'bold',
      color: fabText,
    });

    // Proactive badge (if applicable)
    if (rec.isProactive) {
      const badgeText = "you didn't ask, but...";
      const badgeW = 38;
      const badgeX = pageWidth - margin - badgeW - 4;
      doc.setFillColor(...fabGold);
      doc.roundedRect(badgeX, cardY - 4, badgeW, 5.5, 1.5, 1.5, 'F');
      setText(badgeText, badgeX + badgeW / 2, cardY, {
        fontSize: 6,
        fontStyle: 'bold',
        color: fabWhite,
        align: 'center',
      });
    }

    cardY += 5;

    // Category line (small caps)
    if (rec.category) {
      setText(rec.category.toUpperCase(), margin + 4, cardY, {
        fontSize: 6.5,
        color: fabMuted,
      });
      cardY += 3.5;
    }

    // Reason
    setText(rec.reason, margin + 4, cardY + 1, {
      fontSize: 9.5,
      color: fabText,
      maxWidth: contentWidth - 8,
    });
    cardY += reasonH + 1;

    // Triggering fact
    if (rec.triggeringFact) {
      cardY += 2;
      setText(`Based on: ${rec.triggeringFact}`, margin + 4, cardY, {
        fontSize: 8,
        fontStyle: 'italic',
        color: fabMuted,
        maxWidth: contentWidth - 8,
      });
    }

    yPos += cardH + 5;
  });

  // ====== STARTING POINT (closing CTA band) ======
  const startingPointLines = wrap(report.startingPoint, contentWidth - 16, 11);
  const startingPointH = heightOf(startingPointLines, 11);
  const bandH = startingPointH + 18;

  ensure(bandH + 4);

  doc.setFillColor(...fabNavyDark);
  doc.roundedRect(margin, yPos, contentWidth, bandH, 3, 3, 'F');

  setText('YOUR STARTING POINT', margin + 8, yPos + 8, {
    fontSize: 7.5,
    fontStyle: 'bold',
    color: fabWhite,
  });

  setText(report.startingPoint, margin + 8, yPos + 16, {
    fontSize: 11,
    fontStyle: 'bold',
    color: fabWhite,
    maxWidth: contentWidth - 16,
  });

  yPos += bandH + 6;

  // Footer on final page
  drawFooter();

  // Save
  const safeName = (companyName || 'FAB').replace(/[^a-zA-Z0-9]/g, '-');
  const fileName = `FAB-SME-Setup-${safeName}-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}
