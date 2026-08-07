import { StyleSheet } from 'react-native';
import { Avatar, Card, IconButton, ProgressBar, Text, useTheme } from 'react-native-paper';
import { useUnits } from '../contexts/UnitsContext';
import { formatVolume } from '../lib/units';
import { materialLabel } from '../lib/containers';

/**
 * `inUse` is derived from how many plants point at this container group, so the
 * free count reflects what's actually planted rather than a manually kept number.
 */
export default function ContainerCard({ container, inUse, onPress, onDelete }) {
  const { system } = useUnits();
  const theme = useTheme();
  const volume = formatVolume(container.volume_liters, system);
  const free = Math.max(container.quantity - inUse, 0);

  return (
    <Card style={styles.card} onPress={onPress}>
      <Card.Title
        title={`${volume} ${materialLabel(container.material)}`}
        subtitle={`${inUse}/${container.quantity} in use · ${free} free`}
        left={(props) =>
          container.image_url ? (
            <Avatar.Image {...props} source={{ uri: container.image_url }} />
          ) : (
            <Avatar.Icon {...props} icon="cup-outline" />
          )
        }
        right={(props) => (
          <IconButton
            {...props}
            icon="delete-outline"
            // Containers have no name of their own, so the label is built from
            // the same two figures the title is: "Delete 0.5 L plastic".
            accessibilityLabel={`Delete ${volume} ${materialLabel(container.material)}`}
            onPress={onDelete}
          />
        )}
      />
      <Card.Content>
        <ProgressBar progress={container.quantity ? inUse / container.quantity : 0} />
        {inUse > container.quantity && (
          <Text variant="bodySmall" style={[styles.warning, { color: theme.colors.error }]}>
            {inUse - container.quantity} more plants assigned than containers owned
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
  warning: {
    marginTop: 8,
  },
});
