# CareKidney backend (FastAPI) - production image
FROM python:3.10-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8000

WORKDIR /app

# 시스템 의존성 (lxml, sentence-transformers/torch 빌드용)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libxml2-dev libxslt1-dev curl \
    && rm -rf /var/lib/apt/lists/*

# 파이썬 의존성 먼저 설치 (레이어 캐시 활용)
COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

# 앱 코드 복사
COPY . .

EXPOSE 8000

# 대부분의 호스트(Render 등)는 $PORT 를 주입함
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
