import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

/**
 * A screen's name in its header, with the icon that stands for it elsewhere.
 *
 * The icon is the same one the screen carries in the bottom tab bar, so the
 * header confirms where you are in the same language the tab bar used to get
 * you there. It sits inside `Appbar.Content` rather than beside it, because an
 * `Appbar.Action` would be a button, and this is a label.
 */
export default function ScreenTitle({ icon, label, color }) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <MaterialCommunityIcons name={icon} size={22} color={color ?? theme.colors.onSurface} />
      <Text variant="titleLarge" numberOfLines={1} style={styles.label}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  label: {
    // Shrinks rather than pushing the icon off the header on a long name.
    flexShrink: 1,
  },
});
