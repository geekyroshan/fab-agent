# FAB SME AI Onboarding Agent

A live, conversational onboarding experience for SMEs joining FAB. Inspired by Whoop's guided onboarding. Interviews the business one question at a time, researches the company, and produces a tailored needs analysis fitted to FAB products.

> Re-skin of the AllysAI Readiness engine — see `PRD.md` for the full spec.

## What it does

Stage 0 — Welcome → Stage 1 — Identify (name, company) → Stage 2 — Research (live company lookup) → Stage 3 — Interview (6–8 banker-grade questions) → Stage 4 — Synthesis → Stage 5 — Tailored FAB setup report (snapshot + needs + recommended FAB products).

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│   Frontend  │────>│   Backend   │────>│ OpenAI       │
│ (Vite/React)│<────│  (Express)  │<────│ ElevenLabs   │
└─────────────┘     └─────────────┘     │ Pinecone     │
                          │              └──────────────┘
                          v
                    ┌───────────┐
                    │  SQLite   │
                    └───────────┘
```

## Quick start

### Prerequisites
- Node.js 18+
- OpenAI API key
- ElevenLabs API key (voice output)
- Pinecone API key + a `fab-sme-kb` index (1536 dims, cosine, OpenAI `text-embedding-3-small`)

### Backend
```bash
cd backend
cp .env.example .env  # fill in API keys
npm install
npm run populate-pinecone  # one-time: load FAB SME product KB into Pinecone
npm run dev
```

### Frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:5174`.

## Environment variables

See `backend/.env.example` and `frontend/.env.example`. Critical: `PINECONE_INDEX=fab-sme-kb`.

## Project structure

```
fab_consulting_agent/
├── PRD.md                 # FAB build brief & spec
├── task.md                # Live progress tracker
├── backend/
│   ├── knowledge/         # fab-products-kb.json (8 pillars + Magnati + SME Rewards)
│   ├── scripts/           # populate-pinecone.ts
│   └── src/
│       ├── config/        # FAB_QUESTIONS, prompts
│       └── services/      # llm, rag, research, analysis, tts, stt, pipeline
├── frontend/
│   └── src/
│       ├── pages/         # OnboardingPage (Stage 0), ConsultationPage (interview + report)
│       └── components/    # FabReportCard, ChatMessage, VoiceButton
└── .do/app.yaml           # DigitalOcean App Platform deployment spec
```

## Demo notes

- Live company entry is the headline. A pre-vetted backup company (UAE logistics importer) is selectable as "we ran one earlier" for resilience.
- Every recommendation in the final report is tied to a fact the SME shared.
- No rates, fees, or balance thresholds are quoted as fact (FAB compliance).
- KYC, AML, and document verification stay in the governed layer — only mentioned if asked.

## License

Private — FAB.
