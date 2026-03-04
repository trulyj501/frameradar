# FrameRadar (프레임 레이더)

글 속 프레이밍 신호를 분석해 주체적이고 비판적인 읽기를 돕는 서비스입니다. 단정적인 사실 확인(Fact Check)이 아닌, 텍스트가 의도적으로 감정을 자극하거나 편향을 유도하는 패턴을 탐지합니다.

## Tech Stack

- **Frontend:** React (Vite), TypeScript, TailwindCSS, Recharts
- **Backend:** Node.js, Express, TypeScript
- **Database:** Supabase (PostgreSQL)
- **AI Analysis:** Google Gemini API

## Core Features
 
- 뉴스 기사, 칼럼 등의 URL 또는 본문 텍스트 입력 및 분석
- 5가지 핵심 프레이밍 신호 탐지:
  - 감정 자극 (Emotional Heat)
  - 도덕적 분노 (Moral Outrage)
  - 흑백논리 (Black & White Thinking)
  - 편가르기 (Us vs Them)
  - 갈등 조장 (Fight-Picking)
- 분석 점수에 따른 프레이밍 지수 시각화 (레이더 차트)
- 주간 및 전체 기간 기준 리더보드 (가장 강한 텍스트 랭킹)

## Run Locally

루트 폴더에서 아래 명령어들을 실행합니다:

```bash
# 1. 패키지 설치
npm install

# 2. 로컬 개발 서버 실행
npm run dev
```

환경변수 세팅과 데이터베이스(Supabase) 설정이 필요합니다. 루트 및 각 폴더의 `.env.example` 파일을 참고하여 환경변수를 구성해 주세요.
