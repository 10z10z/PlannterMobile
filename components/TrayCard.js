import { StyleSheet } from 'react-native';
import { Avatar, Card, IconButton, ProgressBar, Text } from 'react-native-paper';
import { trayGridLabel } from '../lib/trays';

/**
 * `inUse` is how many of the group currently hold a sowing, derived the same way
 * container usage is derived from plants.
 */
export default function TrayCard({ tray, inUse, onPress, onDelete }) {
  const free = Math.max(tray.quantity - inUse, 0);

  return (
    <Card style={styles.card} onPress={onPress}>
      <Card.Title
        title={tray.name}
        subtitle={`${trayGridLabel(tray)} · ${inUse}/${tray.quantity} in use · ${free} free`}
        left={(props) =>
          tray.image_url ? (
            <Avatar.Image {...props} source={{ uri: tray.image_url }} />
          ) : (
            <Avatar.Icon {...props} icon="grid" />
          )
        }
        right={(props) => (
          <IconButton
            {...props}
            icon="delete-outline"
            accessibilityLabel={`Delete ${tray.name}`}
            onPress={onDelete}
          />
        )}
      />
      <Card.Content>
        <ProgressBar progress={tray.quantity ? inUse / tray.quantity : 0} />
        {!!tray.cell_volume_ml && (
          <Text variant="bodySmall" style={styles.detail}>
            {tray.cell_volume_ml} ml per cell
          </Text>
        )}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  detail: {
    marginTop: 8,
  },
});
