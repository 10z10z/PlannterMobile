import { useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, FAB, List, Portal, SegmentedButtons, Text } from 'react-native-paper';
import FormField from '../../components/FormField';
import useForm from '../../hooks/useForm';
import { plantSchema } from '../../lib/schemas';
import { useNavigation } from '@react-navigation/native';
import { useUnits } from '../../contexts/UnitsContext';
import { useWeather } from '../../contexts/WeatherContext';
import { formatTemperature, tempUnit } from '../../lib/units';
import { recordMove } from '../../lib/activity';
import { assignmentSummary, assignmentTitle } from '../../lib/growLights';
import { conditionsFor, placeLabel, readingAgeLabel } from '../../lib/weather';
import {
  environmentLabel,
  sunHoursLabel,
  placePlant,
  positionOf,
  resolveDrop,
  swapPlants,
  totalSpots,
} from '../../lib/growspaces';
import PlantCard from '../../components/PlantCard';
import PlantGrid from '../../components/PlantGrid';
import ImagePickerField from '../../components/ImagePickerField';
import ContainerPicker from '../../components/ContainerPicker';
import GrowspaceFormDialog from './GrowspaceFormDialog';
import ErrorText from '../../components/ErrorText';
import { messageFor } from '../../lib/errors';
import { invalidateFor, keys } from '../../lib/queryKeys';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCreatePlant,
  useGrowspace,
  useGrowspaceGrids,
  useGrowspaceLights,
  useGrowspacePlants,
} from '../../hooks/useGrowspaces';

export default function GrowspaceTabScreen({ route }) {
  const { growspaceId } = route.params;
  // Named so that pushing a plant is checked against the stack this tab sits
  // in; a bare useNavigation() knows no route names and takes any params.
  const navigation =
    /** @type {import('@react-navigation/native').NavigationProp<import('../../navigation/types').GrowspacesParamList>} */ (
      useNavigation()
    );
  const { system } = useUnits();
  const { place, reading } = useWeather();

  const queryClient = useQueryClient();
  const growspaceQuery = useGrowspace(growspaceId);
  const gridQuery = useGrowspaceGrids(growspaceId);
  const plantQuery = useGrowspacePlants(growspaceId);
  const lightQuery = useGrowspaceLights(growspaceId);

  const growspace = growspaceQuery.data ?? null;
  const grids = gridQuery.data ?? [];
  const plants = plantQuery.data ?? [];
  const lights = lightQuery.data ?? [];
  const [view, setView] = useState('grid');
  const [editVisible, setEditVisible] = useState(false);

  const [dialogVisible, setDialogVisible] = useState(false);
  const form = useForm(plantSchema);

  const createPlant = useCreatePlant({ onSuccess: () => setDialogVisible(false) });

  /**
   * Moves a plant on screen before the write lands.
   *
   * Dragging has to feel immediate — waiting a round trip to see the pot land
   * would make the grid feel broken — so the cached list is edited directly and
   * the invalidation that follows the write confirms or corrects it.
   */
  const placeOptimistically = (update) =>
    queryClient.setQueryData(
      keys.growspaces.plants(growspaceId),
      (/** @type {any[] | undefined} */ current) => (current ?? []).map(update)
    );

  /** Pulling down refreshes all four, since they are one screen. */
  const refreshAll = () => {
    growspaceQuery.refetch();
    gridQuery.refetch();
    plantQuery.refetch();
    lightQuery.refetch();
  };

  const openPlantDetail = (plant) =>
    navigation.navigate('PlantDetail', { plantId: plant.id, plantName: plant.name });

  /** "Shelf, spot 2,3" — where a plant ended up, for the calendar entry. */
  const spotLabel = (cell) => {
    if (!cell) return 'Back in the holding tray';
    const grid = grids.find((entry) => entry.id === cell.gridId);
    return `${grid?.name ?? 'Grid'}, spot ${cell.row + 1},${cell.col + 1}`;
  };

  /**
   * Applies a drop. The plants are updated in place before the reload so the
   * tile doesn't flick back to where it came from while the write is in flight.
   */
  const handleMove = async (plant, cell) => {
    const drop = resolveDrop(plants, plant, cell);
    if (drop.type === 'none') return;

    const at = (target) => ({
      grid_id: target?.gridId ?? null,
      grid_row: target?.row ?? null,
      grid_col: target?.col ?? null,
    });

    if (drop.type === 'move') {
      placeOptimistically((entry) => (entry.id === plant.id ? { ...entry, ...at(cell) } : entry));
      try {
        await placePlant(plant.id, cell);
        await recordMove({ plant, detail: spotLabel(cell), growspaceId });
      } catch {
        // The invalidation below puts the optimistic move back.
      }
      invalidateFor(queryClient, 'plantMoved');
    } else {
      const from = positionOf(plant);
      placeOptimistically((entry) => {
        if (entry.id === plant.id) return { ...entry, ...at(cell) };
        if (entry.id === drop.occupant.id) return { ...entry, ...at(from) };
        return entry;
      });
      try {
        await swapPlants(plant, drop.occupant);
        // A swap moves two plants, and both have a day of their own to record.
        await recordMove({ plant, detail: spotLabel(cell), growspaceId });
        await recordMove({
          plant: drop.occupant,
          detail: `${spotLabel(from)} · swapped with ${plant.name}`,
          growspaceId,
        });
      } catch {
        // Same — the invalidation below is the source of truth.
      }
      invalidateFor(queryClient, 'plantMoved');
    }
  };

  const handleUnplace = async (plant) => {
    placeOptimistically((entry) =>
      entry.id === plant.id ? { ...entry, grid_id: null, grid_row: null, grid_col: null } : entry
    );
    try {
      await placePlant(plant.id, null);
      await recordMove({ plant, detail: spotLabel(null), growspaceId });
    } catch {
      // The invalidation below puts it back if the write failed.
    }
    invalidateFor(queryClient, 'plantMoved');
  };

  const openDialog = () => {
    form.reset({
      name: '',
      species: '',
      plant_type: '',
      watering_interval_days: '7',
      image_url: null,
      container_id: null,
    });
    createPlant.reset();
    setDialogVisible(true);
  };

  const handleCreate = () => {
    form.submit((values) => createPlant.mutate({ growspaceId, values }));
  };

  const sunlit = growspace?.environment === 'outdoor' && growspace?.sun_hours > 0;

  // An outdoor space reads its conditions off the weather where it stands, when
  // a place has been set in settings; otherwise these are the figures recorded
  // for it by hand.
  const conditions = conditionsFor(growspace, reading);
  const live = conditions.liveTemp || conditions.liveHumidity;

  // Only the conditions that were actually filled in, so a windowsill with no
  // thermostat doesn't read as a row of blanks.
  const summary = [
    growspace ? environmentLabel(growspace.environment) : null,
    conditions.tempC !== null
      ? `${formatTemperature(conditions.tempC, system)} ${tempUnit(system)}`
      : null,
    conditions.humidityPct !== null ? `${conditions.humidityPct}% RH` : null,
    live ? `${placeLabel(place)} · ${readingAgeLabel(reading)}` : null,
    grids.length
      ? `${totalSpots(grids)} spots · ${grids.length} grid${grids.length === 1 ? '' : 's'}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const header = (
    <View>
      <List.Item
        title={growspace?.name ?? 'Growspace'}
        description={summary}
        left={(props) => (
          <List.Icon
            {...props}
            icon={live ? 'weather-partly-cloudy' : 'home-thermometer-outline'}
          />
        )}
        right={(props) => <List.Icon {...props} icon="pencil-outline" />}
        onPress={() => setEditVisible(true)}
      />
      {/* The sun and each fixture get a line of their own, so a light's cycle
          and the couple of figures worth knowing have somewhere to sit. */}
      {sunlit && (
        <List.Item
          title={sunHoursLabel(growspace.sun_hours)}
          left={(props) => <List.Icon {...props} icon="white-balance-sunny" />}
          onPress={() => setEditVisible(true)}
          style={styles.lightRow}
        />
      )}
      {lights.map((row) => (
        <List.Item
          key={row.id}
          title={assignmentTitle(row)}
          description={assignmentSummary(row) || undefined}
          left={(props) => <List.Icon {...props} icon="lightbulb-on-outline" />}
          onPress={() => setEditVisible(true)}
          style={styles.lightRow}
        />
      ))}
      {!sunlit && lights.length === 0 && (
        <List.Item
          title="No lights"
          left={(props) => <List.Icon {...props} icon="lightbulb-off-outline" />}
          titleStyle={styles.mutedTitle}
          onPress={() => setEditVisible(true)}
          style={styles.lightRow}
        />
      )}
      <SegmentedButtons
        value={view}
        onValueChange={setView}
        style={styles.viewToggle}
        buttons={[
          { value: 'grid', label: 'Layout', icon: 'view-grid-outline' },
          { value: 'list', label: 'List', icon: 'format-list-bulleted' },
        ]}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      {view === 'grid' ? (
        // The grid drags with a PanResponder, so it can't sit in a FlatList
        // without the two fighting over the touch.
        <ScrollView contentContainerStyle={styles.listContent}>
          {header}
          {growspace && (
            <PlantGrid
              grids={grids}
              plants={plants}
              onPress={openPlantDetail}
              onMove={handleMove}
              onUnplace={handleUnplace}
            />
          )}
        </ScrollView>
      ) : (
        <FlatList
          data={plants}
          keyExtractor={(item) => item.id}
          refreshing={plantQuery.isRefetching}
          onRefresh={refreshAll}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={header}
          ListEmptyComponent={
            !plantQuery.isPending && (
              <Text style={styles.emptyText}>
                {plantQuery.isError
                  ? messageFor(plantQuery.error, 'Couldn’t load the plants in here.')
                  : 'No plants here yet. Tap + to add one.'}
              </Text>
            )
          }
          renderItem={({ item }) => (
            <PlantCard plant={item} onPress={() => openPlantDetail(item)} />
          )}
        />
      )}

      <FAB icon="plus" style={styles.fab} onPress={openDialog} />

      <GrowspaceFormDialog
        visible={editVisible}
        growspace={growspace}
        onDismiss={() => setEditVisible(false)}
        onSaved={(updated) => {
          setEditVisible(false);
          // The tab bar is owned by the screen above, which stays focused while
          // its tabs are used and so never refetches on its own.
          navigation.setOptions({ tabBarLabel: updated.name });
        }}
      />

      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
          <Dialog.Title>New Plant</Dialog.Title>
          <Dialog.Content>
            <ImagePickerField
              value={form.values.image_url}
              onChange={(url) => form.set('image_url', url)}
              entity="plants"
            />
            <FormField label="Name" {...form.field('name')} />
            <FormField label="Species (optional)" {...form.field('species')} />
            <FormField
              label="Crop (optional)"
              placeholder="Pepper, tomato, lettuce…"
              {...form.field('plant_type')}
            />
            <FormField
              label="Watering interval (days)"
              keyboardType="number-pad"
              {...form.field('watering_interval_days')}
            />
            <ContainerPicker
              value={form.values.container_id}
              onChange={(id) => form.set('container_id', id)}
            />
            <Text variant="bodySmall" style={styles.hint}>
              New plants wait in the holding tray until you place them.
            </Text>
            <ErrorText>{createPlant.isError ? messageFor(createPlant.error) : ''}</ErrorText>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>Cancel</Button>
            <Button
              onPress={handleCreate}
              loading={createPlant.isPending}
              disabled={createPlant.isPending || !form.canSubmit}
            >
              Create
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
  },
  listContent: {
    paddingBottom: 96,
  },
  viewToggle: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
  },
  lightRow: {
    paddingVertical: 0,
  },
  mutedTitle: {
    opacity: 0.6,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 48,
    marginHorizontal: 24,
    opacity: 0.6,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
  input: {
    marginBottom: 8,
  },
  hint: {
    marginTop: 8,
    opacity: 0.7,
  },
});
