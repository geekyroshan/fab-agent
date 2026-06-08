import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from '../config/env.js';
import { Session, Lead, Message, Analysis, FabReport, FabAnswers, CompanyResearch } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = path.resolve(config.databasePath);
    const dbDir = path.dirname(dbPath);

    // Ensure directory exists
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    initTables();
  }
  return db;
}

function initTables(): void {
  db!.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      source TEXT DEFAULT 'readiness_webapp',
      status TEXT DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT REFERENCES sessions(id),
      name TEXT,
      email TEXT,
      company TEXT,
      role TEXT,
      industry TEXT,
      ai_status TEXT,
      use_cases TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(session_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT REFERENCES sessions(id),
      role TEXT,
      content TEXT,
      input_type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS analysis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT REFERENCES sessions(id),
      readiness_score INTEGER,
      fit_score INTEGER,
      roi_estimate REAL,
      efficiency_estimate REAL,
      key_observations TEXT,
      recommendations TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
    CREATE INDEX IF NOT EXISTS idx_leads_session ON leads(session_id);
    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_analysis_session ON analysis(session_id);
  `);

  // Migrations: add columns introduced after the initial AllysAI schema
  try {
    const tableInfo = db!.prepare("PRAGMA table_info(leads)").all() as any[];
    const columns = tableInfo.map((col: any) => col.name);

    if (!columns.includes('industry')) {
      db!.exec("ALTER TABLE leads ADD COLUMN industry TEXT DEFAULT ''");
      console.log('Migration: Added industry column to leads table');
    }
    if (!columns.includes('fab_answers')) {
      db!.exec("ALTER TABLE leads ADD COLUMN fab_answers TEXT");
      console.log('Migration: Added fab_answers column to leads table');
    }
    if (!columns.includes('company_research')) {
      db!.exec("ALTER TABLE leads ADD COLUMN company_research TEXT");
      console.log('Migration: Added company_research column to leads table');
    }
  } catch (error) {
    console.error('Migration check failed:', error);
  }
}

// Session operations
export function createSession(id: string): Session {
  const db = getDatabase();
  db.prepare('INSERT INTO sessions (id) VALUES (?)').run(id);
  return getSession(id)!;
}

export function getSession(id: string): Session | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as any;
  if (!row) return null;
  return {
    id: row.id,
    createdAt: row.created_at,
    endedAt: row.ended_at,
    source: row.source,
    status: row.status,
  };
}

export function updateSessionStatus(id: string, status: Session['status']): void {
  const db = getDatabase();
  const endedAt = status === 'completed' || status === 'abandoned' ? new Date().toISOString() : null;
  db.prepare('UPDATE sessions SET status = ?, ended_at = ? WHERE id = ?').run(status, endedAt, id);
}

// Lead operations
export function createLead(lead: Lead): Lead {
  const db = getDatabase();
  const result = db.prepare(`
    INSERT INTO leads (session_id, name, email, company, role, industry, ai_status, use_cases)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(lead.sessionId, lead.name, lead.email, lead.company, lead.role, lead.industry, lead.aiStatus, lead.useCases);

  return { ...lead, id: result.lastInsertRowid as number };
}

export function getLeadBySession(sessionId: string): Lead | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM leads WHERE session_id = ?').get(sessionId) as any;
  if (!row) return null;
  return {
    id: row.id,
    sessionId: row.session_id,
    name: row.name,
    email: row.email,
    company: row.company,
    role: row.role,
    industry: row.industry || '',
    aiStatus: row.ai_status,
    useCases: row.use_cases,
    createdAt: row.created_at,
    fabAnswers: row.fab_answers ? safeParse<FabAnswers>(row.fab_answers, {}) : {},
    companyResearch: row.company_research ? safeParse<CompanyResearch | undefined>(row.company_research, undefined) : undefined,
  };
}

function safeParse<T>(raw: string, fallback: T): T {
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

export function updateFabAnswers(sessionId: string, patch: Partial<FabAnswers>): FabAnswers {
  const db = getDatabase();
  const existing = getLeadBySession(sessionId)?.fabAnswers || {};
  const merged: FabAnswers = { ...existing, ...patch };
  db.prepare('UPDATE leads SET fab_answers = ? WHERE session_id = ?').run(JSON.stringify(merged), sessionId);
  return merged;
}

export function updateCompanyResearch(sessionId: string, research: CompanyResearch): void {
  const db = getDatabase();
  db.prepare('UPDATE leads SET company_research = ? WHERE session_id = ?').run(JSON.stringify(research), sessionId);
}

export function updateLead(sessionId: string, updates: Partial<Lead>): void {
  const db = getDatabase();
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.email !== undefined) { fields.push('email = ?'); values.push(updates.email); }
  if (updates.company !== undefined) { fields.push('company = ?'); values.push(updates.company); }
  if (updates.role !== undefined) { fields.push('role = ?'); values.push(updates.role); }
  if (updates.industry !== undefined) { fields.push('industry = ?'); values.push(updates.industry); }
  if (updates.aiStatus !== undefined) { fields.push('ai_status = ?'); values.push(updates.aiStatus); }
  if (updates.useCases !== undefined) { fields.push('use_cases = ?'); values.push(updates.useCases); }

  if (fields.length > 0) {
    values.push(sessionId);
    db.prepare(`UPDATE leads SET ${fields.join(', ')} WHERE session_id = ?`).run(...values);
  }
}

// Message operations
export function addMessage(message: Omit<Message, 'id' | 'createdAt'>): Message {
  const db = getDatabase();
  const result = db.prepare(`
    INSERT INTO messages (session_id, role, content, input_type)
    VALUES (?, ?, ?, ?)
  `).run(message.sessionId, message.role, message.content, message.inputType);

  return { ...message, id: result.lastInsertRowid as number } as Message;
}

export function getMessages(sessionId: string): Message[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC').all(sessionId) as any[];
  return rows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    content: row.content,
    inputType: row.input_type,
    createdAt: row.created_at,
  }));
}

// Analysis operations
export function saveAnalysis(analysis: Omit<Analysis, 'id' | 'createdAt'>): Analysis {
  const db = getDatabase();

  // First ensure the new columns exist
  ensureAnalysisColumns();

  const result = db.prepare(`
    INSERT INTO analysis (session_id, readiness_score, fit_score, roi_estimate, efficiency_estimate, key_observations, recommendations, enterprise_metrics, executive_summary, industry_context, next_steps)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    analysis.sessionId,
    analysis.readinessScore,
    analysis.fitScore,
    analysis.roiEstimate,
    analysis.efficiencyEstimate,
    JSON.stringify(analysis.keyObservations),
    JSON.stringify(analysis.recommendations),
    JSON.stringify(analysis.enterpriseMetrics || null),
    analysis.executiveSummary || null,
    analysis.industryContext || null,
    JSON.stringify(analysis.nextSteps || [])
  );

  return { ...analysis, id: result.lastInsertRowid as number } as Analysis;
}

// Ensure new analysis columns exist
function ensureAnalysisColumns(): void {
  const db = getDatabase();
  try {
    const tableInfo = db.prepare("PRAGMA table_info(analysis)").all() as any[];
    const columns = tableInfo.map((col: any) => col.name);

    if (!columns.includes('enterprise_metrics')) {
      db.exec("ALTER TABLE analysis ADD COLUMN enterprise_metrics TEXT");
    }
    if (!columns.includes('executive_summary')) {
      db.exec("ALTER TABLE analysis ADD COLUMN executive_summary TEXT");
    }
    if (!columns.includes('industry_context')) {
      db.exec("ALTER TABLE analysis ADD COLUMN industry_context TEXT");
    }
    if (!columns.includes('next_steps')) {
      db.exec("ALTER TABLE analysis ADD COLUMN next_steps TEXT");
    }
    if (!columns.includes('report_json')) {
      db.exec("ALTER TABLE analysis ADD COLUMN report_json TEXT");
    }
  } catch (error) {
    console.error('Column migration failed:', error);
  }
}

/**
 * Persist a FabReport as a JSON blob in the analysis table, keyed by sessionId.
 * Stores the report in the dedicated `report_json` column so it can be retrieved
 * independently of the legacy readiness/analysis fields.
 */
export function saveFabReport(sessionId: string, report: FabReport): void {
  const db = getDatabase();
  ensureAnalysisColumns();

  const payload = JSON.stringify(report);

  // Upsert-ish: append a new analysis row carrying the report. We don't update
  // an existing row because the analysis table is append-only by design.
  db.prepare(`
    INSERT INTO analysis (session_id, readiness_score, fit_score, roi_estimate, efficiency_estimate, key_observations, recommendations, report_json)
    VALUES (?, 0, 0, 0, 0, ?, ?, ?)
  `).run(
    sessionId,
    JSON.stringify(report.needs),
    JSON.stringify(report.recommendations.map((r) => `${r.product} — ${r.reason}`)),
    payload
  );
}

/**
 * Fetch the most recent FabReport stored for a session.
 */
export function getFabReport(sessionId: string): FabReport | null {
  const db = getDatabase();
  ensureAnalysisColumns();
  const row = db.prepare(
    'SELECT report_json FROM analysis WHERE session_id = ? AND report_json IS NOT NULL ORDER BY created_at DESC LIMIT 1'
  ).get(sessionId) as { report_json?: string } | undefined;
  if (!row || !row.report_json) return null;
  try {
    return JSON.parse(row.report_json) as FabReport;
  } catch {
    return null;
  }
}

export function getLatestAnalysis(sessionId: string): Analysis | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM analysis WHERE session_id = ? ORDER BY created_at DESC LIMIT 1').get(sessionId) as any;
  if (!row) return null;
  return {
    id: row.id,
    sessionId: row.session_id,
    readinessScore: row.readiness_score,
    fitScore: row.fit_score,
    roiEstimate: row.roi_estimate,
    efficiencyEstimate: row.efficiency_estimate,
    keyObservations: JSON.parse(row.key_observations || '[]'),
    recommendations: JSON.parse(row.recommendations || '[]'),
    enterpriseMetrics: row.enterprise_metrics ? JSON.parse(row.enterprise_metrics) : undefined,
    executiveSummary: row.executive_summary || undefined,
    industryContext: row.industry_context || undefined,
    nextSteps: row.next_steps ? JSON.parse(row.next_steps) : [],
    createdAt: row.created_at,
  };
}

// Get all leads (for admin)
export function getAllLeads(): Lead[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all() as any[];
  return rows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    name: row.name,
    email: row.email,
    company: row.company,
    role: row.role,
    industry: row.industry || '',
    aiStatus: row.ai_status,
    useCases: row.use_cases,
    createdAt: row.created_at,
    fabAnswers: row.fab_answers ? safeParse<FabAnswers>(row.fab_answers, {}) : {},
    companyResearch: row.company_research ? safeParse<CompanyResearch | undefined>(row.company_research, undefined) : undefined,
  }));
}
