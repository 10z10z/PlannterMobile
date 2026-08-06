import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Checkbox, Chip, Dialog, HelperText, Portal, Text } from 'react-native-paper';
import FormField from '../../components/FormField';
import { messageFor } from '../../lib/errors';
import { useSaveInventoryItem } from '../../hooks/useInventory';
import { useUnits } from '../../contexts/UnitsContext';
import useForm from '../../hooks/useForm';
import { growLightSchema } from '../../lib/schemas';
import { formatLength, lengthUnit } from '../../lib/units';
import { hasColorTemp, LIGHT_TYPES, SPECTRUMS } from '../../lib/growLights';
import ImagePickerField from '../../components/ImagePickerField';
import ErrorText from '../../components/ErrorText';

/**
 * One record is a group of identical fixtures ("4 x 100W floodlight").
 *
 * The spec-sheet figures sit behind a toggle: a floodlight box prints watts and
 * a beam angle and nothing else, so making PPF and efficacy the first thing on
 * screen would be asking most users to skip most of the form.
 */
export default function GrowLightFormDialog({ visible, onDismiss, onSaved, light }) {
  const { system } = useUnits();
  const isEditing = !!light;
  const save = useSaveInventoryItem('growLights', { onSuccess: onSaved });
  const resetSave = save.reset;

  const form = useForm(growLightSchema(system));
  const resetForm = form.reset;

  const [showSpecs, setShowSpecs] = useState(false);

  useEffect(() => {
    if (!visible) return;
    resetSave();
    setShowSpecs(false);
    resetForm(
      light
        ? {
            name: light.name,
            image_url: light.image_url,
            type: light.type,
            quantity: String(light.quantity),
            watts: light.watts != null ? String(light.watts) : '',
            color_temp_k: light.color_temp_k != null ? String(light.color_temp_k) : '',
            spectrum: light.spectrum,
            dimmable: light.dimmable,
            ppf_umol_s: light.ppf_umol_s != null ? String(light.ppf_umol_s) : '',
            efficacy_umol_j: light.efficacy_umol_j != null ? String(light.efficacy_umol_j) : '',
            ppfd_umol_m2_s: light.ppfd_umol_m2_s != null ? String(light.ppfd_umol_m2_s) : '',
            ppfd_distance_cm: formatLength(light.ppfd_distance_cm, system),
            coverage_width_cm: formatLength(light.coverage_width_cm, system),
            coverage_depth_cm: formatLength(light.coverage_depth_cm, system),
            beam_angle_deg: light.beam_angle_deg != null ? String(light.beam_angle_deg) : '',
            ip_rating: light.ip_rating ?? '',
          }
        : {
            name: '',
            image_url: null,
            type: 'led',
            quantity: '1',
            watts: '',
            color_temp_k: '',
            spectrum: null,
            dimmable: false,
            ppf_umol_s: '',
            efficacy_umol_j: '',
            ppfd_umol_m2_s: '',
            ppfd_distance_cm: '',
            coverage_width_cm: '',
            coverage_depth_cm: '',
            beam_angle_deg: '',
            ip_rating: '',
          }
    );
  }, [visible, light, system, resetSave, resetForm]);

  const type = form.values.type;

  const handleSave = () => {
    form.submit((values) =>
      save.mutate({
        id: light?.id,
        values: {
          ...values,
          // Dropped rather than kept hidden, so switching an entry to HPS doesn't
          // leave a stale colour temperature behind it.
          color_temp_k: hasColorTemp(values.type) ? values.color_temp_k : null,
        },
      })
    );
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>{isEditing ? 'Edit Grow Light' : 'New Grow Light'}</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <ImagePickerField
              value={form.values.image_url}
              onChange={(url) => form.set('image_url', url)}
              entity="grow_lights"
            />

            <FormField label="Name" {...form.field('name')} />

            <Text variant="labelLarge" style={styles.sectionLabel}>
              Type
            </Text>
            <View style={styles.chips}>
              {LIGHT_TYPES.map((entry) => (
                <Chip
                  key={entry.value}
                  compact
                  selected={type === entry.value}
                  showSelectedCheck={false}
                  onPress={() => form.set('type', entry.value)}
                >
                  {entry.label}
                </Chip>
              ))}
            </View>

            <FormField label="Quantity" keyboardType="number-pad" {...form.field('quantity')} />
            <FormField label="Power (W)" keyboardType="decimal-pad" {...form.field('watts')} />
            {hasColorTemp(type) && (
              <FormField
                label="Colour temperature (K)"
                keyboardType="number-pad"
                {...form.field('color_temp_k')}
              />
            )}

            <Checkbox.Item
              label="Dimmable"
              status={form.values.dimmable ? 'checked' : 'unchecked'}
              onPress={() => form.set('dimmable', !form.values.dimmable)}
              position="leading"
              style={styles.checkbox}
            />

            <Button
              mode="text"
              compact
              onPress={() => setShowSpecs((value) => !value)}
              style={styles.specsToggle}
            >
              {showSpecs ? 'Hide spec sheet figures' : 'Add spec sheet figures'}
            </Button>

            {showSpecs && (
              <>
                <Text variant="labelLarge" style={styles.sectionLabel}>
                  Spectrum
                </Text>
                <View style={styles.chips}>
                  {SPECTRUMS.map((entry) => (
                    <Chip
                      key={entry.value}
                      compact
                      selected={form.values.spectrum === entry.value}
                      showSelectedCheck={false}
                      // Tapping the selected one clears it, since spectrum is optional.
                      onPress={() =>
                        form.set(
                          'spectrum',
                          form.values.spectrum === entry.value ? null : entry.value
                        )
                      }
                    >
                      {entry.label}
                    </Chip>
                  ))}
                </View>

                <View style={styles.row}>
                  <FormField
                    label="PPF (µmol/s)"
                    keyboardType="decimal-pad"
                    style={styles.rowField}
                    {...form.field('ppf_umol_s')}
                  />
                  <FormField
                    label="Efficacy (µmol/J)"
                    keyboardType="decimal-pad"
                    style={styles.rowField}
                    {...form.field('efficacy_umol_j')}
                  />
                </View>

                <View style={styles.row}>
                  <FormField
                    label="PPFD (µmol/m²/s)"
                    keyboardType="decimal-pad"
                    style={styles.rowField}
                    {...form.field('ppfd_umol_m2_s')}
                  />
                  <FormField
                    label={`At distance (${lengthUnit(system)})`}
                    keyboardType="decimal-pad"
                    style={styles.rowField}
                    {...form.field('ppfd_distance_cm')}
                  />
                </View>
                <HelperText type="info">
                  A PPFD figure only means something at a stated hanging distance.
                </HelperText>

                <View style={styles.row}>
                  <FormField
                    label={`Coverage width (${lengthUnit(system)})`}
                    keyboardType="decimal-pad"
                    style={styles.rowField}
                    {...form.field('coverage_width_cm')}
                  />
                  <FormField
                    label={`Coverage depth (${lengthUnit(system)})`}
                    keyboardType="decimal-pad"
                    style={styles.rowField}
                    {...form.field('coverage_depth_cm')}
                  />
                </View>

                <View style={styles.row}>
                  <FormField
                    label="Beam angle (°)"
                    keyboardType="number-pad"
                    style={styles.rowField}
                    {...form.field('beam_angle_deg')}
                  />
                  <FormField
                    label="IP rating"
                    autoCapitalize="characters"
                    style={styles.rowField}
                    {...form.field('ip_rating')}
                  />
                </View>
              </>
            )}

            <HelperText type="info">One entry covers a whole set of identical fixtures.</HelperText>

            <ErrorText>{save.isError ? messageFor(save.error) : ''}</ErrorText>
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={save.isPending}>
            Cancel
          </Button>
          <Button
            onPress={handleSave}
            loading={save.isPending}
            disabled={save.isPending || !form.canSubmit}
          >
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
  sectionLabel: {
    marginBottom: 4,
    opacity: 0.7,
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
  checkbox: {
    paddingHorizontal: 0,
  },
  specsToggle: {
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
});
