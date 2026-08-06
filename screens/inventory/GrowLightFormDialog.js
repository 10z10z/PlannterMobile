import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Checkbox, Chip, Dialog, HelperText, Portal, Text } from 'react-native-paper';
import TextField from '../../components/TextField';
import { messageFor } from '../../lib/errors';
import { useSaveInventoryItem } from '../../hooks/useInventory';
import { useUnits } from '../../contexts/UnitsContext';
import { formatLength, lengthUnit, parseLength } from '../../lib/units';
import { hasColorTemp, LIGHT_TYPES, SPECTRUMS } from '../../lib/growLights';
import ImagePickerField from '../../components/ImagePickerField';
import ErrorText from '../../components/ErrorText';

function toNumberOrNull(text) {
  if (text === null || text === undefined || String(text).trim() === '') return null;
  const value = Number(String(text).replace(',', '.'));
  return Number.isNaN(value) ? null : value;
}

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

  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState(null);
  const [type, setType] = useState('led');
  const [quantity, setQuantity] = useState('1');
  const [watts, setWatts] = useState('');
  const [colorTemp, setColorTemp] = useState('');
  const [spectrum, setSpectrum] = useState(null);
  const [dimmable, setDimmable] = useState(false);
  const [ppf, setPpf] = useState('');
  const [efficacy, setEfficacy] = useState('');
  const [ppfd, setPpfd] = useState('');
  const [ppfdDistance, setPpfdDistance] = useState('');
  const [coverageWidth, setCoverageWidth] = useState('');
  const [coverageDepth, setCoverageDepth] = useState('');
  const [beamAngle, setBeamAngle] = useState('');
  const [ipRating, setIpRating] = useState('');

  const [showSpecs, setShowSpecs] = useState(false);
  // Only what this form checks itself; anything the server objects to arrives
  // on the mutation, and both are shown in the same place.
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setValidationError('');
    resetSave();
    setShowSpecs(false);
    if (light) {
      setName(light.name);
      setImageUrl(light.image_url);
      setType(light.type);
      setQuantity(String(light.quantity));
      setWatts(light.watts != null ? String(light.watts) : '');
      setColorTemp(light.color_temp_k != null ? String(light.color_temp_k) : '');
      setSpectrum(light.spectrum);
      setDimmable(light.dimmable);
      setPpf(light.ppf_umol_s != null ? String(light.ppf_umol_s) : '');
      setEfficacy(light.efficacy_umol_j != null ? String(light.efficacy_umol_j) : '');
      setPpfd(light.ppfd_umol_m2_s != null ? String(light.ppfd_umol_m2_s) : '');
      setPpfdDistance(formatLength(light.ppfd_distance_cm, system));
      setCoverageWidth(formatLength(light.coverage_width_cm, system));
      setCoverageDepth(formatLength(light.coverage_depth_cm, system));
      setBeamAngle(light.beam_angle_deg != null ? String(light.beam_angle_deg) : '');
      setIpRating(light.ip_rating ?? '');
    } else {
      setName('');
      setImageUrl(null);
      setType('led');
      setQuantity('1');
      setWatts('');
      setColorTemp('');
      setSpectrum(null);
      setDimmable(false);
      setPpf('');
      setEfficacy('');
      setPpfd('');
      setPpfdDistance('');
      setCoverageWidth('');
      setCoverageDepth('');
      setBeamAngle('');
      setIpRating('');
    }
  }, [visible, light, system, resetSave]);

  const handleSave = () => {
    const count = parseInt(quantity, 10);
    if (!name.trim()) {
      setValidationError('Name is required');
      return;
    }
    if (!count || count < 1) {
      setValidationError('Quantity must be at least 1');
      return;
    }
    setValidationError('');

    const values = {
      name: name.trim(),
      image_url: imageUrl,
      type,
      quantity: count,
      watts: toNumberOrNull(watts),
      // Dropped rather than kept hidden, so switching an entry to HPS doesn't
      // leave a stale colour temperature behind it.
      color_temp_k: hasColorTemp(type) ? toNumberOrNull(colorTemp) : null,
      spectrum,
      dimmable,
      ppf_umol_s: toNumberOrNull(ppf),
      efficacy_umol_j: toNumberOrNull(efficacy),
      ppfd_umol_m2_s: toNumberOrNull(ppfd),
      ppfd_distance_cm: parseLength(ppfdDistance, system),
      coverage_width_cm: parseLength(coverageWidth, system),
      coverage_depth_cm: parseLength(coverageDepth, system),
      beam_angle_deg: toNumberOrNull(beamAngle),
      ip_rating: ipRating.trim() || null,
    };

    save.mutate({ id: light?.id, values });
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>{isEditing ? 'Edit Grow Light' : 'New Grow Light'}</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <ImagePickerField value={imageUrl} onChange={setImageUrl} entity="grow_lights" />

            <TextField label="Name" value={name} onChangeText={setName} style={styles.input} />

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
                  onPress={() => setType(entry.value)}
                >
                  {entry.label}
                </Chip>
              ))}
            </View>

            <TextField
              label="Quantity"
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="number-pad"
              style={styles.input}
            />
            <TextField
              label="Power (W)"
              value={watts}
              onChangeText={setWatts}
              keyboardType="decimal-pad"
              style={styles.input}
            />
            {hasColorTemp(type) && (
              <TextField
                label="Colour temperature (K)"
                value={colorTemp}
                onChangeText={setColorTemp}
                keyboardType="number-pad"
                style={styles.input}
              />
            )}

            <Checkbox.Item
              label="Dimmable"
              status={dimmable ? 'checked' : 'unchecked'}
              onPress={() => setDimmable((value) => !value)}
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
                      selected={spectrum === entry.value}
                      showSelectedCheck={false}
                      // Tapping the selected one clears it, since spectrum is optional.
                      onPress={() =>
                        setSpectrum((current) => (current === entry.value ? null : entry.value))
                      }
                    >
                      {entry.label}
                    </Chip>
                  ))}
                </View>

                <View style={styles.row}>
                  <TextField
                    label="PPF (µmol/s)"
                    value={ppf}
                    onChangeText={setPpf}
                    keyboardType="decimal-pad"
                    style={[styles.input, styles.rowField]}
                  />
                  <TextField
                    label="Efficacy (µmol/J)"
                    value={efficacy}
                    onChangeText={setEfficacy}
                    keyboardType="decimal-pad"
                    style={[styles.input, styles.rowField]}
                  />
                </View>

                <View style={styles.row}>
                  <TextField
                    label="PPFD (µmol/m²/s)"
                    value={ppfd}
                    onChangeText={setPpfd}
                    keyboardType="decimal-pad"
                    style={[styles.input, styles.rowField]}
                  />
                  <TextField
                    label={`At distance (${lengthUnit(system)})`}
                    value={ppfdDistance}
                    onChangeText={setPpfdDistance}
                    keyboardType="decimal-pad"
                    style={[styles.input, styles.rowField]}
                  />
                </View>
                <HelperText type="info">
                  A PPFD figure only means something at a stated hanging distance.
                </HelperText>

                <View style={styles.row}>
                  <TextField
                    label={`Coverage width (${lengthUnit(system)})`}
                    value={coverageWidth}
                    onChangeText={setCoverageWidth}
                    keyboardType="decimal-pad"
                    style={[styles.input, styles.rowField]}
                  />
                  <TextField
                    label={`Coverage depth (${lengthUnit(system)})`}
                    value={coverageDepth}
                    onChangeText={setCoverageDepth}
                    keyboardType="decimal-pad"
                    style={[styles.input, styles.rowField]}
                  />
                </View>

                <View style={styles.row}>
                  <TextField
                    label="Beam angle (°)"
                    value={beamAngle}
                    onChangeText={setBeamAngle}
                    keyboardType="number-pad"
                    style={[styles.input, styles.rowField]}
                  />
                  <TextField
                    label="IP rating"
                    value={ipRating}
                    onChangeText={setIpRating}
                    autoCapitalize="characters"
                    style={[styles.input, styles.rowField]}
                  />
                </View>
              </>
            )}

            <HelperText type="info">One entry covers a whole set of identical fixtures.</HelperText>

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
