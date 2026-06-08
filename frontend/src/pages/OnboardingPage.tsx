import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../hooks/useSession';
import { Lead } from '../types';

/**
 * Stage 0 — FAB welcome screen.
 * Single warm screen with a primary "Start" CTA and a subtle
 * "Use a demo company" secondary link. No form fields — questions
 * live in the conversation, not in a form.
 */
export function OnboardingPage() {
  const navigate = useNavigate();
  const { startSession, isLoading, error } = useSession();
  const [useBackup, setUseBackup] = useState(false);

  const handleStart = async (withBackup = false) => {
    // The 8 questions capture name + company + everything else. We pass
    // safe placeholders so existing /api/session/start contracts don't break;
    // the backend backfills from FabAnswers.
    const lead: Lead = {
      name: '',
      email: '',
      company: '',
      role: 'SME Owner',
      industry: '',
      aiStatus: 'not_started',
      useCases: '',
    };

    try {
      // Use a typed extension to plumb useBackup through to the backend
      // without breaking the existing startSession signature.
      const leadPayload = withBackup
        ? ({ ...lead, useBackup: true } as Lead & { useBackup: true })
        : lead;

      setUseBackup(withBackup);
      await startSession(leadPayload);
      navigate('/consultation');
    } catch {
      // Error is surfaced via the hook's `error` state below.
    }
  };

  return (
    <div className="min-h-screen bg-fab-cream flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-xl text-center">
        {/* Logo */}
        <div className="mb-10 flex justify-center">
          <img
            src="/fab-logo.svg"
            alt="FAB"
            className="h-12 sm:h-14 w-auto"
          />
        </div>

        {/* Headline */}
        <h1 className="text-fab-navy font-semibold text-2xl sm:text-3xl lg:text-4xl leading-snug mb-4">
          Let's get your business set up with FAB.
        </h1>
        <p className="text-fab-muted text-base sm:text-lg leading-relaxed mb-10 max-w-md mx-auto">
          A few quick questions, and we'll put together a setup tailored for you.
        </p>

        {/* Primary CTA */}
        <button
          type="button"
          onClick={() => handleStart(false)}
          disabled={isLoading}
          className="
            inline-flex items-center justify-center gap-2
            bg-fab-navy text-white font-medium
            px-10 sm:px-12 py-3.5 rounded-md
            text-base sm:text-lg
            shadow-sm
            hover:bg-fab-navy-dark active:bg-fab-navy-dark
            disabled:opacity-60 disabled:cursor-not-allowed
            transition-colors duration-200
            min-w-[180px]
          "
        >
          {isLoading && !useBackup ? 'Starting...' : 'Start'}
        </button>

        {/* Secondary action */}
        <div className="mt-6">
          <button
            type="button"
            onClick={() => handleStart(true)}
            disabled={isLoading}
            className="
              text-sm text-fab-muted underline underline-offset-4
              hover:text-fab-navy transition-colors disabled:opacity-60
            "
          >
            {isLoading && useBackup ? 'Loading sample...' : 'Try with sample data'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-8 mx-auto max-w-sm text-sm text-fab-red bg-fab-red/5 border border-fab-red/20 rounded px-4 py-3">
            {error}
          </div>
        )}

        {/* Footer */}
        <p className="mt-16 text-[11px] tracking-wider text-fab-muted/70 uppercase">
          First Abu Dhabi Bank &middot; SME Onboarding
        </p>
      </div>
    </div>
  );
}
