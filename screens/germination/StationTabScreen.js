import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Dialog, FAB, List, Portal, Text } from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useUnits } from '../../contexts/UnitsContext';
import { useWeather } from '../../contexts/WeatherContext';
import { formatTemperature, tempUnit } from '../../lib/units';
import {
  environmentLabel,
  fetchSowings,
  fetchStation,
  fetchStationLights,
} from '../../lib/germination';
import { assignmentSummary, assignmentTitle } from '../../lib/growLights';
import { conditionsFor, placeLabel, readingAgeLabel } from '../../lib/weather';
import SowingCard from '../../components/SowingCard';
import SowingFormDialog from './SowingFormDialog';
import CellDialog from './CellDialog';
import BatchGerminationDialog from './BatchGerminationDialog';
import TransplantDialog from './TransplantDialog';
import ThinDialog from './ThinDialog';
import MoveSowingDialog from './MoveSowingDialog';
import StationFormDialog from './StationFormDialog';

export default function StationTabScreen({ route }) {
  const { stationId } = route.params;
  const navigation = useNavigation();
  const { system } = useUnits();
  const { place, reading } = useWeather();
  const [station, setStation] = useState(null);
  const [sowings, setSowings] = useState([]);
  const [lights, setLights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formVisible, setFormVisible] = useState(false);
  // The sowing the form is copying, when it was opened by "Sow this again".
  const [template, setTemplate] = useState(null);
  const [editVisible, setEditVisible] = useState(false);
  // { sowing, cell } while a tapped cell is being marked.
  const [activeCell, setActiveCell] = useState(null);
  // The sowing whose cells are all being marked at once.
  const [batchSowing, setBatchSowing] = useState(null);
  // { sowing, cells } — one cell from the cell dialog, or a whole sowing.
  const [transplanting, setTransplanting] = useState(null);
  // The sowing being thinned down to one seedling per cell.
  const [thinning, setThinning] = useState(null);
  // The sowing being moved to another station.
  const [moving, setMoving] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [stationRow, sowingRows, lightRows] = await Promise.all([
        fetchStation(stationId),
        fetchSowings(stationId),
        fetchStationLights(stationId),
      ]);
      setStation(stationRow);
      setSowings(sowingRows);
      setLights(lightRows);
    } catch {
      // Leave the previous list in place; pull-to-refresh retries.
    }
    setLoading(false);
  }, [stationId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // The card hands over the cells it means: everything ready by default, or just
  // the ones picked in selection mode.
  const transplantCells = (sowing, cells) => {
    if (cells?.length) setTransplanting({ sowing, cells });
  };

  // A station kept outdoors reads its conditions off the weather where it
  // stands, when a place has been set in settings.
  const conditions = conditionsFor(station, reading);
  const live = conditions.liveTemp || conditions.liveHumidity;

  // Only the conditions that were actually filled in, so a windowsill with no
  // thermostat doesn't read as a row of blanks. The lights get a row of their
  // own below this one.
  const stationSummary = [
    station ? environmentLabel(station.environment) : null,
    conditions.tempC !== null
      ? `${formatTemperature(conditions.tempC, system)} ${tempUnit(system)}`
      : null,
    conditions.humidityPct !== null ? `${conditions.humidityPct}% RH` : null,
    live ? `${placeLabel(place)} · ${readingAgeLabel(reading)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const handleDelete = async () => {
    const id = pendingDelete.id;
    setPendingDelete(null);
    await supabase.from('sowings').delete().eq('id', id);
    load();
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={sowings}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={load}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <List.Item
              title={station?.name ?? 'Station'}
              description={stationSummary}
              left={(props) => (
                <List.Icon {...props} icon={live ? 'weather-partly-cloudy' : 'thermometer'} />
              )}
              right={(props) => <List.Icon {...props} icon="pencil-outline" />}
              onPress={() => setEditVisible(true)}
            />
            {/* Each fixture gets a line of its own, so its run cycle and the
                figures worth knowing have somewhere to sit rather than trailing
                off the end of the conditions. */}
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
            {lights.length === 0 && (
              <List.Item
                title="No lights"
                left={(props) => <List.Icon {...props} icon="lightbulb-off-outline" />}
                titleStyle={styles.mutedTitle}
                onPress={() => setEditVisible(true)}
                style={styles.stationRow}
              />
            )}
          </View>
        }
        ListEmptyComponent={
          !loading && (
            <Text style={styles.emptyText}>
              Nothing sown here yet. Tap + to plant a seed pack into a tray or a container.
            </Text>
          )
        }
        renderItem={({ item }) => (
          <SowingCard
            sowing={item}
            onCellPress={(cell) => setActiveCell({ sowing: item, cell })}
            onHold={() => setBatchSowing(item)}
            onTransplant={(cells) => transplantCells(item, cells)}
            onThin={() => setThinning(item)}
            onDuplicate={() => {
              setTemplate(item);
              setFormVisible(true);
            }}
            onMove={() => setMoving(item)}
            onDelete={() => setPendingDelete(item)}
          />
        )}
      />

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => {
          setTemplate(null);
          setFormVisible(true);
        }}
      />

      <SowingFormDialog
        visible={formVisible}
        stationId={stationId}
        template={template}
        onDismiss={() => setFormVisible(false)}
        onSaved={() => {
          setFormVisible(false);
          load();
        }}
      />

      <StationFormDialog
        visible={editVisible}
        station={station}
        onDismiss={() => setEditVisible(false)}
        onSaved={(updated) => {
          setEditVisible(false);
          // The tab bar is owned by the screen above, which stays focused while
          // its tabs are used and so never refetches on its own.
          navigation.setOptions({ tabBarLabel: updated.name });
          load();
        }}
      />

      <CellDialog
        visible={!!activeCell}
        cell={activeCell?.cell}
        onDismiss={() => setActiveCell(null)}
        onSaved={() => {
          setActiveCell(null);
          load();
        }}
        onTransplant={() => {
          setTransplanting({ sowing: activeCell.sowing, cells: [activeCell.cell] });
          setActiveCell(null);
        }}
      />

      <BatchGerminationDialog
        visible={!!batchSowing}
        sowing={batchSowing}
        onDismiss={() => setBatchSowing(null)}
        onSaved={() => {
          setBatchSowing(null);
          load();
        }}
      />

      <TransplantDialog
        visible={!!transplanting}
        sowing={transplanting?.sowing}
        cells={transplanting?.cells}
        onDismiss={() => setTransplanting(null)}
        onDone={() => {
          setTransplanting(null);
          load();
        }}
      />

      <ThinDialog
        visible={!!thinning}
        sowing={thinning}
        onDismiss={() => setThinning(null)}
        onDone={() => {
          setThinning(null);
          load();
        }}
      />

      <MoveSowingDialog
        visible={!!moving}
        sowing={moving}
        stationId={stationId}
        onDismiss={() => setMoving(null)}
        onDone={() => {
          setMoving(null);
          // The sowing now belongs to another tab, so it drops off this list.
          load();
        }}
      />

      <Portal>
        <Dialog visible={!!pendingDelete} onDismiss={() => setPendingDelete(null)}>
          <Dialog.Title>Delete sowing</Dialog.Title>
          <Dialog.Content>
            <Text>
              Remove this sowing and its grid? The seeds it used are not returned to the pack.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPendingDelete(null)}>Cancel</Button>
            <Button onPress={handleDelete}>Delete</Button>
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
  lightRow: {
    paddingVertical: 0,
  },
  stationRow: {
    marginBottom: 8,
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
});
