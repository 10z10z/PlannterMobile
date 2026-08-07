import { ScrollView, StyleSheet } from 'react-native';

/**
 * The scrolling body of a dialog.
 *
 * Thirteen dialogs had a byte-identical `<ScrollView contentContainerStyle=…>`
 * and thirteen copies of the same four-line style, and every one of them was
 * missing the same prop — so the first tap on Save with the keyboard up only
 * dismissed the keyboard, and a working button had to be pressed twice. On a
 * long form that is the last thing that happens before the grower gets what
 * they came for.
 *
 * `keyboardShouldPersistTaps="handled"` rather than `"always"`: "handled" lets
 * a press that a child has already dealt with dismiss the keyboard as usual, so
 * tapping the background still closes it. "always" keeps the keyboard up
 * through everything, including the taps that ought to put it away.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 * @param {any} [props.style] Extra content padding, for a dialog that wants it.
 */
export default function DialogScroll({ children, style }) {
  return (
    <ScrollView contentContainerStyle={[styles.content, style]} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Paper's `Dialog.ScrollArea` drops the horizontal padding its own content
  // would have had, so the body puts it back.
  content: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
});
