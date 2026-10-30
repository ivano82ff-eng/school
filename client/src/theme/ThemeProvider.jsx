import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ConfigProvider, App as AntApp } from 'antd';
import {
  antdLocale,
  buildAntdTheme,
  applyCssVars,
  readStoredMode,
  THEME_STORAGE_KEY,
  schemes,
} from './index';

const ThemeModeContext = createContext(null);

export function ThemeModeProvider({ children }) {
  const [mode, setMode] = useState(() => readStoredMode());

  useEffect(() => {
    applyCssVars(mode);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // ignore
    }
  }, [mode]);

  const antdTheme = useMemo(() => buildAntdTheme(mode), [mode]);

  const value = useMemo(
    () => ({
      mode,
      scheme: schemes[mode],
      isDark: mode === 'dark',
      setMode,
      toggleMode: () => setMode((m) => (m === 'dark' ? 'light' : 'dark')),
    }),
    [mode]
  );

  return (
    <ThemeModeContext.Provider value={value}>
      <ConfigProvider locale={antdLocale} theme={antdTheme} componentSize="large">
        <AntApp>{children}</AntApp>
      </ConfigProvider>
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode() {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) throw new Error('useThemeMode must be used within ThemeModeProvider');
  return ctx;
}
