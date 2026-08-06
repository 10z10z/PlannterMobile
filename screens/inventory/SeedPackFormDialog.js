import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, HelperText, Portal, Text } from 'react-native-paper';
import TextField from '../../components/TextField';
import { messageFor } from '../../lib/errors';
import { useSaveInventoryItem } from '../../hooks/useInventory';
import ImagePickerField from '../../components/ImagePickerField';
import DateField from '../../components/DateField';
import ErrorText from '../../components/ErrorText';

function toIntOrNull(text) {
  if (text === null || text === undefined || String(text).trim() === '') return null;
  const value = parseInt(text, 10);
  return Number.isNaN(value) ? null : value;
}

export default function SeedPackFormDialog({ visible, onDismiss, onSaved, seedPack }) {
  const isEditing = !!seedPack;
  const save = useSaveInventoryItem('seedPacks', { onSuccess: onSaved });
  const resetSave = save.reset;

  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState(null);
  const [plantType, setPlantType] = useState('');
  const [germMin, setGermMin] = useState('');
  const [germMax, setGermMax] = useState('');
  const [packagedOn, setPackagedOn] = useState(null);
  const [seedCount, setSeedCount] = useState('');
  // Only what this form checks itself; anything the server objects to arrives
  // on the mutation, and both are shown in the same place.
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setValidationError('');
    resetSave();
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
  }, [visible, seedPack, resetSave]);

  const handleSave = () => {
    if (!name.trim()) {
      setValidationError('Name is required');
      return;
    }
    setValidationError('');

    save.mutate({
      id: seedPack?.id,
      values: {
        name: name.trim(),
        image_url: imageUrl,
        plant_type: plantType.trim() || null,
        germination_days_min: toIntOrNull(germMin),
        germination_days_max: toIntOrNull(germMax),
        packaged_on: packagedOn,
        seed_count: toIntOrNull(seedCount),
      },
    });
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

            <ErrorText>{validationError || (save.isError ? messageFor(save.error) : '')}</ErrorText>
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={save.isPending}>
            Cancel
          </Button>
          <Button onPress={handleSave} loading={save.isPending} disabled={save.isPending}>
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
