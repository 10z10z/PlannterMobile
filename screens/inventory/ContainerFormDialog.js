import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import {
  Button,
  Dialog,
  HelperText,
  Portal,
  SegmentedButtons,
  Text,
} from 'react-native-paper';
import TextField from '../../components/TextField';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useUnits } from '../../contexts/UnitsContext';
import { formatVolume, parseVolume, volumeUnit } from '../../lib/units';
import { CONTAINER_MATERIALS } from '../../lib/containers';
import ImagePickerField from '../../components/ImagePickerField';

/**
 * One record is a group of identical containers ("6 x 11L"), so a grow's worth of
 * pots doesn't have to be entered one by one.
 */
export default function ContainerFormDialog({ visible, onDismiss, onSaved, container }) {
  const { session } = useAuth();
  const { system } = useUnits();
  const isEditing = !!container;

  const [material, setMaterial] = useState('plastic');
  const [imageUrl, setImageUrl] = useState(null);
  const [volume, setVolume] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setError('');
    if (container) {
      setMaterial(container.material);
      setImageUrl(container.image_url);
      setVolume(formatVolume(container.volume_liters, system, { withUnit: false }));
      setQuantity(String(container.quantity));
    } else {
      setMaterial('plastic');
      setImageUrl(null);
      setVolume('');
      setQuantity('1');
    }
  }, [visible, container, system]);

  const handleSave = async () => {
    const liters = parseVolume(volume, system);
    const count = parseInt(quantity, 10);
    if (!liters || liters <= 0) {
      setError('Volume is required');
      return;
    }
    if (!count || count < 1) {
      setError('Quantity must be at least 1');
      return;
    }
    setSaving(true);
    setError('');

    const payload = {
      material,
      image_url: imageUrl,
      volume_liters: liters,
      quantity: count,
    };

    const { error: saveError } = isEditing
      ? await supabase.from('containers').update(payload).eq('id', container.id)
      : await supabase.from('containers').insert({ ...payload, user_id: session.user.id });

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
        <Dialog.Title>{isEditing ? 'Edit Containers' : 'New Containers'}</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <ImagePickerField value={imageUrl} onChange={setImageUrl} entity="containers" />

            <Text variant="labelLarge" style={styles.sectionLabel}>
              Material
            </Text>
            <SegmentedButtons
              value={material}
              onValueChange={setMaterial}
              buttons={CONTAINER_MATERIALS}
              style={styles.input}
            />

            <TextField
              label={`Volume (${volumeUnit(system)})`}
              value={volume}
              onChangeText={setVolume}
              keyboardType="decimal-pad"
              style={styles.input}
            />
            <TextField
              label="Quantity"
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="number-pad"
              style={styles.input}
            />
            <HelperText type="info">
              One entry covers a whole set of identical containers.
            </HelperText>

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
    marginBottom: 4,
    opacity: 0.7,
  },
  errorText: {
    color: 'red',
    marginTop: 8,
  },
});
