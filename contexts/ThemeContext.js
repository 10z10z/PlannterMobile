import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'themePreference';
const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState('system'); // 'system' | 'light' | 'dark'

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setPreference(stored);
      }
    });
  }, []);

  const setThemePreference = (value) => {
    setPreference(value);
    AsyncStorage.setItem(STORAGE_KEY, value);
  };

  const isDark = preference === 'system' ? systemScheme === 'dark' : preference === 'dark';

  const value = useMemo(
    () => ({ preference, setThemePreference, isDark }),
    [preference, isDark]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemePreference() {
  return useContext(ThemeContext);
}
