# Backend image for the DocSize API. Works on ARM (Oracle Ampere) and x86.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

WORKDIR /app

RUN useradd --create-home --uid 1000 appuser

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY scripts ./scripts

RUN mkdir -p /data/storage && chown -R appuser:appuser /data

USER appuser
EXPOSE 8000

# One worker on purpose: the rate limiter and login limits are kept in memory per process.
# --proxy-headers reads the real client IP from X-Forwarded-For, which Caddy sets.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips=*"]
