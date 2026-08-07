import { useEffect, useRef, useState } from 'react';
import { TextInput } from 'react-native-paper';

/**
 * A text input that keeps up with typing.
 *
 * A fully controlled TextInput asks the native field to hold whatever the last
 * render said, so every keystroke has to travel to React state and back before
 * it settles. While the JS thread is busy — and a screen holding a tab
 * navigator, a grid of plants or a long form is busy on every keystroke — the
 * native field runs ahead of the value coming back, and React resets it to the
 * stale one. Typed fast enough, the caret walks backwards and the text comes
 * out reversed.
 *
 * So the text lives here instead. The field renders from local state, which
 * updates immediately, and the parent is told afterwards; a slow parent no
 * longer holds up the caret.
 *
 * The value prop still works for what it's actually needed for — filling a form
 * in, resetting a dialog, prefilling from a template. Those are told apart from
 * the echo of a keystroke by remembering what was last sent up: anything else
 * arriving is the parent genuinely setting the field, and is taken.
 *
 * Paper's `TextInput.Affix` and `TextInput.Icon` are re-exported, so a file that
 * swaps its import doesn't have to keep the old one around for those.
 *
 * The label is also given to the field as its accessibility label, which Paper
 * does not do: it draws the label as a separate animated `Text`, so a screen
 * reader landing on the input announces an unnamed text field and whatever
 * happens to be typed in it. Passing `accessibilityLabel` explicitly still wins,
 * for the fields whose visible label is shorter than what should be read out.
 */
/**
 * @param {Omit<import('react-native-paper').TextInputProps, 'value' | 'onChangeText'> & {
 *   value?: string | null,
 *   onChangeText?: (value: string) => void,
 * }} props
 */
export default function TextField({ value, onChangeText, ...rest }) {
  const [text, setText] = useState(value ?? '');
  // The last text handed to the parent. Anything different coming back down is
  // the parent setting the field rather than echoing what was typed.
  const emitted = useRef(value ?? '');

  useEffect(() => {
    const incoming = value ?? '';
    if (incoming !== emitted.current) {
      emitted.current = incoming;
      setText(incoming);
    }
  }, [value]);

  const handleChange = (next) => {
    emitted.current = next;
    setText(next);
    onChangeText?.(next);
  };

  const accessibilityLabel =
    rest.accessibilityLabel ?? (typeof rest.label === 'string' ? rest.label : undefined);

  return (
    <TextInput
      {...rest}
      accessibilityLabel={accessibilityLabel}
      value={text}
      onChangeText={handleChange}
    />
  );
}

TextField.Affix = TextInput.Affix;
TextField.Icon = TextInput.Icon;
