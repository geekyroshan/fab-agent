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
- [ ] **BLOCKED**: Populate Pinecone with FAB KB — the provided API key was rejected by Pinecone (`PineconeAuthorizationError`). The backend runs fine on local-KB fallback (30 docs loaded); fix the key (or generate a new one in the Pinecone console) and re-run `npm run populate-pinecone` when ready. Index name should be `fab-sme-kb`, dim 1536, metric cosine.
- [ ] Walk through worked sample (logistics importer) end-to-end (requires OPENAI_API_KEY to be set in `backend/.env`)
- [ ] Confirm report renders 3 sections correctly (same blocker — needs OpenAI key)
