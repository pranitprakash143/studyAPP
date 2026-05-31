# ─────────────────────────────────────────────────────────────────────────────
# PrepAgent Backend — Dockerfile (Phase 1: lightweight, no ML deps)
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.11-slim

# System dependencies
# - libmagic1 / file: for python-magic MIME detection
# - curl: for HEALTHCHECK
RUN apt-get update && apt-get install -y --no-install-recommends \
    libmagic1 \
    file \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies (cached layer — only rebuilt when requirements.txt changes)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

# Ensure runtime dirs exist
RUN mkdir -p /app/uploads /app/knowledge_base

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
