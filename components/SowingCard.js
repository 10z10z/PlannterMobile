import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Avatar, Button, Card, Divider, IconButton, Menu, Text } from 'react-native-paper';
import { useUnits } from '../contexts/UnitsContext';
import { formatVolume } from '../lib/units';
import { materialLabel } from '../lib/containers';
import {
  daysSince,
  germinatedCells,
  selectedCells,
  selectionSummary,
  sowingGerminatedOn,
  thinnableCells,
  toggleCellSelection,
} from '../lib/germination';
import { phaseFor, speciesIcon, speciesLabel } from '../lib/species';
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
  // Folded away to get a station full of trays down to a readable list. A view
  // preference rather than saved state — it starts open again on the next visit.
  const [folded, setFolded] = useState(false);
  // Cell ids picked for a partial transplant; empty means normal mode.
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);

  const cells = sowing.grid.flat().filter(Boolean);
  const germinated = cells.reduce((sum, cell) => sum + cell.germinated, 0);
  const planted = cells.reduce((sum, cell) => sum + cell.seeds_planted, 0);
  const days = daysSince(sowing.sown_on);

  const plantType = sowing.seed_pack?.plant_type;
  const packImage = sowing.seed_pack?.image_url;
  // Counted from the first cell to come up rather than from sowing, so it lines
  // up with the age a plant carries once it's transplanted out.
  const sinceGerminated = daysSince(sowingGerminatedOn(sowing.grid));
  const phase = phaseFor(plantType, sinceGerminated);

  // What it is, where it's got to, and how long each stretch has taken —
  // whichever of those is actually known.
  const subtitle = [
    speciesLabel(plantType),
    targetLabel(sowing, system),
    `sown ${days}d ago`,
    sinceGerminated !== null ? `up ${sinceGerminated}d` : null,
    phase?.label,
  ]
    .filter(Boolean)
    .join(' · ');

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
        subtitle={subtitle}
        subtitleNumberOfLines={2}
        left={(props) =>
          packImage ? (
            <Avatar.Image {...props} source={{ uri: packImage }} />
          ) : (
            <Avatar.Icon {...props} icon={plantType ? speciesIcon(plantType) : 'seed-outline'} />
          )
        }
        right={(props) => (
          <View style={styles.titleActions}>
            <IconButton
              {...props}
              icon={folded ? 'chevron-right' : 'chevron-down'}
              onPress={() => {
                // Folding a card away while cells are picked would hide a
                // selection that the actions still act on.
                if (!folded) exitSelection();
                setFolded((current) => !current);
              }}
            />
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
          </View>
        )}
      />
      <Card.Content>
        {!folded && (
          <SowingGrid
            grid={sowing.grid}
            onCellPress={onCellPress}
            onHold={onHold}
            onCellLongPress={handleCellLongPress}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            imageUrl={packImage}
          />
        )}
        <Text variant="bodySmall" style={styles.summary}>
          {selectionMode
            ? `${selectionSummary(picked)} selected`
            : planted === 0
              ? 'All seedlings transplanted'
              : folded
                ? `${germinated}/${planted} germinated`
                : `${germinated}/${planted} germinated · tap a cell to mark it, hold one to select`}
        </Text>
      </Card.Content>
      {/*
        Card.Actions clones each child to inject its own props, so these have to
        be Buttons directly — wrapping them in a fragment hands those props to
        the fragment instead.
      */}
      {/* Folded down to a title and a count — the actions come back with the
          grid, since transplanting is a thing you do while looking at it. */}
      <Card.Actions style={folded ? styles.hidden : undefined}>
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
  titleActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summary: {
    marginTop: 8,
    opacity: 0.7,
  },
  hidden: {
    display: 'none',
  },
});
