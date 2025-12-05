# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CareGuide is a web platform for Chronic Kidney Disease (CKD) patients providing AI chatbot-based medical information, nutrition management, and community features. It uses a Python FastAPI backend with a React TypeScript frontend.

## Common Commands

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload        # Runs on port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev      # Development server on port 5173
npm run build    # Build for production (runs tsc first)
npm run lint     # ESLint check
npm run preview  # Preview production build
```

### Testing
```bash
python backend/Agent/test_agents.py  # Test agent system
```

### API Documentation
- Swagger UI: http://localhost:8000/docs
- Health check: http://localhost:8000/health

## Architecture

### Agent System (Core Innovation)

The project implements a specialized agent orchestration system in `backend/Agent/`:

```
User Request → FastAPI → Agent Manager → Specialized Agent → Response
                              ↓
         ┌──────────────┬─────────────┬──────────────┐
         ↓              ↓             ↓              ↓
   Research Paper  Nutrition   Medical Welfare  Trend Viz
   (papers/PubMed) (diet)      (benefits)       (analytics)
```

**Key Components:**
- `agent_manager.py` - Central routing and orchestration
- `base_agent.py` - Abstract base class (all agents implement `process()` and `estimate_context_usage()`)
- `session_manager.py` - Session lifecycle with 30-minute timeout
- `context_tracker.py` - Token usage tracking (20k limit per session)

**Agent Types:**
- `research_paper/` - Research paper search using Parlant framework + vector DB
- `nutrition/` - CKD-specific dietary recommendations
- `medical_welfare/` - Healthcare benefits information
- `trend_visualization/` - Analytics and dashboard data

### FastAPI Application

`backend/app/` contains the HTTP layer:
- `main.py` - App entry point with CORS config
- `api/` - Route handlers (auth, chat, nutri, community, trends)
- `services/` - Business logic (hybrid_search, pubmed_search)
- `db/` - Database layer (mongodb_manager, vector_manager)

### Frontend

React SPA in `frontend/src/`:
- `App.tsx` - Route definitions using React Router v6
- `pages/` - Page components (Home, Chat, Nutri, Community, Trends, MyPage, SignUp)
- Uses Tailwind CSS for styling
- Vite proxy forwards `/api/*` to backend on port 8000

## Key Patterns

### Async/Await
All agent methods and database operations are async.

### Standardized Contracts
```python
# Agent/core/contracts.py
AgentRequest  # Pydantic model for input
AgentResponse # Pydantic model for output
```

### Response Format
```python
{
    "success": True,
    "agent_type": "research_paper",
    "result": {
        "response": "...",
        "tokens_used": 1234,
        "sources": [...]
    },
    "context_info": {
        "current_usage": 1234,
        "max_limit": 20000,
        "remaining": 18766
    }
}
```

## Environment Setup

Required in `.env` (see `.env.sample`):
```
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
PINECONE_API_KEY=pcsk_...
MONGODB_URI=mongodb://localhost:27017
PUBMED_EMAIL=user@example.com
PUBMED_API_KEY=...  # Optional, improves speed
```

MongoDB must be running:
```bash
# Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

## Data Sources

1. QA Dataset - Korean kidney association FAQs
2. Research Papers - 4,850+ papers with embeddings in MongoDB Atlas Vector Search
3. Medical Data - Healthcare protocols and guidelines
4. PubMed API - Real-time paper search

Preprocessing scripts in `preprocess/` handle data filtering and embedding generation.

## Adding New Features

### New Agent
1. Create `Agent/new_feature/agent.py` extending `BaseAgent`
2. Implement `async def process()` and `estimate_context_usage()`
3. Create `Agent/new_feature/prompts.py`
4. Register in `agent_manager.py` under `self.agents`

### New API Endpoint
1. Create handler in `backend/app/api/new_feature.py`
2. Add route in `main.py`
3. Add frontend route in `frontend/src/App.tsx`

## AI Chatbot UX/UI 정책

### 시작 메시지 및 Fewshot 규칙
- **시작 메시지**: 대화가 시작되어도 절대 사라지지 않음 (채팅 기록 최상단 고정)
- **Fewshot Bubble**: 시작 메시지 하단에 항상 표시
- 시작 메시지는 chat session 대화 기록에 포함하여 저장

### Agent별 대화 분리
- 각 Agent(의료복지, 식이영양, 연구논문)별로 대화 이력 독립 관리
- Agent 전환 시 해당 Agent의 빈 화면 + 시작 메시지 + Fewshot 표시
- 다시 돌아오면 이전 대화 이력 복원

### 의도분류 정책
- 현재 사용자 입력의 의도만 분류 (이전 컨텍스트는 참고용)
- 사용자가 직접 질문하지 않은 정보는 답변에 먼저 포함 금지
- 의료 분야이므로 맥락이 맞는지 반드시 재확인 후 답변

### Agent별 응답 정책
- 해당 Agent 분야: 상세 답변 (카드뉴스, 템플릿 등)
- 다른 분야 질문: 마크다운 텍스트 150단어 이내 (시각적 템플릿 없음)

### Inactivity 정책
- 10분 비활성: "응답이 없으신 경우, 챗봇 세션이 3분 후 종료됩니다." 경고
- 13분 비활성: 자동 세션 종료

### 정책 9: UX 최적화 - 대기 안내 메시지 (Loading Message)
대용량 데이터 조회 시 (3초 이상 소요 예상) 사용자에게 먼저 안내 메시지를 표시하여 UX를 개선합니다.

**적용 대상 Agent:**
- `research_paper`: PubMed에서 논문 검색
- `medical_welfare`: 의료복지 데이터베이스 검색
- `nutrition`: 식이영양 데이터베이스 검색

**메시지 템플릿:**
```python
LOADING_MESSAGE_CONFIG = {
    "research_paper": {
        "data_source": "PubMed",
        "template": "'{topic}'에 대해 PubMed에서 관련된 연구 논문 자료를 찾아보겠습니다. 잠시만 기다려 주세요."
    },
    "medical_welfare": {
        "data_source": "의료복지 데이터베이스",
        "template": "'{topic}'에 대해 의료복지 데이터베이스에서 찾아보겠습니다. 잠시만요."
    },
    "nutrition": {
        "data_source": "식이영양 데이터베이스",
        "template": "'{topic}'에 대해 식이영양 데이터베이스에서 찾아보겠습니다. 잠시만요."
    }
}
```

**API 응답에 포함되는 정보:**
```json
{
    "loading_info": {
        "loading_message": "'당뇨성 신장병 예방'에 대해 PubMed에서 관련된 연구 논문 자료를 찾아보겠습니다. 잠시만 기다려 주세요.",
        "data_source": "PubMed",
        "requires_loading": true
    }
}
```

**프론트엔드 구현 가이드:**
1. 사용자 메시지 전송 후 즉시 `loading_info.loading_message`를 AI 버블로 표시
2. 실제 응답(`message`)이 오면 로딩 메시지를 실제 응답으로 교체
3. 로딩 중임을 시각적으로 표시 (타이핑 인디케이터 등)

## Frontend 스타일 가이드 (절대 변경 금지)

### 반응형 레이아웃 규칙
- **모바일**: 하단에 MobileNav(64px) 존재
- **데스크탑/태블릿(lg:)**: 좌측에 Sidebar(280px), 상단에 Header(64px)

### 챗봇 입력창 위치 (절대 변경 금지!)
```
모바일: fixed bottom-[64px] left-0 right-0  (하단 메뉴 위에 고정)
데스크탑: lg:absolute lg:bottom-0  (body content 영역 내 하단)
```
- 모바일에서는 MobileNav 위에 띄움
- 데스크탑/태블릿에서는 body content 영역 안에서 하단 floating
- **이 위치 설정은 절대 수정하지 말 것!**

### Body Content 영역
- 데스크탑: `lg:pt-16 lg:pl-[280px]` (Header + Sidebar 고려)
- 모바일: `pb-[64px]` (MobileNav 고려)
- 모든 컴포넌트는 body content 영역을 벗어나면 안 됨

## Current Status

- Agent system framework: Complete
- Research paper agent: Partially implemented (Parlant integration)
- Other agents: Stub implementations
- Frontend pages: Layouts ready, mostly stubs
- Authentication: Framework ready, needs completion
