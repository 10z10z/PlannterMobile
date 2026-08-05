import { StyleSheet, View } from 'react-native';
import { Icon, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { COLOR_SCHEMES, schemeColors } from '../lib/themes';

/**
 * The six schemes, each shown as a scrap of the app wearing it.
 *
 * The preview is a small card in the scheme's own card colour carrying its
 * three accents, rather than three swatches floating on the current theme —
 * what a scheme mostly is, on screen, is the surface everything sits on, and a
 * bare row of dots would say nothing about it.
 *
 * Previews are drawn in whichever of light or dark is being shown, since that
 * is the one being chosen for.
 */
export default function SchemePicker({ value, onChange, isDark }) {
  const theme = useTheme();

  return (
    <View style={styles.list}>
      {COLOR_SCHEMES.map((scheme) => {
        const colors = schemeColors(scheme.value, isDark);
        const selected = scheme.value === value;

        return (
          <TouchableRipple
            key={scheme.value}
            onPress={() => onChange(scheme.value)}
            style={[
              styles.row,
              {
                borderColor: selected ? theme.colors.primary : theme.colors.outlineVariant,
                // The selected row is ringed more heavily, and gives back the
                // pixel the thicker border took, so nothing shifts on a tap.
                borderWidth: selected ? 2 : 1,
                padding: selected ? 11 : 12,
              },
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
          >
            <View style={styles.rowInner}>
              <View style={[styles.preview, { backgroundColor: colors.elevation.level2 }]}>
                <View style={[styles.bar, { backgroundColor: colors.primary }]} />
                <View style={styles.dots}>
                  <View style={[styles.dot, { backgroundColor: colors.secondary }]} />
                  <View style={[styles.dot, { backgroundColor: colors.tertiary }]} />
                </View>
              </View>

              <View style={styles.text}>
                <Text variant="titleSmall">{scheme.label}</Text>
                <Text variant="bodySmall" style={styles.blurb}>
                  {scheme.blurb}
                </Text>
              </View>

              {selected && <Icon source="check-circle" size={20} color={theme.colors.primary} />}
            </View>
          </TouchableRipple>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 8,
    marginBottom: 8,
  },
  row: {
    borderRadius: 12,
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  preview: {
    width: 56,
    height: 40,
    borderRadius: 8,
    padding: 6,
    justifyContent: 'space-between',
  },
  bar: {
    height: 6,
    borderRadius: 3,
  },
  dots: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  text: {
    flex: 1,
  },
  blurb: {
    opacity: 0.7,
  },
});
