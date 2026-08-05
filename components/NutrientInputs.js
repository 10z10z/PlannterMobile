import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import TextField from './TextField';

export const MACRO_KEYS = ['n', 'p', 'k'];
export const MICRO_KEYS = ['ca', 'mg', 's', 'fe', 'mn', 'zn', 'b', 'cu', 'mo'];
export const NUTRIENT_KEYS = [...MACRO_KEYS, ...MICRO_KEYS];

const LABELS = {
  n: 'N',
  p: 'P',
  k: 'K',
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
 * growing mediums. `value` is a plain object of column key -> string, kept as
 * typed text so partial input like "1." doesn't get mangled mid-edit.
 *
 * Micronutrients start collapsed — most products only list NPK.
 */
export default function NutrientInputs({ value, onChange, showPh = false, showEc = false }) {
  const [microsOpen, setMicrosOpen] = useState(
    MICRO_KEYS.some((key) => value[key] !== undefined && value[key] !== '')
  );

  const set = (key) => (text) => onChange({ ...value, [key]: text });

  const renderField = (key, label, suffix) => (
    <TextField
      key={key}
      label={label}
      value={value[key] ?? ''}
      onChangeText={set(key)}
      keyboardType="decimal-pad"
      dense
      right={suffix ? <TextField.Affix text={suffix} /> : undefined}
      style={styles.field}
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
