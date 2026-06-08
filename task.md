# FAB SME Agent — Task Tracker

> Live progress board for the FAB re-skin. Cross items off as they complete.

## 0. Setup
- [x] Clone allysai-consultant-agent into /Users/roshankharel/Code/fab_consulting_agent
- [x] Remove old git origin, init fresh repo
- [x] Read both FAB briefs (Onboarding Build Brief + Product Knowledge)
- [x] Write PRD.md
- [x] Create task.md

## 1. Backend — knowledge + config
- [x] Replace `backend/knowledge/readiness-kb.json` with `fab-products-kb.json` (30 docs, 8 pillars + Magnati + SME Rewards)
- [x] Rewrite `backend/src/config/question-library.ts` → linear 9-question FAB script (Q9 optional)
- [ ] Rewrite `backend/src/config/prompts.ts` → FAB RM tone + 3-section report instructions (in progress)
- [ ] Delete `backend/src/config/case-references.ts`
- [ ] Delete `backend/src/config/industry-insights.ts`
- [x] Update `backend/.env.example` with FAB Pinecone key + index `fab-sme-kb`

## 1b. Integration follow-ups (flagged by Agent 1)
- [ ] Repoint `backend/src/services/rag.service.ts` to read `fab-products-kb.json` + new metadata shape
- [ ] Delete or rewrite `backend/scripts/populate-kb.ts` (duplicates populate-pinecone.ts and references deleted file)
- [ ] `Lead` type required fields (email/role/industry/aiStatus/useCases) need to be made optional — FAB flow only collects name + company at start

## 2. Backend — services
- [x] Rewrite `backend/src/services/analysis.service.ts` → produces `FabReport`; back-compat shims for old callers
- [x] Add `backend/src/services/research.service.ts` → live + backup company lookup (Falcon Components Trading LLC)
- [x] Update `backend/src/services/llm.service.ts` → drop v21Context, add `extractFabAnswerFromUserMessage`
- [x] Update `backend/src/services/database.service.ts` → `saveFabReport` / `getFabReport`
- [x] Update `backend/scripts/populate-pinecone.ts` for FAB KB + new index
- [x] Update `backend/src/types/index.ts` — added `FabAnswers`, `FabReport`, `FabRecommendation`, `CompanyResearch`
- [ ] Wire pipeline.service.ts orchestration (Q2 → research → reflect-back → Q3, extract answers, call generateFabReport)
- [ ] Delete `conversation-analyzer.service.ts` (dormant, no longer wired)

## 3. Frontend — branding + UX
- [ ] Replace logo, colors, copy with FAB branding (navy / red)
- [ ] Rewrite `frontend/src/pages/OnboardingPage.tsx` → FAB Stage 0 welcome screen
- [ ] Add progress indicator to `ConsultationPage`
- [ ] Replace `MetricsPanel` with `FabReportPanel` (snapshot/needs/products)
- [ ] Simplify `frontend/src/utils/pdfGenerator.ts` for FAB report
- [ ] Update `frontend/src/types/index.ts` for new shapes
- [ ] Update suggested questions / quick actions
- [ ] Update page titles + meta

## 4. Demo resilience
- [ ] Pre-vetted backup company (mid-size UAE logistics importer) selectable
- [ ] Reflect-back UI element after research
- [ ] Fallback flow when research returns thin

## 5. Cleanup
- [ ] Delete `docs/ralph-metrics-implementation-progress.md`
- [ ] Update root `README.md` for FAB
- [ ] Remove "AllysAI", "Simo", "ai_readiness" references

## 6. Verify
- [x] Backend `npm install` (clean)
- [x] Frontend `npm install` (clean)
- [x] Backend `tsc --noEmit` (zero errors)
- [x] Frontend `tsc --noEmit` (zero errors)
- [x] Frontend `npm run build` (1.28s, no errors)
- [x] Backend `npm run build` + boot — loads 30 FAB products, health endpoint green
- [x] Migrations: `fab_answers` + `company_research` + `report_json` columns added on first boot
- [ ] **BLOCKED**: Populate Pinecone with FAB KB — the provided API key was rejected by Pinecone (`PineconeAuthorizationError`). Backend runs on local-KB fallback (30 docs loaded, keyword search active). Regenerate key in Pinecone console + create `fab-sme-kb` index (1536 dims, cosine), then `npm run populate-pinecone`.
- [x] OPENAI_API_KEY validated and written to `backend/.env` (gitignored).
- [x] Walk through worked sample (logistics importer) end-to-end — `POST /api/session/start {useBackup:true}` → `POST /api/session/:id/analyze` returns a complete FabReport.
- [x] Confirm report renders 3 sections correctly — snapshot ✓, 4 needs ✓, 5 recommendations with triggering facts ✓, exactly 1 proactive flag (FX Forwards) ✓, startingPoint ✓.

## 7. Demo-ready status — VERIFIED LIVE
- Backend serves on :3002, frontend Vite dev server on :5174 (`<title>FAB SME Setup</title>`).
- `POST /api/session/start` accepts `{useBackup:true}` for the pre-vetted SME demo path.
- WebSocket emits `progress`, `research`, `report` events as the linear flow advances.
- **Worked sample (backup)** matches PRD section 6 verbatim — Falcon Components Trading LLC → Working Capital Loan, Trade Financing, Invoice Discounting, Commercial Credit Card, FX Forwards proactive.
- **Live test (Bright Print Studio, fresh session, no backup)**: 8 turns of natural reflect-back conversation, graceful research fallback when LLM didn't know the company (`source:'thin'`), report with snapshot + 3 needs + 4 recommendations (Business Advantage Account, Invoice Discounting, Magnati POS, Commercial Credit Card proactive) + starting-point. Magnati POS correctly surfaced from "some clients want to pay by card".

## 8. Repo
- Pushed to `https://github.com/geekyroshan/fab-agent` (`main` branch).
- 3 commits: baseline re-skin → worked-sample verified → live-chat verified.
