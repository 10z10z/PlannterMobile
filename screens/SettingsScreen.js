import { ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Button, SegmentedButtons, Text } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import { useThemePreference } from '../contexts/ThemeContext';
import { useUnits } from '../contexts/UnitsContext';
import ScreenTitle from '../components/ScreenTitle';
import SchemePicker from '../components/SchemePicker';
import WeatherSettings from './WeatherSettings';

export default function SettingsScreen({ navigation }) {
  const { signOut, session } = useAuth();
  const { preference, setThemePreference, isDark, scheme, setColorScheme } = useThemePreference();
  const { system, setUnitSystem } = useUnits();

  return (
    <View style={styles.container}>
      <Appbar.Header>
        {/* Settings is pushed from the dashboard rather than being a tab of its
            own, so it carries the way back out. */}
        {navigation?.canGoBack() && <Appbar.BackAction onPress={() => navigation.goBack()} />}
        <Appbar.Content title={<ScreenTitle icon="cog-outline" label="Settings" />} />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="labelLarge" style={styles.sectionLabel}>
          Light or dark
        </Text>
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

        <Text variant="labelLarge" style={styles.sectionLabel}>
          Colour scheme
        </Text>
        <SchemePicker value={scheme} onChange={setColorScheme} isDark={isDark} />

        <Text variant="labelLarge" style={styles.sectionLabel}>
          Units
        </Text>
        <SegmentedButtons
          value={system}
          onValueChange={setUnitSystem}
          buttons={[
            { value: 'metric', label: 'Metric (L, ml/L)' },
            { value: 'imperial', label: 'Imperial (gal, ml/gal)' },
          ]}
          style={styles.segmented}
        />

        <Text variant="labelLarge" style={styles.sectionLabel}>
          Outdoor weather
        </Text>
        <WeatherSettings />

        <Text variant="labelLarge" style={styles.sectionLabel}>
          Account
        </Text>
        <Text variant="bodyMedium" style={styles.email}>
          {session?.user?.email}
        </Text>
        <Button mode="outlined" onPress={signOut}>
          Log out
        </Button>
      </ScrollView>
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
