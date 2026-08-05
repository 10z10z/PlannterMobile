import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, Portal, SegmentedButtons, Text } from 'react-native-paper';
import TextField from '../../components/TextField';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useUnits } from '../../contexts/UnitsContext';
import { doseUnit, formatDose, parseDose } from '../../lib/units';
import ImagePickerField from '../../components/ImagePickerField';
import NutrientInputs, { NUTRIENT_KEYS } from '../../components/NutrientInputs';

function emptyNutrients() {
  return Object.fromEntries(NUTRIENT_KEYS.map((key) => [key, '']));
}

function nutrientsFrom(record) {
  return Object.fromEntries(
    NUTRIENT_KEYS.map((key) => [key, record[key] === null ? '' : String(record[key])])
  );
}

function toNumberOrNull(text) {
  if (text === null || text === undefined || String(text).trim() === '') return null;
  const value = Number(String(text).replace(',', '.'));
  return Number.isNaN(value) ? null : value;
}

/**
 * Create/edit dialog for a fertilizer. Doses are typed in the user's preferred
 * units and converted to per-litre on save.
 */
export default function FertilizerFormDialog({ visible, onDismiss, onSaved, fertilizer }) {
  const { session } = useAuth();
  const { system } = useUnits();
  const isEditing = !!fertilizer;

  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState(null);
  const [form, setForm] = useState('liquid');
  const [origin, setOrigin] = useState('synthetic');
  const [nutrients, setNutrients] = useState(emptyNutrients);
  const [foliarMin, setFoliarMin] = useState('');
  const [foliarMax, setFoliarMax] = useState('');
  const [fertigationMin, setFertigationMin] = useState('');
  const [fertigationMax, setFertigationMax] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Reset the form each time the dialog opens, for whichever record it opened on.
  useEffect(() => {
    if (!visible) return;
    setError('');
    if (fertilizer) {
      setName(fertilizer.name);
      setImageUrl(fertilizer.image_url);
      setForm(fertilizer.form);
      setOrigin(fertilizer.origin);
      setNutrients(nutrientsFrom(fertilizer));
      setFoliarMin(formatDose(fertilizer.foliar_dose_min, system));
      setFoliarMax(formatDose(fertilizer.foliar_dose_max, system));
      setFertigationMin(formatDose(fertilizer.fertigation_dose_min, system));
      setFertigationMax(formatDose(fertilizer.fertigation_dose_max, system));
    } else {
      setName('');
      setImageUrl(null);
      setForm('liquid');
      setOrigin('synthetic');
      setNutrients(emptyNutrients());
      setFoliarMin('');
      setFoliarMax('');
      setFertigationMin('');
      setFertigationMax('');
    }
  }, [visible, fertilizer, system]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError('');

    const payload = {
      name: name.trim(),
      image_url: imageUrl,
      form,
      origin,
      ...Object.fromEntries(NUTRIENT_KEYS.map((key) => [key, toNumberOrNull(nutrients[key])])),
      foliar_dose_min: parseDose(foliarMin, system),
      foliar_dose_max: parseDose(foliarMax, system),
      fertigation_dose_min: parseDose(fertigationMin, system),
      fertigation_dose_max: parseDose(fertigationMax, system),
    };

    const { error: saveError } = isEditing
      ? await supabase.from('fertilizers').update(payload).eq('id', fertilizer.id)
      : await supabase.from('fertilizers').insert({ ...payload, user_id: session.user.id });

    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    onSaved();
  };

  const unit = doseUnit(form, system);

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>{isEditing ? 'Edit Fertilizer' : 'New Fertilizer'}</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <ImagePickerField value={imageUrl} onChange={setImageUrl} entity="fertilizers" />

            <TextField label="Name" value={name} onChangeText={setName} style={styles.input} />

            <Text variant="labelLarge" style={styles.sectionLabel}>
              Form
            </Text>
            <SegmentedButtons
              value={form}
              onValueChange={setForm}
              buttons={[
                { value: 'liquid', label: 'Liquid' },
                { value: 'solid', label: 'Crystal' },
              ]}
            />

            <Text variant="labelLarge" style={styles.sectionLabel}>
              Type
            </Text>
            <SegmentedButtons
              value={origin}
              onValueChange={setOrigin}
              buttons={[
                { value: 'organic', label: 'Organic' },
                { value: 'synthetic', label: 'Synthetic' },
              ]}
            />

            <NutrientInputs value={nutrients} onChange={setNutrients} />

            <Text variant="labelLarge" style={styles.sectionLabel}>
              Foliar dose ({unit})
            </Text>
            <View style={styles.row}>
              <TextField
                label="Min"
                value={foliarMin}
                onChangeText={setFoliarMin}
                keyboardType="decimal-pad"
                dense
                style={styles.rowField}
              />
              <TextField
                label="Max"
                value={foliarMax}
                onChangeText={setFoliarMax}
                keyboardType="decimal-pad"
                dense
                style={styles.rowField}
              />
            </View>

            <Text variant="labelLarge" style={styles.sectionLabel}>
              Fertigation dose ({unit})
            </Text>
            <View style={styles.row}>
              <TextField
                label="Min"
                value={fertigationMin}
                onChangeText={setFertigationMin}
                keyboardType="decimal-pad"
                dense
                style={styles.rowField}
              />
              <TextField
                label="Max"
                value={fertigationMax}
                onChangeText={setFertigationMax}
                keyboardType="decimal-pad"
                dense
                style={styles.rowField}
              />
            </View>

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
  sectionLabel: {
    marginTop: 12,
    marginBottom: 4,
    opacity: 0.7,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  rowField: {
    flex: 1,
  },
  errorText: {
    color: 'red',
    marginTop: 8,
  },
});
