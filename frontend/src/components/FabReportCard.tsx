import { FabReport, FabRecommendation } from '../types';

interface FabReportCardProps {
  report: FabReport;
  companyName?: string;
}

/**
 * FabReportCard
 * Renders a FAB SME setup report in three sections:
 *   A. Business snapshot
 *   B. Needs analysis
 *   C. Recommended FAB setup
 * Followed by a "starting point" CTA.
 *
 * Visual: banker-proposal feel using navy / cream / red palette.
 */
export function FabReportCard({ report, companyName }: FabReportCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-fab-navy text-white px-6 py-5">
        <div className="text-[11px] tracking-[0.2em] text-white/70 mb-1">
          FAB SME SETUP
        </div>
        <h2 className="text-xl sm:text-2xl font-semibold leading-tight">
          {companyName ? `Your setup, ${companyName}` : 'Your FAB setup'}
        </h2>
      </div>

      {/* Section A — Business snapshot */}
      <section className="px-6 py-6 border-b border-gray-100">
        <SectionHeader index="A" title="Business snapshot" />
        <p className="text-fab-text leading-relaxed text-[15px] mt-3">
          {report.snapshot}
        </p>
      </section>

      {/* Section B — Needs analysis */}
      <section className="px-6 py-6 border-b border-gray-100 bg-fab-cream/40">
        <SectionHeader index="B" title="Needs analysis" />
        <ul className="mt-3 space-y-2.5">
          {report.needs.map((need, idx) => (
            <li key={idx} className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-1.5 inline-block w-1.5 h-1.5 rounded-full bg-fab-red shrink-0"
              />
              <span className="text-fab-text leading-relaxed text-[14.5px]">
                {need}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Section C — Recommended FAB setup */}
      <section className="px-6 py-6 border-b border-gray-100">
        <SectionHeader index="C" title="Recommended FAB setup" />
        <div className="mt-4 space-y-3">
          {report.recommendations.map((rec, idx) => (
            <RecommendationRow key={`${rec.product}-${idx}`} rec={rec} />
          ))}
        </div>
      </section>

      {/* Starting point */}
      <section className="px-6 py-5 bg-fab-navy/[0.04]">
        <div className="text-[11px] tracking-[0.2em] text-fab-muted mb-1.5">
          YOUR STARTING POINT
        </div>
        <p className="text-fab-navy font-semibold text-[15px] sm:text-base leading-snug">
          {report.startingPoint}
        </p>
      </section>
    </div>
  );
}

function SectionHeader({ index, title }: { index: string; title: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-xs font-semibold text-fab-red tracking-widest">
        {index}
      </span>
      <h3 className="text-base sm:text-lg font-semibold text-fab-navy">
        {title}
      </h3>
    </div>
  );
}

function RecommendationRow({ rec }: { rec: FabRecommendation }) {
  return (
    <div className="border border-gray-200 rounded-md px-4 py-3.5 bg-white">
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-fab-text text-[14.5px]">
            {rec.product}
          </span>
          {rec.category && (
            <span className="text-[10px] tracking-wider text-fab-muted uppercase">
              {rec.category}
            </span>
          )}
        </div>
        {rec.isProactive && (
          <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-fab-gold/15 text-fab-gold border border-fab-gold/30">
            you didn't ask, but...
          </span>
        )}
      </div>
      <p className="text-[13.5px] text-fab-text leading-relaxed">
        {rec.reason}
      </p>
      {rec.triggeringFact && (
        <p className="text-[12px] text-fab-muted mt-1.5 italic">
          Based on: {rec.triggeringFact}
        </p>
      )}
    </div>
  );
}
