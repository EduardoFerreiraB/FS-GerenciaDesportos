import { defineConfig, devices } from '@playwright/test';
import { PORTA_API_E2E, PORTA_WEB_E2E, BANCO_E2E_URL } from './e2e/helpers/ambiente';

/**
 * Configuração Playwright E2E.
 * Conforme Ruling R5:
 * - webServer com backend FastAPI (SQLite migrado com admin) e frontend Next.js.
 */
// Ambiente E2E isolado: portas próprias, banco SQLite recriado a cada execução
// (frontend/e2e-<porta da API>.db) e nenhum reaproveitamento de servidor. Assim os testes
// nunca gravam no backend/banco de desenvolvimento, mesmo que eles estejam rodando.
// Execuções simultâneas: defina E2E_PORTA_API/E2E_PORTA_WEB diferentes em cada uma.
const PORTA_API = PORTA_API_E2E;
const PORTA_WEB = PORTA_WEB_E2E;
const BANCO_E2E = BANCO_E2E_URL;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORTA_WEB}`,
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
        `cd .. && DATABASE_URL=${BANCO_E2E} E2E_PORTA_API=${PORTA_API} .venv/bin/python frontend/e2e/setup-db.py && ` +
        `PYTHONPATH=app DATABASE_URL=${BANCO_E2E} SECRET_KEY=e2e-playwright-secret-key-1234567890 ` +
        `ALLOWED_ORIGINS=http://localhost:${PORTA_WEB},http://127.0.0.1:${PORTA_WEB} ` +
        `.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port ${PORTA_API}`,
      url: `http://127.0.0.1:${PORTA_API}/docs`,
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: `E2E_HARNESS=1 E2E_PORTA_WEB=${PORTA_WEB} NEXT_PUBLIC_API_URL=http://127.0.0.1:${PORTA_API} npx next dev -p ${PORTA_WEB}`,
      url: `http://localhost:${PORTA_WEB}`,
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
