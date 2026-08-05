import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, HelperText, Portal, Text } from 'react-native-paper';
import TextField from '../../components/TextField';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import ImagePickerField from '../../components/ImagePickerField';
import DateField from '../../components/DateField';
import ErrorText from '../../components/ErrorText';

function toIntOrNull(text) {
  if (text === null || text === undefined || String(text).trim() === '') return null;
  const value = parseInt(text, 10);
  return Number.isNaN(value) ? null : value;
}

export default function SeedPackFormDialog({ visible, onDismiss, onSaved, seedPack }) {
  const { session } = useAuth();
  const isEditing = !!seedPack;

  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState(null);
  const [plantType, setPlantType] = useState('');
  const [germMin, setGermMin] = useState('');
  const [germMax, setGermMax] = useState('');
  const [packagedOn, setPackagedOn] = useState(null);
  const [seedCount, setSeedCount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setError('');
    if (seedPack) {
      setName(seedPack.name);
      setImageUrl(seedPack.image_url);
      setPlantType(seedPack.plant_type ?? '');
      setGermMin(seedPack.germination_days_min?.toString() ?? '');
      setGermMax(seedPack.germination_days_max?.toString() ?? '');
      setPackagedOn(seedPack.packaged_on ?? null);
      setSeedCount(seedPack.seed_count?.toString() ?? '');
    } else {
      setName('');
      setImageUrl(null);
      setPlantType('');
      setGermMin('');
      setGermMax('');
      setPackagedOn(null);
      setSeedCount('');
    }
  }, [visible, seedPack]);

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
      plant_type: plantType.trim() || null,
      germination_days_min: toIntOrNull(germMin),
      germination_days_max: toIntOrNull(germMax),
      packaged_on: packagedOn,
      seed_count: toIntOrNull(seedCount),
    };

    const { error: saveError } = isEditing
      ? await supabase.from('seed_packs').update(payload).eq('id', seedPack.id)
      : await supabase.from('seed_packs').insert({ ...payload, user_id: session.user.id });

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
        <Dialog.Title>{isEditing ? 'Edit Seed Pack' : 'New Seed Pack'}</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <ImagePickerField value={imageUrl} onChange={setImageUrl} entity="seed_packs" />

            <TextField label="Name" value={name} onChangeText={setName} style={styles.input} />
            <TextField
              label="Plant type (optional)"
              value={plantType}
              onChangeText={setPlantType}
              style={styles.input}
            />

            <Text variant="labelLarge" style={styles.sectionLabel}>
              Germination time (days)
            </Text>
            <View style={styles.row}>
              <TextField
                label="Min"
                value={germMin}
                onChangeText={setGermMin}
                keyboardType="number-pad"
                dense
                style={styles.rowField}
              />
              <TextField
                label="Max"
                value={germMax}
                onChangeText={setGermMax}
                keyboardType="number-pad"
                dense
                style={styles.rowField}
              />
            </View>

            <DateField
              label="Packaged on (optional)"
              value={packagedOn}
              onChange={setPackagedOn}
              maximumDate={new Date()}
            />
            <TextField
              label="Seed count (optional)"
              value={seedCount}
              onChangeText={setSeedCount}
              keyboardType="number-pad"
              style={styles.input}
            />
            <HelperText type="info">
              Worth filling in for rare varieties that are counted by the seed.
            </HelperText>

            <ErrorText>{error}</ErrorText>
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
    marginTop: 4,
    marginBottom: 4,
    opacity: 0.7,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  rowField: {
    flex: 1,
  },
});
