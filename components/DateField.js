import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, IconButton, Text } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';

/**
 * Dates are held as "YYYY-MM-DD" strings — Postgres `date` columns are calendar
 * dates with no timezone, so they're built from local parts rather than via
 * toISOString(), which would shift the day for anyone behind UTC.
 */
export function toDateString(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function fromDateString(value) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export function formatDateString(value) {
  const date = fromDateString(value);
  if (!date) return null;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function DateField({ label, value, onChange, maximumDate }) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const display = formatDateString(value);

  const handleChange = (event, selected) => {
    setPickerVisible(false);
    if (event.type === 'set' && selected) {
      onChange(toDateString(selected));
    }
  };

  return (
    <View style={styles.wrapper}>
      <Text variant="labelLarge" style={styles.label}>
        {label}
      </Text>
      <View style={styles.row}>
        <Button
          mode="outlined"
          icon="calendar"
          onPress={() => setPickerVisible(true)}
          style={styles.button}
        >
          {display ?? 'Not set'}
        </Button>
        {!!value && <IconButton icon="close" onPress={() => onChange(null)} />}
      </View>

      {pickerVisible && (
        <DateTimePicker
          value={fromDateString(value) ?? new Date()}
          mode="date"
          maximumDate={maximumDate}
          onChange={handleChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 8,
  },
  label: {
    marginBottom: 4,
    opacity: 0.7,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  button: {
    flexShrink: 1,
  },
});
