import { useState } from 'react';
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
import FormField from '../../components/FormField';
import useForm from '../../hooks/useForm';
import { plantEditSchema } from '../../lib/schemas';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { messageFor } from '../../lib/errors';
import { useDeletePlant, usePlant, useUpdatePlant, useWaterPlant } from '../../hooks/useGrowspaces';
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
  const plantQuery = usePlant(plantId);
  const plant = plantQuery.data ?? null;
  const loading = plantQuery.isPending;
  const [editVisible, setEditVisible] = useState(false);
  const [typeMenuVisible, setTypeMenuVisible] = useState(false);
  const [feedVisible, setFeedVisible] = useState(false);
  const form = useForm(plantEditSchema);

  const update = useUpdatePlant({ onSuccess: () => setEditVisible(false) });
  const water = useWaterPlant();
  const remove = useDeletePlant({ onSuccess: () => navigation.goBack() });

  const openEditDialog = () => {
    form.reset({
      name: plant.name,
      species: plant.species || '',
      plant_type: plant.plant_type || '',
      germinated_on: plant.germinated_on,
      watering_interval_days: String(plant.watering_interval_days),
      image_url: plant.image_url,
      container_id: plant.container_id,
    });
    setEditVisible(true);
  };

  const handleSaveEdit = () => {
    form.submit((values) => update.mutate({ plantId, values }));
  };

  /**
   * Watering restarts the reminder cycle and goes into the calendar. The plant
   * itself only keeps the most recent watering, so this log is what makes the
   * ones before it recoverable at all.
   */
  const handleWater = () => water.mutate(plantId);

  const handleDelete = () =>
    remove.mutate({ plant, detail: plantTypeLabel(plant) ?? plant.species ?? null });

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
          loading={water.isPending}
          disabled={water.isPending}
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
              <ImagePickerField
                value={form.values.image_url}
                onChange={(url) => form.set('image_url', url)}
                entity="plants"
              />
              <FormField label="Name" {...form.field('name')} />
              <FormField label="Species (optional)" {...form.field('species')} />

              {/* Free text, since a grower may keep something the guidelines
                don't cover — the picker is a shortcut to the crops that carry
                phase guidelines, not a closed list. */}
              <Menu
                visible={typeMenuVisible}
                onDismiss={() => setTypeMenuVisible(false)}
                anchor={
                  <FormField
                    label="Crop (optional)"
                    right={
                      <FormField.Icon icon="menu-down" onPress={() => setTypeMenuVisible(true)} />
                    }
                    {...form.field('plant_type')}
                  />
                }
              >
                {SPECIES_KEYS.map((key) => (
                  <Menu.Item
                    key={key}
                    title={SPECIES[key].label}
                    leadingIcon={SPECIES[key].icon}
                    onPress={() => {
                      form.set('plant_type', SPECIES[key].label);
                      setTypeMenuVisible(false);
                    }}
                  />
                ))}
              </Menu>

              <DateField
                label="Germinated on (optional)"
                value={form.values.germinated_on}
                onChange={(date) => form.set('germinated_on', date)}
                maximumDate={new Date()}
              />
              <HelperText type="info">
                What the growth phase is counted from. Transplants bring it with them.
              </HelperText>

              <FormField
                label="Watering interval (days)"
                keyboardType="number-pad"
                {...form.field('watering_interval_days')}
              />
              <ContainerPicker
                value={form.values.container_id}
                onChange={(id) => form.set('container_id', id)}
              />
              <ErrorText>{update.isError ? messageFor(update.error) : ''}</ErrorText>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setEditVisible(false)}>Cancel</Button>
            <Button
              onPress={handleSaveEdit}
              loading={update.isPending}
              disabled={update.isPending || !form.canSubmit}
            >
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
