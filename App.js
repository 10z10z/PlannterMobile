import { useEffect } from 'react';
import { LogBox } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { AuthProvider } from './contexts/AuthContext';
import RootNavigator from './navigation/RootNavigator';
import { requestNotificationPermissions } from './lib/notifications';

// Local notifications (used for watering reminders) still work in Expo Go;
// this warning only concerns remote push, which this app doesn't use.
LogBox.ignoreLogs(['expo-notifications: Android Push notifications']);

export default function App() {
  useEffect(() => {
    requestNotificationPermissions();
  }, []);

  return (
    <AuthProvider>
      <PaperProvider>
        <RootNavigator />
        <StatusBar style="dark" />
      </PaperProvider>
    </AuthProvider>
  );
}
