'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import api from '@/lib/api';
import { Loader2 } from 'lucide-react';

interface User {
  username: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  login: (token: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Verifica se estamos no browser antes de rodar lógica de auth
  useEffect(() => {
    const initAuth = async () => {
      // Pequeno delay para garantir que o router esteja pronto
      await new Promise(resolve => setTimeout(resolve, 50));

      const token = localStorage.getItem('token');
      
      if (!token) {
        setIsLoading(false);
        if (pathname.includes('/dashboard')) {
          router.push('/');
        }
        return;
      }

      api.defaults.headers.Authorization = `Bearer ${token}`;
      
      try {
        const response = await api.get('/users/me');
        setUser(response.data);
      } catch (error) {
        console.error("Sessão inválida:", error);
        logout();
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []); // Executa apenas uma vez na montagem

  const login = async (token: string) => {
    setIsLoading(true);
    localStorage.setItem('token', token);
    api.defaults.headers.Authorization = `Bearer ${token}`;
    
    try {
        const response = await api.get('/users/me');
        setUser(response.data);
        router.push('/dashboard');
    } catch (error) {
        console.error(error);
        alert('Erro ao validar login.');
        logout();
    } finally {
        setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete api.defaults.headers.Authorization;
    setUser(null);
    router.push('/');
  };

  // Spinner de carregamento apenas para rotas protegidas
  // Se estiver na home (login), não precisa bloquear tanto
  if (isLoading && pathname.includes('/dashboard')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 size={48} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);