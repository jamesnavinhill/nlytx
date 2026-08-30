import React, { createContext, useContext, useEffect, useState } from 'react';
import { ThemeConfig, DEFAULT_THEME, ThemeMode } from '../types/theme';
import { DitherAlgorithm } from '../types/analytics';

interface ThemeContextType {
  theme: ThemeConfig;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  setAccentColor: (color: string) => void;
  setGraphPrimaryColor: (color: string) => void;
  setGraphSecondaryColor: (color: string) => void;
  setDitherDensity: (density: number) => void;
  setDitherAlgorithm: (algo: DitherAlgorithm) => void;
  resetTheme: () => void;
}

const STORAGE_KEY = 'unified_analytics_theme_v1';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_THEME, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Failed to parse cached theme:', e);
    }
    return DEFAULT_THEME;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
    } catch (e) {
      console.warn('Failed to store theme state:', e);
    }

    const root = document.documentElement;
    if (theme.mode === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }

    root.style.setProperty('--accent-color', theme.accentColor);
    root.style.setProperty('--primary', theme.accentColor);
    root.style.setProperty('--ring', theme.accentColor);
    root.style.setProperty('--graph-primary-color', theme.graphPrimaryColor);
    root.style.setProperty('--graph-secondary-color', theme.graphSecondaryColor);
    root.style.setProperty('--graph-primary', theme.graphPrimaryColor);
    root.style.setProperty('--graph-secondary', theme.graphSecondaryColor);
  }, [theme]);

  const setMode = (mode: ThemeMode) => {
    setTheme(prev => ({ ...prev, mode }));
  };

  const toggleMode = () => {
    setTheme(prev => ({ ...prev, mode: prev.mode === 'dark' ? 'light' : 'dark' }));
  };

  const setAccentColor = (accentColor: string) => {
    setTheme(prev => ({ ...prev, accentColor }));
  };

  const setGraphPrimaryColor = (graphPrimaryColor: string) => {
    setTheme(prev => ({ ...prev, graphPrimaryColor }));
  };

  const setGraphSecondaryColor = (graphSecondaryColor: string) => {
    setTheme(prev => ({ ...prev, graphSecondaryColor }));
  };

  const setDitherDensity = (ditherDensity: number) => {
    setTheme(prev => ({ ...prev, ditherDensity }));
  };

  const setDitherAlgorithm = (ditherAlgorithm: DitherAlgorithm) => {
    setTheme(prev => ({ ...prev, ditherAlgorithm }));
  };

  const resetTheme = () => {
    setTheme(DEFAULT_THEME);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setMode,
        toggleMode,
        setAccentColor,
        setGraphPrimaryColor,
        setGraphSecondaryColor,
        setDitherDensity,
        setDitherAlgorithm,
        resetTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
