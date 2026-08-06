import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Dialog, FAB, List, Portal, Text } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useUnits } from '../../contexts/UnitsContext';
import { useWeather } from '../../contexts/WeatherContext';
import { formatTemperature, tempUnit } from '../../lib/units';
import { environmentLabel } from '../../lib/germination';
import { messageFor } from '../../lib/errors';
import ErrorText from '../../components/ErrorText';
import {
  useDeleteSowing,
  useStation,
  useStationLights,
  useStationSowings,
} from '../../hooks/useStations';
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
  const stationQuery = useStation(stationId);
  const sowingQuery = useStationSowings(stationId);
  const lightQuery = useStationLights(stationId);

  const station = stationQuery.data ?? null;
  const sowings = sowingQuery.data ?? [];
  const lights = lightQuery.data ?? [];
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

  const removeSowing = useDeleteSowing({ onSuccess: () => setPendingDelete(null) });

  /** Pulling down refreshes all three, since they are one screen. */
  const refreshAll = () => {
    stationQuery.refetch();
    sowingQuery.refetch();
    lightQuery.refetch();
  };

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

  return (
    <View style={styles.container}>
      <FlatList
        data={sowings}
        keyExtractor={(item) => item.id}
        refreshing={sowingQuery.isRefetching}
        onRefresh={refreshAll}
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
          !sowingQuery.isPending && (
            <Text style={styles.emptyText}>
              {sowingQuery.isError
                ? messageFor(sowingQuery.error, 'Couldn’t load what is sown here.')
                : 'Nothing sown here yet. Tap + to plant a seed pack into a tray or a container.'}
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
        }}
      />

      <CellDialog
        visible={!!activeCell}
        sowing={activeCell?.sowing}
        cell={activeCell?.cell}
        onDismiss={() => setActiveCell(null)}
        onSaved={() => {
          setActiveCell(null);
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
        }}
      />

      <TransplantDialog
        visible={!!transplanting}
        sowing={transplanting?.sowing}
        cells={transplanting?.cells}
        onDismiss={() => setTransplanting(null)}
        onDone={() => {
          setTransplanting(null);
        }}
      />

      <ThinDialog
        visible={!!thinning}
        sowing={thinning}
        onDismiss={() => setThinning(null)}
        onDone={() => {
          setThinning(null);
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
        }}
      />

      <Portal>
        <Dialog visible={!!pendingDelete} onDismiss={() => setPendingDelete(null)}>
          <Dialog.Title>Delete sowing</Dialog.Title>
          <Dialog.Content>
            <Text>
              Remove this sowing and its grid? The seeds it used are not returned to the pack.
            </Text>
            <ErrorText>{removeSowing.isError ? messageFor(removeSowing.error) : ''}</ErrorText>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => {
                removeSowing.reset();
                setPendingDelete(null);
              }}
              disabled={removeSowing.isPending}
            >
              Cancel
            </Button>
            <Button
              onPress={() => removeSowing.mutate({ sowing: pendingDelete, stationId })}
              loading={removeSowing.isPending}
              disabled={removeSowing.isPending}
            >
              Delete
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
