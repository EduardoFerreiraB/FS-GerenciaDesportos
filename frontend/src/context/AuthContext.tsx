'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import api from '@/lib/api';
import { Loader2 } from 'lucide-react';

interface User {
  username: string;
  role: string;
  must_change_password?: boolean;
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

  useEffect(() => {
    const initAuth = async () => {
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
        console.error("Token inválido na inicialização:", error);
        localStorage.removeItem('token');
        setUser(null);
        if (pathname.includes('/dashboard')) {
          router.push('/');
        }
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (token: string) => {
    setIsLoading(true); // Bloqueia a UI
    localStorage.setItem('token', token);
    api.defaults.headers.Authorization = `Bearer ${token}`;
    
    try {
        const response = await api.get('/users/me');
        
        setUser(response.data);
        router.push('/dashboard');
    } catch (error) {
        console.error("Erro no login:", error);
        alert('Erro ao obter dados do usuário. Tente novamente.');
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

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, isLoading }}>
      {/* Se estiver carregando E estivermos numa rota protegida, bloqueia tudo e mostra spinner global */}
      {isLoading && pathname.includes('/dashboard') ? (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="flex flex-col items-center gap-4">
            <Loader2 size={48} className="animate-spin text-primary" />
            <p className="text-slate-500 font-medium">Autenticando...</p>
          </div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);