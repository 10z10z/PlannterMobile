import { StyleSheet } from 'react-native';
import { Avatar, Card, IconButton, Text } from 'react-native-paper';
import { formatDateString } from './DateField';

function germinationLabel({ germination_days_min: min, germination_days_max: max }) {
  if (min && max) return min === max ? `Germinates in ${min}d` : `Germinates in ${min}-${max}d`;
  if (min) return `Germinates in ${min}d+`;
  if (max) return `Germinates in up to ${max}d`;
  return null;
}

export default function SeedPackCard({ seedPack, onPress, onDelete }) {
  const germination = germinationLabel(seedPack);

  return (
    <Card style={styles.card} onPress={onPress}>
      <Card.Title
        title={seedPack.name}
        subtitle={seedPack.plant_type || undefined}
        left={(props) =>
          seedPack.image_url ? (
            <Avatar.Image {...props} source={{ uri: seedPack.image_url }} />
          ) : (
            <Avatar.Icon {...props} icon="seed-outline" />
          )
        }
        right={(props) => <IconButton {...props} icon="delete-outline" onPress={onDelete} />}
      />
      <Card.Content>
        {!!germination && <Text variant="bodySmall">{germination}</Text>}
        {!!seedPack.seed_count && <Text variant="bodySmall">{seedPack.seed_count} seeds</Text>}
        {!!seedPack.packaged_on && (
          <Text variant="bodySmall">Packaged {formatDateString(seedPack.packaged_on)}</Text>
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
});
