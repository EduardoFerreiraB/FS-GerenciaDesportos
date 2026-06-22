# --- Stage 1: Build dependencies ---
FROM python:3.12-slim AS builder

WORKDIR /build

# Install compiler if needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# --- Stage 2: Production runner ---
FROM python:3.12-slim AS runner

WORKDIR /app

# Create a non-privileged user to run the app
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -m -s /sbin/nologin appuser

# Copy installed python dependencies from builder stage
COPY --from=builder /root/.local /home/appuser/.local
ENV PATH=/home/appuser/.local/bin:$PATH

# Copy app files and change owner to appuser
COPY --chown=appuser:appgroup ./app /app/app

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=8080
ENV PYTHONPATH=/app/app

# Expose port
EXPOSE 8080

# Switch to non-root user
USER appuser

# Start the application using uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "2"]
