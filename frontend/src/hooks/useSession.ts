import { useState, useCallback } from 'react';
import { Lead } from '../types';
import { useSessionStore } from '../stores/sessionStore';

// Use relative URLs to leverage Vite proxy in development
const API_URL = import.meta.env.VITE_BACKEND_URL || '';

export function useSession() {
  const [isLoading, setIsLoading] = useState(false);
  const { setSessionId, setLead, sessionId, lead, error, setError } = useSessionStore();

  // Start a new session
  const startSession = useCallback(async (leadData: Lead) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/session/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(leadData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start session');
      }

      const data = await response.json();
      setSessionId(data.sessionId);
      setLead(leadData);

      return data.sessionId;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start session';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [setSessionId, setLead, setError]);

  // Get session details
  const getSession = useCallback(async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/api/session/${id}`);
      if (!response.ok) {
        throw new Error('Session not found');
      }
      return await response.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get session';
      setError(message);
      throw err;
    }
  }, [setError]);

  // Get report
  const getReport = useCallback(async () => {
    if (!sessionId) return null;

    try {
      const response = await fetch(`${API_URL}/api/session/${sessionId}/report`);
      if (!response.ok) {
        throw new Error('Failed to generate report');
      }
      return await response.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get report';
      setError(message);
      throw err;
    }
  }, [sessionId, setError]);

  // End session
  const endSession = useCallback(async () => {
    if (!sessionId) return;

    try {
      await fetch(`${API_URL}/api/session/${sessionId}/end`, {
        method: 'POST',
      });
    } catch (err) {
      console.error('Failed to end session:', err);
    }
  }, [sessionId]);

  return {
    isLoading,
    error,
    sessionId,
    lead,
    startSession,
    getSession,
    getReport,
    endSession,
  };
}
