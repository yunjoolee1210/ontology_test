# CareKidney 공개 배포 런북 (풀스택)

프론트(React+Vite) + 백엔드(FastAPI) + MongoDB(Atlas) 공개 배포 절차입니다.
배포 플랫폼은 **Render**(GitHub 연동·풀스택 단일 블루프린트) 기준이며, `render.yaml`로 정의돼 있습니다.
프론트만 따로 올리려면 Vercel/Netlify도 가능합니다(맨 아래 참고).

> ⚠️ 코드/설정은 carekidney `dev` 브랜치에 준비돼 있습니다. 아래 **로그인·계정 작업은 직접** 하셔야 합니다.
> 각 단계에서 막히면 Claude가 이어서 진행(데이터 마이그레이션 실행, CLI 구동 등)할 수 있습니다.

---

## 0. 준비물 (계정)
- [ ] MongoDB Atlas 계정 (무료 M0 가능)
- [ ] Render 계정 (https://render.com, GitHub 로그인)
- [ ] 백엔드 시크릿: `OPENAI_API_KEY`, `PINECONE_API_KEY`, `PUBMED_EMAIL`, `PUBMED_API_KEY` (로컬 `.env`에 있음)

## 1. MongoDB Atlas (DB)
1. Atlas에서 클러스터 생성 → **Database User** 생성(username/password)
2. **Network Access** → `0.0.0.0/0` 허용(또는 Render 아웃바운드 IP만)
3. **Connect → Drivers** 에서 SRV URI 복사:
   `mongodb+srv://<user>:<pwd>@<cluster>.mongodb.net/careguide?retryWrites=true&w=majority`
   - DB 이름은 `careguide` 사용(앱 기본값)

### 1-1. 기존 데이터 이전 (선택)
로컬 백업 덤프 위치(원본 작업 폴더):
`ai-camp-1st-llm-agent-service-project-mockinjay/mongodb_backup/backup_20251206_030227/careguide/`
(컬렉션: users, diet_logs, health_records, recipes, notifications, session_logs, token_blacklist, withdrawal_records)

> 논문/영양 임베딩 등 대용량 벡터 데이터는 이 덤프에 없습니다(Pinecone / Atlas Vector Search 별도).

mongodb-database-tools 설치 후 복원:
```bash
brew install mongodb-database-tools   # 로컬에 mongorestore 없음
mongorestore --uri "mongodb+srv://<user>:<pwd>@<cluster>.mongodb.net/" \
  --nsInclude="careguide.*" \
  "<원본폴더>/mongodb_backup/backup_20251206_030227"
```
→ Atlas URI를 알려주시면 Claude가 이 복원을 대신 실행할 수 있습니다.

## 2. Render 배포 (블루프린트)
1. Render Dashboard → **New → Blueprint**
2. carekidney 레포 연결 → 브랜치 **dev** 선택 → `render.yaml` 자동 인식
   (서비스 2개: `carekidney-backend`(docker), `carekidney-frontend`(static))
3. 생성 시 `sync:false` 환경변수 입력 요청 → 아래 표대로 입력

### 백엔드(carekidney-backend) 환경변수
| Key | Value |
|---|---|
| `OPENAI_API_KEY` | (로컬 .env 값) |
| `PINECONE_API_KEY` | (로컬 .env 값) |
| `MONGODB_URI` | Atlas SRV URI (1단계) |
| `PUBMED_EMAIL` | yimyj1210@gmail.com |
| `PUBMED_API_KEY` | (로컬 .env 값) |
| `ALLOWED_ORIGINS` | 프론트 URL (3단계 후 입력) |

### 프론트(carekidney-frontend) 환경변수
| Key | Value |
|---|---|
| `VITE_API_BASE_URL` | 백엔드 URL (예: `https://carekidney-backend.onrender.com`) |

## 3. 배포 후 연결 마무리 (CORS / API URL)
1. 백엔드가 먼저 떠서 URL 확정되면 → 프론트 `VITE_API_BASE_URL`에 입력 후 프론트 재배포
2. 프론트 URL 확정되면 → 백엔드 `ALLOWED_ORIGINS`에 입력(콤마 구분 다중 가능) 후 백엔드 재배포
   - 이 키는 `backend/app/main.py`가 읽어 CORS 허용 도메인에 추가함
3. 헬스체크: `https://<backend>/health`, API 문서: `https://<backend>/docs`

## 4. 알려진 주의사항
- **무거운 의존성**: `sentence-transformers`(torch 포함)로 빌드/메모리 큼 → Render **Starter 이상** 권장(무료 512MB는 OOM 가능).
- **Redis**: `redis_session_manager` 사용 시 Redis 필요 → `render.yaml`의 redis 서비스/`REDIS_URL` 주석 해제.
- `sentence-transformers==2.2.2`는 최신 `huggingface_hub`와 충돌할 수 있음. 빌드 실패 시 requirements에 `huggingface_hub==0.16.4` 핀 추가.

---

## (대안) 프론트만 빠르게 공개
```bash
# Vercel
npm i -g vercel && cd frontend && vercel --prod   # 빌드 시 VITE_API_BASE_URL 설정
```
정적 프론트만 올리면 화면은 보이지만 챗봇 등 백엔드 기능은 동작하지 않습니다.
