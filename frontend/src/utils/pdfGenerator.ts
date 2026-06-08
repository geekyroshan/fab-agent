import jsPDF from "jspdf";
import { Lead, FabReport } from "../types";

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
      const badgeText = 'PROACTIVE';
      const badgeW = 22;
      const badgeX = pageWidth - margin - badgeW - 4;
      doc.setFillColor(...fabGold);
      doc.roundedRect(badgeX, yPos + 4, badgeW, 5.5, 1.5, 1.5, 'F');
      setText(badgeText, badgeX + badgeW / 2, yPos + 7.6, {
        fontSize: 6.5,
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
  const bandH = Math.max(startingPointH + 22, 30);

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
