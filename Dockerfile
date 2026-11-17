# ==============================================================================
# QuantumFloor Pro - Production Multi-Stage Container Image
# Stage 1: Build modern frontend with Vite
# Stage 2: Production Python runtime with Neon Postgres & Uvicorn
# ==============================================================================

# ----------------- STAGE 1: Frontend Build -----------------
FROM node:20-slim AS frontend-builder
WORKDIR /build/frontend

# Copy frontend manifest files first for layer caching
COPY trading_platform/frontend/package*.json ./
RUN npm ci

# Copy frontend source tree and compile
COPY trading_platform/frontend/ ./
RUN npm run build

# ----------------- STAGE 2: Backend & Serving -----------------
FROM python:3.11-slim

# Prevent Python from writing .pyc and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8001 \
    HOST=0.0.0.0

WORKDIR /app

# Install system dependencies needed for network, SSL & PostgreSQL
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install backend dependencies including PostgreSQL drivers & crypto
COPY pyproject.toml ./
COPY trading_platform/pyproject.toml ./trading_platform/
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir \
    fastapi \
    "uvicorn[standard]" \
    pydantic \
    numpy \
    httpx \
    starlette \
    psycopg2-binary \
    asyncpg \
    sqlalchemy \
    cryptography \
    PyJWT \
    bcrypt \
    python-dotenv

# Copy backend source code
COPY trading_platform/ /app/trading_platform/

# Copy compiled frontend distribution from Stage 1 into the expected location
COPY --from=frontend-builder /build/frontend/dist /app/trading_platform/frontend/dist

# Expose dynamic application port
EXPOSE 8001

# Health check probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8001}/api/health || exit 1

# Start Uvicorn ASGI server with dynamic port binding
CMD ["sh", "-c", "uvicorn trading_platform.backend.api:app --host 0.0.0.0 --port ${PORT:-8001}"]
