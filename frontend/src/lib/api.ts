import axios from 'axios';

const apiURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: apiURL,
});

/** Evento disparado quando a API exige a troca de senha (403 SENHA_TROCA_OBRIGATORIA). */
export const EVENTO_TROCA_OBRIGATORIA = 'senha-troca-obrigatoria';

/** Rota interna para onde voltar depois do login; ignora qualquer coisa fora do app. */
export function destinoSeguro(redirect: string | null | undefined): string {
  if (!redirect || !redirect.startsWith('/') || redirect.startsWith('//') || redirect.startsWith('/login')) {
    return '/dashboard';
  }
  return redirect;
}

/** Leva ao login guardando a rota atual para voltar depois (DF-RT08-01). */
export function irParaLogin(): void {
  if (typeof window === 'undefined') return;
  const atual = `${window.location.pathname}${window.location.search}`;
  const destino = atual.startsWith('/dashboard') ? `?redirect=${encodeURIComponent(atual)}` : '';
  window.location.href = `/login${destino}`;
}

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry && originalRequest.url !== '/refresh' && originalRequest.url !== '/token') {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          localStorage.removeItem('refresh_token');
          irParaLogin();
        }
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${apiURL}/refresh`, {
          refresh_token: refreshToken,
        });

        const { access_token, refresh_token: newRefreshToken } = response.data;

        localStorage.setItem('token', access_token);
        localStorage.setItem('refresh_token', newRefreshToken);

        api.defaults.headers.Authorization = `Bearer ${access_token}`;
        originalRequest.headers.Authorization = `Bearer ${access_token}`;

        processQueue(null, access_token);
        isRefreshing = false;

        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;

        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          localStorage.removeItem('refresh_token');
          irParaLogin();
        }
        return Promise.reject(refreshError);
      }
    }

    if (
      error.response?.status === 403 &&
      error.response?.data?.codigo === 'SENHA_TROCA_OBRIGATORIA' &&
      typeof window !== 'undefined'
    ) {
      window.dispatchEvent(new Event(EVENTO_TROCA_OBRIGATORIA));
    }

    return Promise.reject(error);
  }
);

export default api;