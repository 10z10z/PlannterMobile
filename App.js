import { useEffect } from 'react';
import { LogBox } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider, useThemePreference } from './contexts/ThemeContext';
import { UnitsProvider } from './contexts/UnitsContext';
import { WeatherProvider } from './contexts/WeatherContext';
import RootNavigator from './navigation/RootNavigator';
import { requestNotificationPermissions } from './lib/notifications';

// Local notifications (used for watering reminders) still work in Expo Go;
// this warning only concerns remote push, which this app doesn't use.
LogBox.ignoreLogs(['expo-notifications: Android Push notifications']);

function ThemedApp() {
  const { isDark, theme } = useThemePreference();

  // Auth and Units must sit above PaperProvider: Paper's Portal re-parents its
  // children under PortalHost, so any context they consume has to be higher up.
  return (
    <AuthProvider>
      <UnitsProvider>
        <WeatherProvider>
          <PaperProvider theme={theme}>
            <RootNavigator />
            <StatusBar style={isDark ? 'light' : 'dark'} />
          </PaperProvider>
        </WeatherProvider>
      </UnitsProvider>
    </AuthProvider>
  );
}

export default function App() {
  useEffect(() => {
    requestNotificationPermissions();
  }, []);

  return (
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  );
}
