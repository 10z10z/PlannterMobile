import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, Dialog, Portal, Switch, Text, TextInput } from 'react-native-paper';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useUnits } from '../../contexts/UnitsContext';
import { formatVolume, parseVolume, volumeUnit } from '../../lib/units';
import ImagePickerField from '../../components/ImagePickerField';
import NutrientInputs, { NUTRIENT_KEYS } from '../../components/NutrientInputs';

const PRESETS = [
  'Coco coir',
  'Coco brick',
  'Perlite',
  'Vermiculite',
  'Vermicompost',
  'Clay pebbles',
  'Peat moss',
];

// Nutrients plus the substrate-only fields the same inputs render for mediums.
const EXTRA_KEYS = ['ec', 'ph_min', 'ph_max'];
const ALL_KEYS = [...NUTRIENT_KEYS, ...EXTRA_KEYS];

function emptySpecs() {
  return Object.fromEntries(ALL_KEYS.map((key) => [key, '']));
}

function specsFrom(record) {
  return Object.fromEntries(
    ALL_KEYS.map((key) => [key, record[key] === null ? '' : String(record[key])])
  );
}

function toNumberOrNull(text) {
  if (text === null || text === undefined || String(text).trim() === '') return null;
  const value = Number(String(text).replace(',', '.'));
  return Number.isNaN(value) ? null : value;
}

export default function MediumFormDialog({ visible, onDismiss, onSaved, medium }) {
  const { session } = useAuth();
  const { system } = useUnits();
  const isEditing = !!medium;

  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState(null);
  const [quantity, setQuantity] = useState('1');
  const [volume, setVolume] = useState('');
  const [lowStock, setLowStock] = useState(false);
  const [specs, setSpecs] = useState(emptySpecs);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setError('');
    if (medium) {
      setName(medium.name);
      setImageUrl(medium.image_url);
      setQuantity(String(medium.quantity));
      setVolume(formatVolume(medium.volume_liters, system, { withUnit: false }));
      setLowStock(medium.low_stock);
      setSpecs(specsFrom(medium));
    } else {
      setName('');
      setImageUrl(null);
      setQuantity('1');
      setVolume('');
      setLowStock(false);
      setSpecs(emptySpecs());
    }
  }, [visible, medium, system]);

  const handleSave = async () => {
    const count = parseInt(quantity, 10);
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!count || count < 1) {
      setError('Quantity must be at least 1');
      return;
    }
    setSaving(true);
    setError('');

    const payload = {
      name: name.trim(),
      image_url: imageUrl,
      quantity: count,
      volume_liters: parseVolume(volume, system),
      low_stock: lowStock,
      ...Object.fromEntries(ALL_KEYS.map((key) => [key, toNumberOrNull(specs[key])])),
    };

    const { error: saveError } = isEditing
      ? await supabase.from('growing_mediums').update(payload).eq('id', medium.id)
      : await supabase.from('growing_mediums').insert({ ...payload, user_id: session.user.id });

    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    onSaved();
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>{isEditing ? 'Edit Medium' : 'New Medium'}</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <ImagePickerField value={imageUrl} onChange={setImageUrl} entity="growing_mediums" />

            <TextInput label="Name" value={name} onChangeText={setName} style={styles.input} />
            <View style={styles.chips}>
              {PRESETS.map((preset) => (
                <Chip key={preset} compact onPress={() => setName(preset)}>
                  {preset}
                </Chip>
              ))}
            </View>

            <View style={styles.row}>
              <TextInput
                label="How many"
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="number-pad"
                dense
                style={styles.rowField}
              />
              <TextInput
                label={`Volume each (${volumeUnit(system)})`}
                value={volume}
                onChangeText={setVolume}
                keyboardType="decimal-pad"
                dense
                style={styles.rowField}
              />
            </View>

            <View style={styles.switchRow}>
              <Text variant="bodyMedium">Running low</Text>
              <Switch value={lowStock} onValueChange={setLowStock} />
            </View>

            <Text variant="labelLarge" style={styles.optionalLabel}>
              Optional — for pre-charged soils
            </Text>
            <NutrientInputs value={specs} onChange={setSpecs} showPh showEc />

            {!!error && <Text style={styles.errorText}>{error}</Text>}
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button onPress={handleSave} loading={saving} disabled={saving}>
            Save
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    maxHeight: '85%',
  },
  scrollArea: {
    paddingHorizontal: 0,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  input: {
    marginBottom: 8,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  rowField: {
    flex: 1,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  optionalLabel: {
    marginTop: 16,
    opacity: 0.7,
  },
  errorText: {
    color: 'red',
    marginTop: 8,
  },
});
