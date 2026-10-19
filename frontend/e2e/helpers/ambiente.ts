/**
 * Endereços do ambiente E2E. Portas próprias (8001/3001), diferentes das de
 * desenvolvimento (8000/3000): os testes nunca alcançam o backend nem o banco
 * de desenvolvimento, mesmo que eles estejam rodando.
 */
export const PORTA_API_E2E = 8001;
export const PORTA_WEB_E2E = 3001;
export const API_E2E = `http://127.0.0.1:${PORTA_API_E2E}`;
export const WEB_E2E = `http://localhost:${PORTA_WEB_E2E}`;
