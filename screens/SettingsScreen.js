import { StyleSheet, View } from 'react-native';
import { Appbar, Button, SegmentedButtons, Text } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import { useThemePreference } from '../contexts/ThemeContext';

export default function SettingsScreen() {
  const { signOut, session } = useAuth();
  const { preference, setThemePreference } = useThemePreference();

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.Content title="Settings" />
      </Appbar.Header>

      <View style={styles.content}>
        <Text variant="labelLarge" style={styles.sectionLabel}>Theme</Text>
        <SegmentedButtons
          value={preference}
          onValueChange={setThemePreference}
          buttons={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
          style={styles.segmented}
        />

        <Text variant="labelLarge" style={styles.sectionLabel}>Account</Text>
        <Text variant="bodyMedium" style={styles.email}>{session?.user?.email}</Text>
        <Button mode="outlined" onPress={signOut}>
          Log out
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
  },
  sectionLabel: {
    marginBottom: 8,
    marginTop: 16,
    opacity: 0.7,
  },
  segmented: {
    marginBottom: 8,
  },
  email: {
    marginBottom: 16,
  },
});
