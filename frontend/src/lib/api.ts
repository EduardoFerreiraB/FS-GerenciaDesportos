import axios from 'axios';

// Em produção/docker, usa a variável de ambiente. Localmente, fallback para localhost:8000.
const apiURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: apiURL,
});

// Interceptor para adicionar o token em todas as requisições se existir
if (typeof window !== 'undefined') {
  api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
}

export default api;