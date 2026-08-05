import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, HelperText, Portal } from 'react-native-paper';
import TextField from '../../components/TextField';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import ImagePickerField from '../../components/ImagePickerField';
import ErrorText from '../../components/ErrorText';

/**
 * One record is a group of identical trays, as with containers. The grid is what
 * gives a tray its capacity, so rows and columns are the only figures required
 * besides the name.
 */
export default function TrayFormDialog({ visible, onDismiss, onSaved, tray }) {
  const { session } = useAuth();
  const isEditing = !!tray;

  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState(null);
  const [rows, setRows] = useState('');
  const [cols, setCols] = useState('');
  const [cellVolume, setCellVolume] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setError('');
    if (tray) {
      setName(tray.name);
      setImageUrl(tray.image_url);
      setRows(String(tray.grid_rows));
      setCols(String(tray.grid_cols));
      setCellVolume(tray.cell_volume_ml === null ? '' : String(tray.cell_volume_ml));
      setQuantity(String(tray.quantity));
    } else {
      setName('');
      setImageUrl(null);
      setRows('');
      setCols('');
      setCellVolume('');
      setQuantity('1');
    }
  }, [visible, tray]);

  const rowCount = parseInt(rows, 10);
  const colCount = parseInt(cols, 10);
  const cells = rowCount > 0 && colCount > 0 ? rowCount * colCount : null;

  const handleSave = async () => {
    const count = parseInt(quantity, 10);
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!rowCount || rowCount < 1 || !colCount || colCount < 1) {
      setError('Rows and columns must both be at least 1');
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
      grid_rows: rowCount,
      grid_cols: colCount,
      cell_volume_ml: cellVolume.trim() ? Number(cellVolume.replace(',', '.')) : null,
      quantity: count,
    };

    const { error: saveError } = isEditing
      ? await supabase.from('trays').update(payload).eq('id', tray.id)
      : await supabase.from('trays').insert({ ...payload, user_id: session.user.id });

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
        <Dialog.Title>{isEditing ? 'Edit Trays' : 'New Trays'}</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <ImagePickerField value={imageUrl} onChange={setImageUrl} entity="trays" />

            <TextField label="Name" value={name} onChangeText={setName} style={styles.input} />

            <View style={styles.row}>
              <TextField
                label="Rows"
                value={rows}
                onChangeText={setRows}
                keyboardType="number-pad"
                style={[styles.input, styles.half]}
              />
              <TextField
                label="Columns"
                value={cols}
                onChangeText={setCols}
                keyboardType="number-pad"
                style={[styles.input, styles.half]}
              />
            </View>
            <HelperText type="info">
              {cells ? `${cells} cells per tray.` : 'Rows x columns gives the number of cells.'}
            </HelperText>

            <TextField
              label="Cell volume (ml, optional)"
              value={cellVolume}
              onChangeText={setCellVolume}
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
            <HelperText type="info">One entry covers a whole set of identical trays.</HelperText>

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
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  half: {
    flex: 1,
  },
});
