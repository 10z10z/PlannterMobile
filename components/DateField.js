import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, IconButton, Text } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { formatDateString, fromDateString, toDateString } from '../lib/dates';

/**
 * @param {object} props
 * @param {string} props.label
 * @param {string} props.value A "YYYY-MM-DD" date string, or '' for unset.
 * @param {(value: string) => void} props.onChange
 * @param {Date} [props.maximumDate] Latest date the picker will offer.
 */
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
        {!!value && (
          // Named after the field it empties: several dates can sit on one
          // dialog, and three buttons all called "Clear" name nothing.
          <IconButton
            icon="close"
            accessibilityLabel={`Clear ${label}`}
            onPress={() => onChange(null)}
          />
        )}
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
