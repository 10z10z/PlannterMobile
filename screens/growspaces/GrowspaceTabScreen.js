import { useCallback, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Dialog,
  FAB,
  List,
  Portal,
  SegmentedButtons,
  Text,
} from 'react-native-paper';
import TextField from '../../components/TextField';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useUnits } from '../../contexts/UnitsContext';
import { useWeather } from '../../contexts/WeatherContext';
import { formatTemperature, tempUnit } from '../../lib/units';
import { scheduleWateringReminder } from '../../lib/notifications';
import { recordEvent, recordMove } from '../../lib/activity';
import { assignmentSummary, assignmentTitle } from '../../lib/growLights';
import { conditionsFor, placeLabel, readingAgeLabel } from '../../lib/weather';
import {
  environmentLabel,
  fetchGrids,
  fetchGrowspace,
  fetchGrowspaceLights,
  fetchPlants,
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
import { toDateString } from '../../components/DateField';
import GrowspaceFormDialog from './GrowspaceFormDialog';

export default function GrowspaceTabScreen({ route }) {
  const { growspaceId } = route.params;
  const navigation = useNavigation();
  const { session } = useAuth();
  const { system } = useUnits();
  const { place, reading } = useWeather();

  const [growspace, setGrowspace] = useState(null);
  const [grids, setGrids] = useState([]);
  const [plants, setPlants] = useState([]);
  const [lights, setLights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('grid');
  const [editVisible, setEditVisible] = useState(false);

  const [dialogVisible, setDialogVisible] = useState(false);
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('');
  const [intervalDays, setIntervalDays] = useState('7');
  const [plantType, setPlantType] = useState('');
  const [imageUrl, setImageUrl] = useState(null);
  const [containerId, setContainerId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [growspaceRow, gridRows, plantRows, lightRows] = await Promise.all([
        fetchGrowspace(growspaceId),
        fetchGrids(growspaceId),
        fetchPlants(growspaceId),
        fetchGrowspaceLights(growspaceId),
      ]);
      setGrowspace(growspaceRow);
      setGrids(gridRows);
      setPlants(plantRows);
      setLights(lightRows);
    } catch {
      // Leave the previous state in place; pull-to-refresh retries.
    }
    setLoading(false);
  }, [growspaceId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

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
      setPlants((current) =>
        current.map((entry) => (entry.id === plant.id ? { ...entry, ...at(cell) } : entry))
      );
      try {
        await placePlant(plant.id, cell);
        await recordMove({ plant, detail: spotLabel(cell), growspaceId });
      } catch {
        // Put the optimistic move back where it was.
      }
    } else {
      const from = positionOf(plant);
      setPlants((current) =>
        current.map((entry) => {
          if (entry.id === plant.id) return { ...entry, ...at(cell) };
          if (entry.id === drop.occupant.id) return { ...entry, ...at(from) };
          return entry;
        })
      );
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
        // Same — the reload below is the source of truth.
      }
    }

    load();
  };

  const handleUnplace = async (plant) => {
    setPlants((current) =>
      current.map((entry) =>
        entry.id === plant.id
          ? { ...entry, grid_id: null, grid_row: null, grid_col: null }
          : entry
      )
    );
    try {
      await placePlant(plant.id, null);
      await recordMove({ plant, detail: spotLabel(null), growspaceId });
    } catch {
      // The reload puts it back if the write failed.
    }
    load();
  };

  const openDialog = () => {
    setName('');
    setSpecies('');
    setIntervalDays('7');
    setPlantType('');
    setImageUrl(null);
    setContainerId(null);
    setError('');
    setDialogVisible(true);
  };

  const handleCreate = async () => {
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
    const nowIso = new Date().toISOString();
    const { data, error: insertError } = await supabase
      .from('plants')
      .insert({
        name: name.trim(),
        species: species.trim() || null,
        plant_type: plantType.trim() || null,
        transplanted_on: toDateString(new Date()),
        watering_interval_days: interval,
        last_watered_at: nowIso,
        image_url: imageUrl,
        container_id: containerId,
        user_id: session.user.id,
        growspace_id: growspaceId,
      })
      .select()
      .single();
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    await scheduleWateringReminder(data);
    await recordEvent({
      userId: session.user.id,
      kind: 'planted',
      subject: data.name,
      detail: data.plant_type || data.species || null,
      growspaceId,
      plantId: data.id,
    });
    setDialogVisible(false);
    load();
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
        left={(props) => <List.Icon {...props} icon={live ? 'weather-partly-cloudy' : 'home-thermometer-outline'} />}
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
          refreshing={loading}
          onRefresh={load}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={header}
          ListEmptyComponent={
            !loading && <Text style={styles.emptyText}>No plants here yet. Tap + to add one.</Text>
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
          load();
        }}
      />

      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
          <Dialog.Title>New Plant</Dialog.Title>
          <Dialog.Content>
            <ImagePickerField value={imageUrl} onChange={setImageUrl} entity="plants" />
            <TextField label="Name" value={name} onChangeText={setName} style={styles.input} />
            <TextField
              label="Species (optional)"
              value={species}
              onChangeText={setSpecies}
              style={styles.input}
            />
            <TextField
              label="Crop (optional)"
              placeholder="Pepper, tomato, lettuce…"
              value={plantType}
              onChangeText={setPlantType}
              style={styles.input}
            />
            <TextField
              label="Watering interval (days)"
              value={intervalDays}
              onChangeText={setIntervalDays}
              keyboardType="number-pad"
              style={styles.input}
            />
            <ContainerPicker value={containerId} onChange={setContainerId} />
            <Text variant="bodySmall" style={styles.hint}>
              New plants wait in the holding tray until you place them.
            </Text>
            {!!error && <Text style={styles.errorText}>{error}</Text>}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleCreate} loading={saving} disabled={saving}>
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
  errorText: {
    color: 'red',
  },
});
