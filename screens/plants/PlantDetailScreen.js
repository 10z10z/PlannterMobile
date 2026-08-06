import { useCallback, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Dialog,
  HelperText,
  Menu,
  Portal,
  Text,
  useTheme,
} from 'react-native-paper';
import TextField from '../../components/TextField';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { cancelWateringReminder, scheduleWateringReminder } from '../../lib/notifications';
import { recordEvent } from '../../lib/activity';
import FeedingDialog from '../calendar/FeedingDialog';
import ImagePickerField from '../../components/ImagePickerField';
import ContainerPicker from '../../components/ContainerPicker';
import { useUnits } from '../../contexts/UnitsContext';
import { containerLabel } from '../../lib/containers';
import {
  daysSinceGermination,
  daysSinceTransplant,
  plantPhase,
  plantTypeLabel,
} from '../../lib/plants';
import { SPECIES, SPECIES_KEYS, daysToNextPhase } from '../../lib/species';
import DateField from '../../components/DateField';
import ErrorText from '../../components/ErrorText';

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** A stored `YYYY-MM-DD`, read as a local date rather than as UTC midnight. */
function formatDateOnly(dateString) {
  if (!dateString) return '';
  const [year, month, day] = String(dateString).split('-').map(Number);
  return formatDate(new Date(year, month - 1, day));
}

export default function PlantDetailScreen({ route, navigation }) {
  const { plantId } = route.params;
  const { system } = useUnits();
  const theme = useTheme();
  const [plant, setPlant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editVisible, setEditVisible] = useState(false);
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('');
  const [intervalDays, setIntervalDays] = useState('');
  const [imageUrl, setImageUrl] = useState(null);
  const [containerId, setContainerId] = useState(null);
  const [plantType, setPlantType] = useState('');
  const [germinatedOn, setGerminatedOn] = useState(null);
  const [typeMenuVisible, setTypeMenuVisible] = useState(false);
  const [feedVisible, setFeedVisible] = useState(false);
  const [watering, setWatering] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchPlant = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('plants')
      .select('*, containers(material, volume_liters)')
      .eq('id', plantId)
      .single();
    if (!error) setPlant(data);
    setLoading(false);
  }, [plantId]);

  useFocusEffect(
    useCallback(() => {
      fetchPlant();
    }, [fetchPlant])
  );

  const openEditDialog = () => {
    setName(plant.name);
    setSpecies(plant.species || '');
    setIntervalDays(String(plant.watering_interval_days));
    setImageUrl(plant.image_url);
    setContainerId(plant.container_id);
    setPlantType(plant.plant_type || '');
    setGerminatedOn(plant.germinated_on);
    setError('');
    setEditVisible(true);
  };

  const handleSaveEdit = async () => {
    const interval = parseInt(intervalDays, 10);
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!interval || interval < 1) {
      setError('Watering interval must be a positive number of days');
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from('plants')
      .update({
        name: name.trim(),
        species: species.trim() || null,
        plant_type: plantType.trim() || null,
        germinated_on: germinatedOn,
        watering_interval_days: interval,
        image_url: imageUrl,
        container_id: containerId,
      })
      .eq('id', plantId)
      .select('*, containers(material, volume_liters)')
      .single();
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setPlant(data);
    await scheduleWateringReminder(data);
    setEditVisible(false);
  };

  /**
   * Watering restarts the reminder cycle and goes into the calendar. The plant
   * itself only keeps the most recent watering, so this log is what makes the
   * ones before it recoverable at all.
   */
  const handleWater = async () => {
    setWatering(true);
    const wateredAt = new Date().toISOString();
    const { data, error: waterError } = await supabase
      .from('plants')
      .update({ last_watered_at: wateredAt })
      .eq('id', plantId)
      .select('*, containers(material, volume_liters)')
      .single();
    setWatering(false);
    if (waterError) return;

    setPlant(data);
    await scheduleWateringReminder(data);
    await recordEvent({
      kind: 'watered',
      subject: data.name,
      detail: `Every ${data.watering_interval_days} days`,
      growspaceId: data.growspace_id,
      plantId: data.id,
    });
  };

  const handleDelete = async () => {
    await cancelWateringReminder(plantId);
    // Logged first, so the entry can still name what was pulled.
    await recordEvent({
      kind: 'removed',
      subject: plant.name,
      detail: plantTypeLabel(plant) ?? plant.species ?? null,
      growspaceId: plant.growspace_id,
    });
    await supabase.from('plants').delete().eq('id', plantId);
    navigation.goBack();
  };

  if (loading || !plant) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  const phase = plantPhase(plant);
  // What the feeding dialog starts from: this plant, in its own growspace. It is
  // read when the dialog opens rather than watched, so rebuilding it each render
  // costs nothing.
  const feedPreset = { placeId: plant.growspace_id, plants: [{ id: plant.id, name: plant.name }] };
  const germinatedDays = daysSinceGermination(plant);
  const transplantDays = daysSinceTransplant(plant);
  const toNextPhase = daysToNextPhase(plant.plant_type, germinatedDays);

  return (
    <View style={styles.container}>
      {plant.image_url ? (
        <Image source={{ uri: plant.image_url }} style={styles.heroImage} />
      ) : (
        <View style={[styles.heroPlaceholder, { backgroundColor: theme.colors.surfaceVariant }]}>
          <MaterialCommunityIcons name="leaf" size={48} color={theme.colors.onSurfaceVariant} />
        </View>
      )}

      <Text variant="headlineMedium">{plant.name}</Text>
      {!!(plantTypeLabel(plant) || plant.species) && (
        <Text variant="bodyLarge" style={styles.species}>
          {plantTypeLabel(plant) ?? plant.species}
        </Text>
      )}

      {!!phase && (
        <View style={styles.phaseBlock}>
          <Text variant="titleMedium">{phase.label}</Text>
          <Text variant="bodySmall" style={styles.phaseHint}>
            {toNextPhase !== null
              ? `Typically another ${toNextPhase}d at this stage`
              : 'The last stage for this crop'}
            {' · a guideline, not a schedule'}
          </Text>
        </View>
      )}

      <View style={styles.infoBlock}>
        {germinatedDays !== null && (
          <Text variant="bodyMedium">
            Germinated: {formatDateOnly(plant.germinated_on)} · {germinatedDays}d ago
          </Text>
        )}
        {transplantDays !== null && (
          <Text variant="bodyMedium">
            {transplantDays === 0
              ? 'Planted in this growspace today'
              : `In this growspace: ${transplantDays}d`}
          </Text>
        )}
        <Text variant="bodyMedium">
          Watering interval: every {plant.watering_interval_days} days
        </Text>
        <Text variant="bodyMedium">Last watered: {formatDate(plant.last_watered_at)}</Text>
        {!!plant.containers && (
          <Text variant="bodyMedium">Container: {containerLabel(plant.containers, system)}</Text>
        )}
      </View>

      <View style={styles.careRow}>
        <Button
          mode="contained-tonal"
          icon="water-outline"
          onPress={handleWater}
          loading={watering}
          disabled={watering}
          style={styles.careButton}
        >
          Water now
        </Button>
        <Button
          mode="contained-tonal"
          icon="cup-water"
          onPress={() => setFeedVisible(true)}
          style={styles.careButton}
        >
          Log feeding
        </Button>
      </View>

      <Button mode="outlined" onPress={openEditDialog} style={styles.actionButton}>
        Edit
      </Button>
      <Button mode="text" textColor="red" onPress={handleDelete} style={styles.actionButton}>
        Delete plant
      </Button>

      <FeedingDialog
        visible={feedVisible}
        preset={feedPreset}
        onDismiss={() => setFeedVisible(false)}
        onDone={() => setFeedVisible(false)}
      />

      <Portal>
        <Dialog visible={editVisible} onDismiss={() => setEditVisible(false)} style={styles.dialog}>
          <Dialog.Title>Edit Plant</Dialog.Title>
          <Dialog.ScrollArea style={styles.scrollArea}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
              <ImagePickerField value={imageUrl} onChange={setImageUrl} entity="plants" />
              <TextField label="Name" value={name} onChangeText={setName} style={styles.input} />
              <TextField
                label="Species (optional)"
                value={species}
                onChangeText={setSpecies}
                style={styles.input}
              />

              {/* Free text, since a grower may keep something the guidelines
                don't cover — the picker is a shortcut to the crops that carry
                phase guidelines, not a closed list. */}
              <Menu
                visible={typeMenuVisible}
                onDismiss={() => setTypeMenuVisible(false)}
                anchor={
                  <TextField
                    label="Crop (optional)"
                    value={plantType}
                    onChangeText={setPlantType}
                    right={
                      <TextField.Icon icon="menu-down" onPress={() => setTypeMenuVisible(true)} />
                    }
                    style={styles.input}
                  />
                }
              >
                {SPECIES_KEYS.map((key) => (
                  <Menu.Item
                    key={key}
                    title={SPECIES[key].label}
                    leadingIcon={SPECIES[key].icon}
                    onPress={() => {
                      setPlantType(SPECIES[key].label);
                      setTypeMenuVisible(false);
                    }}
                  />
                ))}
              </Menu>

              <DateField
                label="Germinated on (optional)"
                value={germinatedOn}
                onChange={setGerminatedOn}
                maximumDate={new Date()}
              />
              <HelperText type="info">
                What the growth phase is counted from. Transplants bring it with them.
              </HelperText>

              <TextField
                label="Watering interval (days)"
                value={intervalDays}
                onChangeText={setIntervalDays}
                keyboardType="number-pad"
                style={styles.input}
              />
              <ContainerPicker value={containerId} onChange={setContainerId} />
              <ErrorText>{error}</ErrorText>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setEditVisible(false)}>Cancel</Button>
            <Button onPress={handleSaveEdit} loading={saving} disabled={saving}>
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
  },
  heroPlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  species: {
    opacity: 0.7,
    marginBottom: 16,
  },
  phaseBlock: {
    marginBottom: 16,
  },
  phaseHint: {
    opacity: 0.6,
  },
  infoBlock: {
    marginBottom: 24,
    gap: 4,
  },
  careRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  careButton: {
    flex: 1,
  },
  actionButton: {
    marginBottom: 12,
  },
  input: {
    marginBottom: 8,
  },
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
});
