import { StyleSheet, View } from 'react-native';
import { HelperText } from 'react-native-paper';
import TextField from './TextField';

/**
 * A text field that carries its own error underneath it.
 *
 * The app used to gather every complaint into one line at the foot of the
 * dialog, which in a form long enough to scroll is a line nobody can see while
 * looking at the field that caused it. Here the message sits against the input
 * it belongs to, and the input is outlined in the error colour so it can be
 * found by scrolling rather than by reading.
 *
 * The pair is wrapped in a view rather than returned loose, so that a field
 * dropped into one of the side-by-side rows this app uses stays one column
 * instead of putting its message beside itself. `style` is the wrapper's, which
 * is what a caller passing `flex: 1` means.
 *
 * `hint` is the ordinary explanatory text a field may want when nothing is
 * wrong. It gives way to the error rather than stacking with it, so the field
 * doesn't grow a second line and shift the rest of the form down.
 *
 * Everything not named here goes to the input, so a caller sets `label`,
 * `keyboardType`, `right` and the rest exactly as it would on a `TextField` —
 * hence the input's own props in the type. `style` is the exception: it belongs
 * to the wrapper, so it's a view style rather than the input's.
 *
 * @param {Omit<import('react-native-paper').TextInputProps, 'style' | 'error'> & {
 *   error?: string,
 *   hint?: import('react').ReactNode,
 *   style?: import('react-native').StyleProp<import('react-native').ViewStyle>,
 * }} props
 */
export default function FormField({ error = '', hint, style, value, onChangeText, ...rest }) {
  return (
    <View style={[styles.wrapper, style]}>
      <TextField {...rest} value={value} onChangeText={onChangeText} error={Boolean(error)} />
      {Boolean(error || hint) && (
        <HelperText type={error ? 'error' : 'info'} visible padding="none" style={styles.helper}>
          {error || hint}
        </HelperText>
      )}
    </View>
  );
}

FormField.Affix = TextField.Affix;
FormField.Icon = TextField.Icon;

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 8,
  },
  helper: {
    marginTop: 2,
  },
});
