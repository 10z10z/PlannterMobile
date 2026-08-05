import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Avatar, Button, Card, Divider, IconButton, Menu, Text } from 'react-native-paper';
import { useUnits } from '../contexts/UnitsContext';
import { formatVolume } from '../lib/units';
import { materialLabel } from '../lib/containers';
import {
  daysSince,
  germinatedCells,
  selectedCells,
  selectionSummary,
  thinnableCells,
  toggleCellSelection,
} from '../lib/germination';
import SowingGrid from './SowingGrid';

/** "Speedy Tray" for a tray sowing, "11 L Fabric" for a single container. */
function targetLabel(sowing, system) {
  if (sowing.tray_id) return sowing.tray?.name ?? 'Tray';
  if (sowing.container) {
    return `${formatVolume(sowing.container.volume_liters, system)} ${materialLabel(
      sowing.container.material
    )}`;
  }
  return 'Container';
}

export default function SowingCard({
  sowing,
  onCellPress,
  onHold,
  onTransplant,
  onThin,
  onDuplicate,
  onMove,
  onDelete,
}) {
  const { system } = useUnits();
  const [menuVisible, setMenuVisible] = useState(false);
  // Cell ids picked for a partial transplant; empty means normal mode.
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);

  const cells = sowing.grid.flat().filter(Boolean);
  const germinated = cells.reduce((sum, cell) => sum + cell.germinated, 0);
  const planted = cells.reduce((sum, cell) => sum + cell.seeds_planted, 0);
  const days = daysSince(sowing.sown_on);

  const ready = germinatedCells(sowing.grid);
  const picked = selectedCells(sowing.grid, selectedIds);

  // A reload rebuilds the cells, so a selection that outlived its rows would
  // point at nothing. Leaving selection mode when the sowing changes keeps the
  // toolbar honest about what it is holding.
  useEffect(() => {
    setSelectionMode(false);
    setSelectedIds([]);
  }, [sowing.id, planted, germinated]);

  // Every menu action opens a dialog of its own, so the menu has to be out of
  // the way before one appears over it.
  const runAction = (action) => {
    setMenuVisible(false);
    action?.();
  };

  const handleCellLongPress = (cell) => {
    setSelectionMode(true);
    setSelectedIds((current) => toggleCellSelection(current, cell.id));
  };

  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedIds([]);
  };

  const allSelected = picked.length === ready.length && ready.length > 0;

  return (
    <Card style={styles.card} onLongPress={onHold} delayLongPress={1000}>
      <Card.Title
        title={sowing.seed_pack_name}
        subtitle={`${targetLabel(sowing, system)} · sown ${days}d ago`}
        left={(props) => (
          <Avatar.Icon {...props} icon={sowing.tray_id ? 'grid' : 'cup-outline'} />
        )}
        right={(props) => (
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <IconButton
                {...props}
                icon="dots-vertical"
                onPress={() => setMenuVisible(true)}
              />
            }
          >
            <Menu.Item
              leadingIcon="check-all"
              title="Mark all germinated"
              onPress={() => runAction(onHold)}
            />
            <Menu.Item
              leadingIcon="content-cut"
              title="Thin to one per cell"
              disabled={thinnableCells(sowing.grid).length === 0}
              onPress={() => runAction(onThin)}
            />
            <Menu.Item
              leadingIcon="content-copy"
              title="Sow this again"
              onPress={() => runAction(onDuplicate)}
            />
            <Menu.Item
              leadingIcon="tray-arrow-up"
              title="Move to another station"
              onPress={() => runAction(onMove)}
            />
            <Divider />
            <Menu.Item
              leadingIcon="delete-outline"
              title="Delete sowing"
              onPress={() => runAction(onDelete)}
            />
          </Menu>
        )}
      />
      <Card.Content>
        <SowingGrid
          grid={sowing.grid}
          onCellPress={onCellPress}
          onHold={onHold}
          onCellLongPress={handleCellLongPress}
          selectionMode={selectionMode}
          selectedIds={selectedIds}
        />
        <Text variant="bodySmall" style={styles.summary}>
          {selectionMode
            ? `${selectionSummary(picked)} selected`
            : planted === 0
              ? 'All seedlings transplanted'
              : `${germinated}/${planted} germinated · tap a cell to mark it, hold one to select`}
        </Text>
      </Card.Content>
      {/*
        Card.Actions clones each child to inject its own props, so these have to
        be Buttons directly — wrapping them in a fragment hands those props to
        the fragment instead.
      */}
      <Card.Actions>
        {selectionMode && (
          <Button mode="text" onPress={exitSelection}>
            Cancel
          </Button>
        )}
        {selectionMode && (
          <Button
            mode="text"
            onPress={() =>
              allSelected ? setSelectedIds([]) : setSelectedIds(ready.map((cell) => cell.id))
            }
          >
            {allSelected ? 'Clear' : 'All'}
          </Button>
        )}
        <Button
          icon="shovel"
          mode={selectionMode ? 'contained' : undefined}
          disabled={selectionMode ? picked.length === 0 : germinated === 0}
          onPress={() => onTransplant(selectionMode ? picked : ready)}
        >
          Transplant
        </Button>
      </Card.Actions>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  summary: {
    marginTop: 8,
    opacity: 0.7,
  },
});
