/**
 * Endereços do ambiente E2E. Portas próprias (padrão 8001/3001), diferentes das de
 * desenvolvimento (8000/3000): os testes nunca alcançam o backend nem o banco
 * de desenvolvimento, mesmo que eles estejam rodando.
 *
 * `E2E_PORTA_API` / `E2E_PORTA_WEB` permitem rodar várias execuções do Playwright
 * ao mesmo tempo (uma por trilha): cada uma usa portas, banco (`frontend/e2e-<api>.db`)
 * e pasta de build do Next (`.next-e2e-<web>`) próprios.
 */
export const PORTA_API_E2E = Number(process.env.E2E_PORTA_API ?? 8001);
export const PORTA_WEB_E2E = Number(process.env.E2E_PORTA_WEB ?? 3001);
export const API_E2E = `http://127.0.0.1:${PORTA_API_E2E}`;
export const WEB_E2E = `http://localhost:${PORTA_WEB_E2E}`;
/** URL SQLAlchemy do banco E2E, relativa à raiz do repositório. */
export const BANCO_E2E_URL = `sqlite:///./frontend/e2e-${PORTA_API_E2E}.db`;
