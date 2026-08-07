import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { BRAND } from '../../lib/brand';
// The mark on its own, transparent. Not `plannter-logo.png`, which has the
// green baked into it — that one can only ever sit on exactly its own shade,
// and a logo that has to be colour-matched to its panel is one seam away from
// looking broken.
import MARK from '../../assets/splash-icon.png';

/**
 * The two screens anyone sees before they see the app.
 *
 * They used to be a centred column with a 🌱 emoji standing in for a logo the
 * app has actually got, on a plain background, which made the first thing a
 * reviewer or a new grower saw the least finished thing in the repo.
 *
 * The panel above is the splash carried on: the same green, the same mark. An
 * app that opens on a green screen with a greenhouse on it and then cuts to a
 * white form has, for a moment, looked like two different apps. The form below
 * sits on the theme's own background, so the six colour schemes still mean
 * something here — it is only the mark that is fixed, because a logo that
 * changed colour with a setting would stop being one.
 *
 * @param {object} props
 * @param {string} props.title What this screen is for, under the wordmark.
 * @param {import('react').ReactNode} props.children The form.
 */
export default function AuthLayout({ title, children }) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: BRAND.green }]}>
      <View style={styles.brand}>
        {/* Decorative: the wordmark below says the name, and a screen reader
            announcing "Plannter, image, Plannter" says it twice. */}
        <Image
          source={MARK}
          style={styles.mark}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
        <Text variant="headlineMedium" style={[styles.wordmark, { color: BRAND.gold }]}>
          plannter
        </Text>
        <Text variant="bodyMedium" style={[styles.tagline, { color: BRAND.onGreen }]}>
          {title}
        </Text>
      </View>

      {/* The keyboard covers a centred form on a small phone, and the field it
          covers is usually the password. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.sheet, { backgroundColor: theme.colors.background }]}
      >
        <ScrollView
          contentContainerStyle={styles.form}
          // Otherwise the first tap on "Log in" only dismisses the keyboard,
          // and the grower has to press a working button twice.
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  brand: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: 72,
    paddingBottom: 28,
    gap: 2,
  },
  mark: {
    width: 96,
    height: 96,
    // The source is square with the greenhouse floating in the middle of it.
    resizeMode: 'contain',
  },
  wordmark: {
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  tagline: {
    marginTop: 2,
  },
  // Rounded into the panel above rather than butting against it, so the join
  // reads as one screen instead of two stacked ones.
  sheet: {
    flex: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  form: {
    padding: 24,
    paddingTop: 28,
  },
});
