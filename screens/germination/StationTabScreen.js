import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Dialog, FAB, List, Portal, Text } from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useUnits } from '../../contexts/UnitsContext';
import { formatTemperature, tempUnit } from '../../lib/units';
import {
  environmentLabel,
  fetchSowings,
  fetchStation,
  fetchStationLights,
} from '../../lib/germination';
import { lightTypeLabel } from '../../lib/growLights';
import SowingCard from '../../components/SowingCard';
import SowingFormDialog from './SowingFormDialog';
import CellDialog from './CellDialog';
import BatchGerminationDialog from './BatchGerminationDialog';
import TransplantDialog from './TransplantDialog';
import StationFormDialog from './StationFormDialog';

export default function StationTabScreen({ route }) {
  const { stationId } = route.params;
  const navigation = useNavigation();
  const { system } = useUnits();
  const [station, setStation] = useState(null);
  const [sowings, setSowings] = useState([]);
  const [lights, setLights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formVisible, setFormVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  // { sowing, cell } while a tapped cell is being marked.
  const [activeCell, setActiveCell] = useState(null);
  // The sowing whose cells are all being marked at once.
  const [batchSowing, setBatchSowing] = useState(null);
  // { sowing, cells } — one cell from the cell dialog, or a whole sowing.
  const [transplanting, setTransplanting] = useState(null);
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

  const transplantSowing = (sowing) => {
    const cells = sowing.grid.flat().filter((cell) => cell && cell.germinated > 0);
    if (cells.length) setTransplanting({ sowing, cells });
  };

  const lightsSummary = lights
    .map((row) => `${row.quantity} x ${row.light?.name ?? lightTypeLabel(row.light?.type)}`)
    .join(' · ');

  // Only the conditions that were actually filled in, so a windowsill with no
  // thermostat doesn't read as a row of blanks.
  const stationSummary = [
    station ? environmentLabel(station.environment) : null,
    station?.temp_c !== null && station?.temp_c !== undefined
      ? `${formatTemperature(station.temp_c, system)} ${tempUnit(system)}`
      : null,
    station?.humidity_pct !== null && station?.humidity_pct !== undefined
      ? `${station.humidity_pct}% RH`
      : null,
    lights.length ? lightsSummary : 'No lights',
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
          <List.Item
            title={station?.name ?? 'Station'}
            description={stationSummary}
            left={(props) => <List.Icon {...props} icon="thermometer" />}
            right={(props) => <List.Icon {...props} icon="pencil-outline" />}
            onPress={() => setEditVisible(true)}
            style={styles.stationRow}
          />
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
            onTransplant={() => transplantSowing(item)}
            onDelete={() => setPendingDelete(item)}
          />
        )}
      />

      <FAB icon="plus" style={styles.fab} onPress={() => setFormVisible(true)} />

      <SowingFormDialog
        visible={formVisible}
        stationId={stationId}
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
  stationRow: {
    marginBottom: 8,
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
