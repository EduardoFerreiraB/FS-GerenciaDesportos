import { defineConfig, devices } from '@playwright/test';

/**
 * Configuração Playwright E2E.
 * Conforme Ruling R5:
 * - webServer com backend FastAPI (SQLite migrado com admin) e frontend Next.js.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command:
        'cd .. && DATABASE_URL=sqlite:///./frontend/e2e.db .venv/bin/python frontend/e2e/setup-db.py && PYTHONPATH=app DATABASE_URL=sqlite:///./frontend/e2e.db SECRET_KEY=e2e-playwright-secret-key-1234567890 .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000',
      url: 'http://127.0.0.1:8000/docs',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
});
