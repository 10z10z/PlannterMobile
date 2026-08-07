import { useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, FAB, List, Portal, SegmentedButtons, Text } from 'react-native-paper';
import FormField from '../../components/FormField';
import useForm from '../../hooks/useForm';
import { plantSchema } from '../../lib/schemas';
import { useNavigation } from '@react-navigation/native';
import { useUnits } from '../../contexts/UnitsContext';
import { useWeather } from '../../contexts/WeatherContext';
import { formatTemperature, tempUnit } from '../../lib/units';
import { assignmentSummary, assignmentTitle } from '../../lib/growLights';
import { conditionsFor, placeLabel, readingAgeLabel } from '../../lib/weather';
import { environmentLabel, sunHoursLabel, totalSpots } from '../../lib/growspaces';
import PlantCard from '../../components/PlantCard';
import PlantGrid from '../../components/PlantGrid';
import ImagePickerField from '../../components/ImagePickerField';
import ContainerPicker from '../../components/ContainerPicker';
import GrowspaceFormDialog from './GrowspaceFormDialog';
import ErrorText from '../../components/ErrorText';
import { messageFor } from '../../lib/errors';
import {
  useCreatePlant,
  useGrowspace,
  useGrowspaceGrids,
  useGrowspaceLights,
  useGrowspacePlants,
} from '../../hooks/useGrowspaces';
import usePlantMove from '../../hooks/usePlantMove';
import useRefresh from '../../hooks/useRefresh';

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

  // What a drop means, what it writes and what it says in the calendar — all of
  // it out in a hook, so the part with three failure paths isn't only reachable
  // through a finger on a PanResponder.
  const { move, unplace } = usePlantMove({ growspaceId, grids, plants });

  /** Pulling down refreshes all four, since they are one screen. */
  const refresh = useRefresh([growspaceQuery, gridQuery, plantQuery, lightQuery]);

  const openPlantDetail = (plant) =>
    navigation.navigate('PlantDetail', { plantId: plant.id, plantName: plant.name });

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
        <ScrollView
          contentContainerStyle={styles.listContent}
          // The layout view is the one this screen opens on, and it was the one
          // with no way to refresh — the pull only worked after switching to the
          // list, which is the tab nobody uses.
          refreshControl={<RefreshControl {...refresh} />}
        >
          {header}
          {growspace && (
            <PlantGrid
              grids={grids}
              plants={plants}
              onPress={openPlantDetail}
              onMove={move}
              onUnplace={unplace}
            />
          )}
        </ScrollView>
      ) : (
        <FlatList
          data={plants}
          keyExtractor={(item) => item.id}
          refreshing={refresh.refreshing}
          onRefresh={refresh.onRefresh}
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

      <FAB icon="plus" accessibilityLabel="Add a plant" style={styles.fab} onPress={openDialog} />

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
