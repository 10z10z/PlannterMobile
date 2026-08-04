import { StyleSheet } from 'react-native';
import { Avatar, Button, Card, IconButton, Text } from 'react-native-paper';
import { useUnits } from '../contexts/UnitsContext';
import { formatVolume } from '../lib/units';
import { materialLabel } from '../lib/containers';
import { daysSince } from '../lib/germination';
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

export default function SowingCard({ sowing, onCellPress, onHold, onTransplant, onDelete }) {
  const { system } = useUnits();
  const cells = sowing.grid.flat().filter(Boolean);
  const germinated = cells.reduce((sum, cell) => sum + cell.germinated, 0);
  const planted = cells.reduce((sum, cell) => sum + cell.seeds_planted, 0);
  const days = daysSince(sowing.sown_on);

  return (
    <Card style={styles.card} onLongPress={onHold} delayLongPress={1000}>
      <Card.Title
        title={sowing.seed_pack_name}
        subtitle={`${targetLabel(sowing, system)} · sown ${days}d ago`}
        left={(props) => (
          <Avatar.Icon {...props} icon={sowing.tray_id ? 'grid' : 'cup-outline'} />
        )}
        right={(props) => <IconButton {...props} icon="delete-outline" onPress={onDelete} />}
      />
      <Card.Content>
        <SowingGrid grid={sowing.grid} onCellPress={onCellPress} onHold={onHold} />
        <Text variant="bodySmall" style={styles.summary}>
          {planted === 0
            ? 'All seedlings transplanted'
            : `${germinated}/${planted} germinated · tap a cell to mark it, hold the card for the lot`}
        </Text>
      </Card.Content>
      <Card.Actions>
        <Button icon="shovel" onPress={onTransplant} disabled={germinated === 0}>
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
