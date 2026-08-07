import { useEffect } from 'react';
import { LogBox, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider, useThemePreference } from './contexts/ThemeContext';
import { SnackbarProvider } from './contexts/SnackbarContext';
import { UnitsProvider } from './contexts/UnitsContext';
import { WeatherProvider } from './contexts/WeatherContext';
import RootNavigator from './navigation/RootNavigator';
import ErrorBoundary from './components/ErrorBoundary';
import OfflineBanner from './components/OfflineBanner';
import { requestNotificationPermissions } from './lib/notifications';
import { queryClient } from './lib/queryClient';

// Local notifications (used for watering reminders) still work in Expo Go;
// this warning only concerns remote push, which this app doesn't use.
LogBox.ignoreLogs(['expo-notifications: Android Push notifications']);

function ThemedApp() {
  const { isDark, theme } = useThemePreference();

  // Auth and Units must sit above PaperProvider: Paper's Portal re-parents its
  // children under PortalHost, so any context they consume has to be higher up.
  // The query cache sits above all of them, since the contexts read through it.
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <UnitsProvider>
          <WeatherProvider>
            <PaperProvider theme={theme}>
              {/* Inside PaperProvider so the fallback is drawn in the user's own
                  scheme; a crash screen in default Material would look like a
                  different app's. Inside it too because the snackbar needs
                  Paper's Portal to sit over whatever screen raised it. */}
              <SnackbarProvider>
                {/* The banner is a sibling of the navigator, not a layer over
                    it, so being offline shortens the app by a strip rather than
                    covering whatever sits at the bottom of the screen. */}
                <View style={styles.root}>
                  <ErrorBoundary>
                    <RootNavigator />
                  </ErrorBoundary>
                  <OfflineBanner />
                </View>
              </SnackbarProvider>
              <StatusBar style={isDark ? 'light' : 'dark'} />
            </PaperProvider>
          </WeatherProvider>
        </UnitsProvider>
      </AuthProvider>
    </QueryClientProvider>
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
