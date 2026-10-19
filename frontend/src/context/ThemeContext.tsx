'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (tema: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({} as ThemeContextType);

function aplicarTema(tema: Theme) {
  document.documentElement.classList.toggle('dark', tema === 'dark');
  try {
    localStorage.setItem('theme', tema);
  } catch {
    // armazenamento indisponivel: o tema vale apenas para esta sessao
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');

  // Sincroniza o estado com a classe definida pelo script inline do layout.
  useEffect(() => {
    setThemeState(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  }, []);

  const setTheme = useCallback((tema: Theme) => {
    setThemeState(tema);
    aplicarTema(tema);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  }, [theme, setTheme]);

  const valor = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);

  return <ThemeContext.Provider value={valor}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
