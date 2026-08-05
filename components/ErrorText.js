import { StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

/**
 * What went wrong with a form, in the scheme's own red.
 *
 * The colour comes from the theme rather than the word "red": every scheme
 * carries an error tone worked out against its own surfaces, and a fixed red
 * that looked fine over one background is the thing that gives a repainted app
 * away over the next.
 */
export default function ErrorText({ children, style }) {
  const theme = useTheme();

  if (!children) return null;

  return (
    <Text variant="bodyMedium" style={[styles.text, { color: theme.colors.error }, style]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    marginTop: 8,
  },
});
