import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  createSession,
  getSession,
  createLead,
  getLeadBySession,
  updateLead,
  getMessages,
  getLatestAnalysis,
  getAllLeads,
  updateSessionStatus,
  updateFabAnswers,
  updateCompanyResearch,
  getFabReport,
} from '../services/database.service.js';
import { generateFabReport } from '../services/analysis.service.js';
import { getBackupCompany } from '../services/research.service.js';
import { isEmailServiceConfigured } from '../services/email.service.js';
import { isSheetsServiceConfigured, appendLeadRow } from '../services/sheets.service.js';
import { Lead } from '../types/index.js';

const router = Router();

// Helper to get session ID from params (Express types params as string | string[])
const getSessionId = (req: Request): string => req.params.id as string;

// Create new session for the FAB onboarding flow.
// All lead fields are optional — Q1/Q2 will capture name + company during chat.
// Optional `useBackup: true` pre-fills the pre-vetted demo company.
router.post('/start', async (req: Request, res: Response) => {
  try {
    const {
      name = '',
      email = '',
      company = '',
      role = 'SME Owner',
      industry = '',
      aiStatus = 'not_started',
      useCases = '',
      useBackup = false,
    } = req.body || {};

    const sessionId = uuidv4();
    const session = createSession(sessionId);

    let lead: Lead = {
      sessionId,
      name,
      email,
      company,
      role,
      industry,
      aiStatus,
      useCases,
    };

    // Backup-demo path: hydrate the lead with the pre-vetted SME so the demo
    // can survive thin live research.
    if (useBackup) {
      const backup = getBackupCompany();
      lead = {
        ...lead,
        name: backup.suggestedAnswers.name || lead.name,
        company: backup.name,
      };
    }

    createLead(lead);

    if (useBackup) {
      const backup = getBackupCompany();
      updateFabAnswers(sessionId, backup.suggestedAnswers);
      updateCompanyResearch(sessionId, backup.research);
    }

    if (isSheetsServiceConfigured()) {
      appendLeadRow(sessionId, lead).catch((err) =>
        console.warn('[Session Start] Sheets append error:', err)
      );
    }

    res.json({
      sessionId,
      createdAt: session.createdAt,
      useBackup: !!useBackup,
    });
  } catch (error) {
    console.error('Session creation failed:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Get session details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const session = getSession(getSessionId(req));
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const lead = getLeadBySession(getSessionId(req));
    const analysis = getLatestAnalysis(getSessionId(req));

    res.json({
      session,
      lead,
      analysis,
    });
  } catch (error) {
    console.error('Get session failed:', error);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

// Update lead information
router.patch('/:id/lead', async (req: Request, res: Response) => {
  try {
    const session = getSession(getSessionId(req));
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    updateLead(getSessionId(req), req.body);
    const lead = getLeadBySession(getSessionId(req));

    res.json({ lead });
  } catch (error) {
    console.error('Update lead failed:', error);
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

// Get conversation transcript
router.get('/:id/transcript', async (req: Request, res: Response) => {
  try {
    const session = getSession(getSessionId(req));
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const messages = getMessages(getSessionId(req));

    res.json({ messages });
  } catch (error) {
    console.error('Get transcript failed:', error);
    res.status(500).json({ error: 'Failed to get transcript' });
  }
});

// Trigger analysis
router.post('/:id/analyze', async (req: Request, res: Response) => {
  try {
    const session = getSession(getSessionId(req));
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const lead = getLeadBySession(getSessionId(req));
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const report = await generateFabReport(getSessionId(req), lead);

    res.json({ report });
  } catch (error) {
    console.error('Analysis failed:', error);
    res.status(500).json({ error: 'Failed to analyze session' });
  }
});

// Generate report
router.get('/:id/report', async (req: Request, res: Response) => {
  try {
    const session = getSession(getSessionId(req));
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const lead = getLeadBySession(getSessionId(req));
    const messages = getMessages(getSessionId(req));
    const fabReport = getFabReport(getSessionId(req));

    const payload = {
      generatedAt: new Date().toISOString(),
      session: {
        id: session.id,
        startedAt: session.createdAt,
        endedAt: session.endedAt,
        status: session.status,
      },
      lead: {
        name: lead?.name,
        companyName: lead?.fabAnswers?.companyName || lead?.company,
        fabAnswers: lead?.fabAnswers,
        companyResearch: lead?.companyResearch,
      },
      report: fabReport,
      conversationSummary: {
        messageCount: messages.length,
        userMessages: messages.filter((m) => m.role === 'user').length,
        assistantMessages: messages.filter((m) => m.role === 'assistant').length,
      },
    };

    res.json(payload);
  } catch (error) {
    console.error('Report generation failed:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// End session - triggers analysis + email delivery
router.post('/:id/end', async (req: Request, res: Response) => {
  try {
    const sessionId = getSessionId(req);
    const session = getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    updateSessionStatus(sessionId, 'completed');

    // Best-effort: ensure a FAB report is generated and stored.
    const lead = getLeadBySession(sessionId);
    if (lead) {
      generateFabReport(sessionId, lead).catch((err) => {
        console.error('[Session End] Report generation error:', err);
      });
    }

    res.json({ success: true, emailConfigured: isEmailServiceConfigured() });
  } catch (error) {
    console.error('End session failed:', error);
    res.status(500).json({ error: 'Failed to end session' });
  }
});

// Admin: Get all leads with their analysis data
router.get('/admin/leads', async (req: Request, res: Response) => {
  try {
    const leads = getAllLeads();

    // Enrich leads with their analysis data
    const enrichedLeads = leads.map((lead) => {
      const analysis = getLatestAnalysis(lead.sessionId);
      const session = getSession(lead.sessionId);
      const messages = getMessages(lead.sessionId);

      return {
        ...lead,
        session: session ? {
          status: session.status,
          createdAt: session.createdAt,
          endedAt: session.endedAt,
        } : null,
        analysis: analysis ? {
          readinessScore: analysis.readinessScore,
          fitScore: analysis.fitScore,
          roiEstimate: analysis.roiEstimate,
          efficiencyEstimate: analysis.efficiencyEstimate,
          keyObservations: analysis.keyObservations,
          recommendations: analysis.recommendations,
        } : null,
        messageCount: messages.length,
      };
    });

    res.json({ leads: enrichedLeads, count: enrichedLeads.length });
  } catch (error) {
    console.error('Get leads failed:', error);
    res.status(500).json({ error: 'Failed to get leads' });
  }
});

// Admin: Get all sessions with full data
router.get('/admin/sessions', async (req: Request, res: Response) => {
  try {
    const leads = getAllLeads();

    const sessions = leads.map((lead) => {
      const session = getSession(lead.sessionId);
      const analysis = getLatestAnalysis(lead.sessionId);
      const messages = getMessages(lead.sessionId);

      return {
        sessionId: lead.sessionId,
        session,
        lead,
        analysis,
        messages,
        conversationSummary: {
          totalMessages: messages.length,
          userMessages: messages.filter(m => m.role === 'user').length,
          assistantMessages: messages.filter(m => m.role === 'assistant').length,
        },
      };
    });

    res.json({ sessions, count: sessions.length });
  } catch (error) {
    console.error('Get sessions failed:', error);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

// Admin: Export all data as JSON
router.get('/admin/export', async (req: Request, res: Response) => {
  try {
    const leads = getAllLeads();

    const fullExport = leads.map((lead) => {
      const session = getSession(lead.sessionId);
      const analysis = getLatestAnalysis(lead.sessionId);
      const messages = getMessages(lead.sessionId);

      return {
        exportedAt: new Date().toISOString(),
        sessionId: lead.sessionId,
        session,
        lead,
        analysis,
        transcript: messages,
      };
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=fab-sme-export-${new Date().toISOString().split('T')[0]}.json`);
    res.json({ data: fullExport, exportedAt: new Date().toISOString(), totalSessions: fullExport.length });
  } catch (error) {
    console.error('Export failed:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

export default router;
