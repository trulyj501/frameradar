# RageCheck MVP

RageCheck is a text-only framing density analyzer for news content.

It detects manipulative linguistic framing patterns, not factual truth.

## Stack

- Frontend: React (Vite) + TypeScript + TailwindCSS + Recharts
- Backend: Node.js + Express + TypeScript
- Database: Supabase (Postgres)
- AI Analysis: Gemini API (text-only)

## Folder Structure

```text
ragecheck/
├─ backend/
│  ├─ src/
│  │  ├─ lib/
│  │  │  ├─ env.ts
│  │  │  └─ supabase.ts
│  │  ├─ routes/
│  │  │  └─ analysisRoutes.ts
│  │  ├─ services/
│  │  │  ├─ article.ts
│  │  │  ├─ gemini.ts
│  │  │  └─ scoring.ts
│  │  ├─ types/
│  │  │  └─ analysis.ts
│  │  ├─ utils/
│  │  │  └─ text.ts
│  │  ├─ app.ts
│  │  └─ index.ts
│  ├─ .env.example
│  ├─ package.json
│  └─ tsconfig.json
├─ frontend/
│  ├─ src/
│  │  ├─ components/
│  │  │  └─ RadarSignalsChart.tsx
│  │  ├─ pages/
│  │  │  ├─ HomePage.tsx
│  │  │  ├─ LeaderboardPage.tsx
│  │  │  └─ ResultPage.tsx
│  │  ├─ services/
│  │  │  └─ api.ts
│  │  ├─ styles/
│  │  │  └─ index.css
│  │  ├─ types/
│  │  │  └─ api.ts
│  │  ├─ App.tsx
│  │  └─ main.tsx
│  ├─ .env.example
│  ├─ index.html
│  ├─ package.json
│  ├─ tailwind.config.ts
│  └─ vite.config.ts
├─ supabase/
│  └─ schema.sql
├─ .gitignore
├─ package.json
└─ README.md
```

## Core Features Implemented

- Home page with URL input, text paste field, analyze button
- Recent analyses list from Supabase with total rage score
- Analysis engine for five signals:
  - Emotional Heat
  - Moral Outrage
  - Black & White Thinking
  - Us vs Them
  - Fight-Picking
- Score formula implementation:
  - Raw Score = (pattern_count / sentence_count) * weight
  - Normalized Score = Raw Score * (1000 / total_word_count)
  - Contextual correction applied up to -30%
- Result page with:
  - Total Rage Score
  - Radar chart (Recharts)
  - Core facts summary
  - Detailed signal breakdown
  - ClearView left/right framing hypotheses
  - Disclaimer
- Leaderboard with Top 10 and range filter:
  - Last 7 days
  - All time

## Scoring Criteria

- Signal score range: `0~100`
- Risk bands:
  - `낮음`: `0~33`
  - `보통`: `34~66`
  - `높음`: `67~100`
- Formula:
  - `Raw = (pattern_count / sentence_count) * weight`
  - `Normalized = Raw * (1000 / total_word_count)`
  - `Adjusted = Normalized * (1 - contextual_correction)`
  - contextual correction is capped at `-30%`
- Total Rage Score is a weighted 0~100 composite:
  - `Heat 25% + Outrage 20% + BlackWhite 20% + UsThem 20% + Fight 15%`
- Consistency guards:
  - If evidence exists, signal score is never shown as `0`
  - If a signal score is positive but evidence extraction is empty, fallback evidence text is attached

## API Endpoints

- `POST /api/analyze`
- `GET /api/analyses`
- `GET /api/analyses/:id`
- `GET /api/leaderboard?range=7d|all`

## Supabase Setup

1. Create a Supabase project.
2. Run SQL in [`supabase/schema.sql`](/Users/jeongsujin/Downloads/ragecheck/supabase/schema.sql), or use backend init command below.
3. Copy project URL and keys into backend env file.

### Optional: Table Init via Command

From `/Users/jeongsujin/Downloads/ragecheck`:

```bash
npm run db:init --workspace backend
```

Required env (in `backend/.env`):

- `SUPABASE_PROJECT_REF`
- `SUPABASE_DB_PASSWORD`

Or set `SUPABASE_DB_URL` directly.

## Environment Variables

Backend: copy `backend/.env.example` to `backend/.env`

```env
PORT=4000
FRONTEND_ORIGIN=http://localhost:5173
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_PROJECT_REF=your_project_ref
SUPABASE_DB_PASSWORD=your_db_password
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-pro
```

Frontend: copy `frontend/.env.example` to `frontend/.env`

```env
VITE_API_BASE_URL=/api
```

## Run Locally

From `/Users/jeongsujin/Downloads/ragecheck`:

```bash
npm install
npm run dev
```

This starts:

- Backend on `http://localhost:4000`
- Frontend on `http://localhost:5173`

## Production Build

```bash
npm run build
```

## Important Disclaimer

`This is a probabilistic framing analysis tool. Not a fact check.`
