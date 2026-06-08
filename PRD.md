# FAB SME AI Onboarding Agent — PRD

> Built by re-skinning the AllysAI Readiness engine (identify → research → interview → report) with FAB SME product knowledge. Demo target: Monday FAB session.

## 1. Goal

A live, conversational onboarding experience for an SME joining FAB, modeled on Whoop's guided onboarding. The agent interviews the business one question at a time, researches the company, and produces a tailored needs analysis fitted to FAB products.

**Demo emphasis**: onboarding (the app made AI-first). Live company entry with graceful fallback and a pre-vetted backup. Compliance lives in the governed layer and is only discussed if asked.

## 2. Design principles (from Whoop)

1. One question per screen. Never a form.
2. Conversational, second person.
3. Reflect back after high-signal answers.
4. Progressive commitment: easy questions first, sharper money questions later.
5. Personalised payoff (the final report).
6. Visible progress.

**Tone**: warm, confident, banker-grade but human. Short sentences. No jargon. Smart relationship manager, not a wizard form.

## 3. End-to-end flow

| Stage | Description |
|-------|-------------|
| 0. Welcome | Single warm screen. Start button. |
| 1. Identify | Q1 name, Q2 company (conversational). |
| 2. Research | Look up the company. Reflect sector/size/what they do back. Graceful fallback if thin. |
| 3. Interview | Q3–Q8 (one per screen). Reflect back after high-signal answers. |
| 4. Synthesis | Brief visible "Putting your setup together" moment. |
| 5. Report | Snapshot + needs + recommended FAB setup. |

## 4. Question script

| # | Agent asks | Captures | Unlocks |
|---|-----------|----------|---------|
| Q1 | "First, who am I speaking with?" | name | personal tone |
| Q2 | "And what's the name of your business?" | company | triggers research |
| — | RESEARCH + reflect-back | sector, size, what they do | research wow |
| Q3 | "In a sentence, what does [Company] actually do day to day?" | business description | sector tailoring |
| Q4 | "How big is the team right now, roughly, and how long have you been going?" | size + stage | account tier (Basic / Advantage), Commercial Card |
| Q5 | "Do you buy from or sell to anyone outside the UAE?" | cross-border | Trade & Working Capital (LC, Bank Guarantee, import/export finance), FX Solutions |
| Q6 | "When you invoice a customer, how long until you actually get paid?" | payment terms | Working Capital loan, Invoice Discounting, Working Capital Intelligence |
| Q7 | "Do customers pay you by card, in store or online?" | payment method | Magnati POS, Business in a Box |
| Q8 | "What's the biggest financial headache in running [Company] right now?" | stated pain | report prioritisation |
| Q9 (opt) | "Anything big coming up — hiring, new premises, new equipment?" | growth plans | Asset Financing, Mortgage |

## 5. Agent reasoning chain

1. Always: Business Account at the right tier (Basic for new/small, Advantage for growing). Add Call / Fixed Deposit if idle cash.
2. Cross-border (Q5): Trade & Working Capital + FX Solutions.
3. Long payment terms / cash gap (Q6): Working Capital loan or Invoice Discounting; if confirmed delivered contracts → Working Capital Intelligence flagship.
4. Card or online payments (Q7): Magnati POS, Business in a Box.
5. Stated headache (Q8): prioritise report around it.
6. Growth (Q9): Asset Financing or Mortgage.
7. Always: Commercial Card for spend control, SME Rewards enrolment.

**Rules**: Tie every recommendation to a stated fact. 3–5 recommendations, not a catalogue. Describe by name and purpose — never quote rates / fees / minimum balances. Include one proactive "you didn't ask, but..." item inside the products section.

## 6. Report spec

Three sections.

### A. Business snapshot
One short paragraph reflecting research + answers back: company, sector, rough size, what they do, key facts.

### B. Needs analysis
3–5 bullet needs, each one sentence, each traceable to an answer. Example: "A cash conversion gap of about 60 days between paying suppliers and getting paid."

### C. Recommended FAB setup
3–5 lines + one proactive item. Format per line: `[FAB product] — [what it does for them] — [the fact it answers]`. End with one-line "your starting point": account tier + 2–3 priority products + next step.

**Guardrails**: every product cites the triggering fact. No rates / fees / balances stated as fact. KYC / AML / verification = governed layer, only mentioned if asked. 3–5 recommendations max.

## 7. FAB SME product knowledge (8 pillars + 2 ecosystem)

1. **Accounts** — Business Basic, Business Advantage, Premier, Call & Fixed Deposit.
2. **Commercial Cards** — Credit Card, Debit Card (Platinum lounge access at higher tiers).
3. **Loans** — Working Capital Loans, Asset Financing, Invoice Discounting, SME Facilities, POS Loan.
4. **Mortgages** — Commercial property, Residential.
5. **Trade & Working Capital** — Letter of Credit, Bank Guarantee / Standby LC, Documentary Collection, Trade Financing, Working Capital facilities (incl. Working Capital Intelligence flagship).
6. **FX Solutions** — Spot FX, FX hedging / forwards.
7. **Insurance & Wealth (Bancassurance)** — Property All Risk, Keyman, Wealth & Investment.
8. **Cash Management** — Business Portal, Payments & Collections (incl. WPS payroll), Liquidity Management.

**Ecosystem**: Magnati (POS, e-commerce, Business in a Box) + FAB SME Rewards.

## 8. Build approach (re-skin, not rewrite)

| Component | Action |
|-----------|--------|
| Backend engine (pipeline, websocket, STT, TTS) | KEEP |
| `backend/src/config/question-library.ts` | REPLACE with linear 8-question FAB script |
| `backend/src/config/prompts.ts` | REWRITE with FAB RM tone + 3-section report instructions |
| `backend/src/config/case-references.ts` | DELETE |
| `backend/src/config/industry-insights.ts` | DELETE or repurpose |
| `backend/knowledge/readiness-kb.json` | REPLACE with `fab-products-kb.json` |
| `backend/src/services/analysis.service.ts` | REWRITE to produce snapshot / needs / products |
| `backend/src/services/conversation-analyzer.service.ts` | SIMPLIFY (no readiness scoring) |
| `backend/src/services/rag.service.ts` | KEEP, repoint to new Pinecone index |
| `backend/scripts/populate-pinecone.ts` | UPDATE for FAB KB + new index `fab-sme-kb` |
| Research step | NEW: simple LLM-backed company lookup with backup |
| Frontend logo / colors / copy | RE-SKIN to FAB navy / red |
| Frontend `OnboardingPage` | REPLACE with FAB welcome screen (Stage 0) |
| Frontend `ConsultationPage` | KEEP chat UI; add progress indicator; final-screen report cards |
| `MetricsPanel`, `pdfGenerator` | SIMPLIFY: snapshot / needs / products instead of readiness scores |

## 9. Out of scope

- KYC / AML / document verification flows (governed layer).
- Pricing, rate, or balance quotes.
- Exhaustive product catalogue.

## 10. Demo-day resilience checklist

- [ ] Live company entry is the headline.
- [ ] Pre-vetted backup company (UAE logistics importer) loadable as "we ran one earlier".
- [ ] If research thin, agent asks rather than asserts.
- [ ] Every recommendation tied to a stated fact.
- [ ] No rates / balances quoted. Compliance only if asked.
- [ ] Whole run under a few minutes: 6–8 questions, fast synthesis, the report.

## 11. Environment

- **Pinecone API key**: `pcsk_5fGTz_2KfxCLTWMSeoZq4mzW4cbZHEsukLS4CXsTu6bfpYxZQf7QNrW9pQDDw4csTFCXu`
- **Pinecone index**: `fab-sme-kb` (new)
- **Backend port**: 3002 (existing)
- **Frontend port**: 5174 (existing)
- **Model**: GPT-4o for analysis, GPT-4o-mini for chat (existing default)

## 12. Success criteria for the demo

1. SME completes 6–8 question flow in < 4 minutes.
2. Research step reflects something true about the entered company.
3. Final report names 3–5 FAB products, each tied to a fact the SME shared.
4. Worked sample (logistics importer) produces the canonical report from the brief.
5. No mention of rates, fees, KYC, or AML.
