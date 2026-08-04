import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'unitSystem';
const UnitsContext = createContext(null);

export function UnitsProvider({ children }) {
  const [system, setSystem] = useState('metric'); // 'metric' | 'imperial'

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'metric' || stored === 'imperial') {
        setSystem(stored);
      }
    });
  }, []);

  const setUnitSystem = (value) => {
    setSystem(value);
    AsyncStorage.setItem(STORAGE_KEY, value);
  };

  const value = useMemo(() => ({ system, setUnitSystem }), [system]);

  return <UnitsContext.Provider value={value}>{children}</UnitsContext.Provider>;
}

export function useUnits() {
  return useContext(UnitsContext);
}
