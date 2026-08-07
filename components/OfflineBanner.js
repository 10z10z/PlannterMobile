import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import useIsOnline from '../hooks/useIsOnline';

/**
 * A strip along the bottom saying there is no connection.
 *
 * The app already behaved correctly offline — `onlineManager` pauses queries
 * rather than letting them fail against a network that isn't there — and that
 * was the problem. A paused query is indistinguishable from a slow one, so the
 * grower got a spinner that never stopped and no reason for it.
 *
 * It sits below the navigator as an ordinary flex child rather than floating
 * over it, so it covers nothing: the tab bar moves up by its height while it is
 * there. A bar that hides the thing you were about to tap is a worse apology
 * than none.
 */
export default function OfflineBanner() {
  const theme = useTheme();
  const online = useIsOnline();

  if (online) return null;

  return (
    <View
      // One announcement rather than three. Without `accessible` the bar is a
      // container of parts, and TalkBack reads the icon's glyph out as its own
      // element before getting to the sentence.
      accessible
      // Announced when it appears rather than only when something focuses it —
      // the whole point is that it explains a screen that has stopped moving.
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      accessibilityLabel="No connection. Nothing will load or save until it’s back."
      style={[styles.bar, { backgroundColor: theme.colors.errorContainer }]}
    >
      <MaterialCommunityIcons
        name="cloud-off-outline"
        size={16}
        color={theme.colors.onErrorContainer}
      />
      <Text variant="labelMedium" style={{ color: theme.colors.onErrorContainer }}>
        No connection — nothing will load or save until it’s back
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
});
