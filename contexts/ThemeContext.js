import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import { DarkTheme, DefaultTheme } from '@react-navigation/native';
import { DEFAULT_SCHEME, navigationColors, normalizeScheme, schemeColors } from '../lib/themes';

const MODE_KEY = 'themePreference';
const SCHEME_KEY = 'colorScheme';
const ThemeContext = createContext(null);

/**
 * How the app is dressed: which colour scheme it wears, and whether it is
 * showing that scheme light or dark.
 *
 * The two are kept apart on purpose. Light or dark answers "what room am I
 * standing in" and can follow the system; the scheme answers "what should this
 * look like" and never should. So changing one leaves the other alone.
 *
 * Both the Paper theme and the navigator's own theme are built here, because
 * the tab bar and the stack headers are drawn by React Navigation rather than
 * by Paper — leaving those on the defaults would show a stock blue chrome
 * around a repainted app.
 */
export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState('system'); // 'system' | 'light' | 'dark'
  const [scheme, setScheme] = useState(DEFAULT_SCHEME);

  useEffect(() => {
    AsyncStorage.multiGet([MODE_KEY, SCHEME_KEY]).then((stored) => {
      const values = Object.fromEntries(stored);
      const mode = values[MODE_KEY];
      if (mode === 'light' || mode === 'dark' || mode === 'system') setPreference(mode);
      if (values[SCHEME_KEY]) setScheme(normalizeScheme(values[SCHEME_KEY]));
    });
  }, []);

  const setThemePreference = (value) => {
    setPreference(value);
    AsyncStorage.setItem(MODE_KEY, value);
  };

  const setColorScheme = (value) => {
    const next = normalizeScheme(value);
    setScheme(next);
    AsyncStorage.setItem(SCHEME_KEY, next);
  };

  const isDark = preference === 'system' ? systemScheme === 'dark' : preference === 'dark';

  const theme = useMemo(() => {
    const base = isDark ? MD3DarkTheme : MD3LightTheme;
    return { ...base, colors: schemeColors(scheme, isDark) };
  }, [scheme, isDark]);

  const navigationTheme = useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return { ...base, colors: { ...base.colors, ...navigationColors(scheme, isDark) } };
  }, [scheme, isDark]);

  const value = useMemo(
    () => ({
      preference,
      setThemePreference,
      isDark,
      scheme,
      setColorScheme,
      theme,
      navigationTheme,
    }),
    [preference, isDark, scheme, theme, navigationTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemePreference() {
  return useContext(ThemeContext);
}
