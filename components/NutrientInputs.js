import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import FormField from './FormField';

export const MACRO_KEYS = ['n', 'p', 'k'];
export const MICRO_KEYS = ['ca', 'mg', 's', 'fe', 'mn', 'zn', 'b', 'cu', 'mo'];
export const NUTRIENT_KEYS = [...MACRO_KEYS, ...MICRO_KEYS];

/**
 * P and K name the oxide, because that is what the bag says and what the reader
 * is copying from. Labelling them plain "P" and "K" invited someone with an
 * elemental analysis to type that instead, and the two differ by more than
 * double on phosphorus.
 */
const LABELS = {
  n: 'N',
  p: 'P₂O₅',
  k: 'K₂O',
  ca: 'Ca',
  mg: 'Mg',
  s: 'S',
  fe: 'Fe',
  mn: 'Mn',
  zn: 'Zn',
  b: 'B',
  cu: 'Cu',
  mo: 'Mo',
};

/**
 * Nutrient percentage inputs, shared by fertilizers and (optionally) pre-charged
 * growing mediums.
 *
 * The values are held by the caller's form rather than here, and reached
 * through its `field` accessor, so each figure is range-checked and reports
 * against itself like every other input. They stay typed text so partial input
 * like "1." doesn't get mangled mid-edit.
 *
 * Micronutrients start collapsed — most products only list NPK.
 *
 * @param {object} props
 * @param {(name: string) => object} props.field The form's field accessor.
 * @param {Record<string, any>} props.values Only read to decide whether the
 *   micronutrients start open, which depends on whether any were filled in.
 * @param {boolean} [props.showPh] Substrate pH, which only a medium has.
 * @param {boolean} [props.showEc] Substrate EC, likewise.
 */
export default function NutrientInputs({ field, values, showPh = false, showEc = false }) {
  const [microsOpen, setMicrosOpen] = useState(
    MICRO_KEYS.some((key) => values[key] !== undefined && values[key] !== '')
  );

  const renderField = (key, label, suffix) => (
    <FormField
      key={key}
      label={label}
      keyboardType="decimal-pad"
      dense
      right={suffix ? <FormField.Affix text={suffix} /> : undefined}
      style={styles.field}
      {...field(key)}
    />
  );

  return (
    <View>
      <Text variant="labelLarge" style={styles.sectionLabel}>
        Macronutrients (%)
      </Text>
      <View style={styles.row}>{MACRO_KEYS.map((key) => renderField(key, LABELS[key]))}</View>

      <Button
        mode="text"
        compact
        icon={microsOpen ? 'chevron-up' : 'chevron-down'}
        onPress={() => setMicrosOpen((open) => !open)}
        style={styles.toggle}
      >
        Micronutrients
      </Button>
      {microsOpen && (
        <View style={styles.row}>{MICRO_KEYS.map((key) => renderField(key, LABELS[key]))}</View>
      )}

      {(showPh || showEc) && (
        <>
          <Text variant="labelLarge" style={styles.sectionLabel}>
            Substrate
          </Text>
          <View style={styles.row}>
            {showPh && renderField('ph_min', 'pH min')}
            {showPh && renderField('ph_max', 'pH max')}
            {showEc && renderField('ec', 'EC', 'mS/cm')}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    marginTop: 12,
    marginBottom: 4,
    opacity: 0.7,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  field: {
    flexGrow: 1,
    flexBasis: '28%',
    minWidth: 80,
  },
  toggle: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
});
