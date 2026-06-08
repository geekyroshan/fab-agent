/**
 * Google Sheets Service — Live Lead & Session Data
 * Appends a row on session start, updates it with analysis on session end.
 * All operations are best-effort / non-blocking (same pattern as email.service.ts).
 */

import { google, sheets_v4 } from 'googleapis';
import { config } from '../config/env.js';
import { Lead, Analysis } from '../types/index.js';

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

let sheets: sheets_v4.Sheets | null = null;
let spreadsheetId = '';

const SHEET_HEADERS = [
  'Session ID',
  'Date/Time',
  'Name',
  'Email',
  'Company',
  'Role',
  'Industry',
  'AI Status',
  'Use Cases (Goals)',
  'Session Status',
  'Strategic Fit Score',
  'Score Tier',
  'Problem Clarity (/20)',
  'Data Readiness (/20)',
  'Business Urgency (/20)',
  'AI Maturity (/20)',
  'Stakeholder Alignment (/20)',
  'Top Use Cases',
  'ROI Potential',
  'Estimated Impact',
  'Time to Results',
  'Implementation Risk',
  'Executive Summary',
  'Message Count',
];

if (config.googleSheetsSpreadsheetId && config.googleSheetsCredentials) {
  try {
    const credentialsJson = Buffer.from(config.googleSheetsCredentials, 'base64').toString('utf-8');
    const credentials = JSON.parse(credentialsJson);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    sheets = google.sheets({ version: 'v4', auth });
    spreadsheetId = config.googleSheetsSpreadsheetId;
    console.log('[Sheets] Google Sheets service initialized');
  } catch (err) {
    console.warn('[Sheets] Failed to initialize Google Sheets service:', err);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Ensure the header row exists (idempotent — only writes if row 1 is empty).
 */
async function ensureHeaders(): Promise<void> {
  if (!sheets) return;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Sheet1!A1:X1',
  });

  const firstRow = res.data.values?.[0];
  if (!firstRow || firstRow.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Sheet1!A1',
      valueInputOption: 'RAW',
      requestBody: { values: [SHEET_HEADERS] },
    });
    console.log('[Sheets] Header row created');
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether the Sheets service has been configured.
 */
export function isSheetsServiceConfigured(): boolean {
  return sheets !== null;
}

/**
 * Append a new lead row when a session starts.
 */
export async function appendLeadRow(sessionId: string, lead: Lead): Promise<void> {
  if (!sheets) return;

  try {
    await ensureHeaders();

    const row = [
      sessionId,
      new Date().toISOString(),
      lead.name,
      lead.email,
      lead.company,
      lead.role,
      lead.industry || '',
      lead.aiStatus || '',
      lead.useCases || '',
      'active', // session status at start
      // remaining columns left blank — filled on session end
      '', '', '', '', '', '', '', '', '', '', '', '', '', '',
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Sheet1!A:X',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    });

    console.log(`[Sheets] Lead row appended for session ${sessionId}`);
  } catch (err) {
    console.warn('[Sheets] Failed to append lead row:', err);
  }
}

/**
 * Find the row for a given sessionId and update it with analysis results.
 */
export async function updateSessionRow(
  sessionId: string,
  lead: Lead,
  analysis: Analysis,
  messageCount: number,
): Promise<void> {
  if (!sheets) return;

  try {
    // Find the row by searching column A for the sessionId
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Sheet1!A:A',
    });

    const rows = res.data.values || [];
    let rowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === sessionId) {
        rowIndex = i + 1; // Sheets is 1-indexed
        break;
      }
    }

    if (rowIndex === -1) {
      // Row not found — append a full row instead (session started before Sheets was integrated)
      console.warn(`[Sheets] Session ${sessionId} not found, appending full row`);
      await appendFullRow(sessionId, lead, analysis, messageCount);
      return;
    }

    const enterprise = analysis.enterpriseMetrics;
    const components = enterprise?.strategicFitComponents;
    const snapshot = enterprise?.opportunitySnapshot;
    const scoreBand = enterprise?.scoreBandInfo;
    const useCases = enterprise?.identifiedUseCases || [];

    const updateValues = [
      'completed',                                                    // J: Session Status
      enterprise?.strategicFitScore ?? analysis.fitScore ?? '',       // K: Strategic Fit Score
      scoreBand?.band ?? '',                                          // L: Score Tier
      components?.problemClarity ?? '',                               // M
      components?.dataReadiness ?? '',                                // N
      components?.businessUrgency ?? '',                              // O
      components?.aiMaturity ?? '',                                   // P
      components?.stakeholderAlignment ?? '',                         // Q
      useCases.map(uc => uc.name).join(', '),                         // R: Top Use Cases
      snapshot?.roiPotential ?? '',                                   // S
      snapshot?.estimatedImpact ?? '',                                // T
      snapshot?.timeToFirstResults ?? '',                             // U
      enterprise?.implementationRisk ?? '',                           // V
      analysis.executiveSummary ?? '',                                // W
      messageCount,                                                   // X
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Sheet1!J${rowIndex}:X${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [updateValues] },
    });

    console.log(`[Sheets] Session row updated for ${sessionId} (row ${rowIndex})`);
  } catch (err) {
    console.warn('[Sheets] Failed to update session row:', err);
  }
}

/**
 * Append a complete row (lead + analysis) when the start row is missing.
 */
async function appendFullRow(
  sessionId: string,
  lead: Lead,
  analysis: Analysis,
  messageCount: number,
): Promise<void> {
  if (!sheets) return;

  await ensureHeaders();

  const enterprise = analysis.enterpriseMetrics;
  const components = enterprise?.strategicFitComponents;
  const snapshot = enterprise?.opportunitySnapshot;
  const scoreBand = enterprise?.scoreBandInfo;
  const useCases = enterprise?.identifiedUseCases || [];

  const row = [
    sessionId,
    new Date().toISOString(),
    lead.name,
    lead.email,
    lead.company,
    lead.role,
    lead.industry || '',
    lead.aiStatus || '',
    lead.useCases || '',
    'completed',
    enterprise?.strategicFitScore ?? analysis.fitScore ?? '',
    scoreBand?.band ?? '',
    components?.problemClarity ?? '',
    components?.dataReadiness ?? '',
    components?.businessUrgency ?? '',
    components?.aiMaturity ?? '',
    components?.stakeholderAlignment ?? '',
    useCases.map(uc => uc.name).join(', '),
    snapshot?.roiPotential ?? '',
    snapshot?.estimatedImpact ?? '',
    snapshot?.timeToFirstResults ?? '',
    enterprise?.implementationRisk ?? '',
    analysis.executiveSummary ?? '',
    messageCount,
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Sheet1!A:X',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });

  console.log(`[Sheets] Full row appended for session ${sessionId}`);
}
