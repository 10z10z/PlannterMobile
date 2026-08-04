import { StyleSheet } from 'react-native';
import { Avatar, Card, Chip, IconButton, Text, useTheme } from 'react-native-paper';
import { useUnits } from '../contexts/UnitsContext';
import { formatVolume } from '../lib/units';

function phLabel({ ph_min: min, ph_max: max }) {
  if (min !== null && max !== null) return min === max ? `pH ${min}` : `pH ${min} - ${max}`;
  if (min !== null) return `pH ${min}+`;
  if (max !== null) return `pH up to ${max}`;
  return null;
}

export default function MediumCard({ medium, onPress, onDelete }) {
  const { system } = useUnits();
  const theme = useTheme();
  const volume = formatVolume(medium.volume_liters, system);
  const ph = phLabel(medium);

  const quantityLabel = volume
    ? `${medium.quantity} x ${volume}`
    : `${medium.quantity} in stock`;

  return (
    <Card
      style={[
        styles.card,
        medium.low_stock && { backgroundColor: theme.colors.errorContainer },
      ]}
      onPress={onPress}
    >
      <Card.Title
        title={medium.name}
        subtitle={quantityLabel}
        left={(props) =>
          medium.image_url ? (
            <Avatar.Image {...props} source={{ uri: medium.image_url }} />
          ) : (
            <Avatar.Icon {...props} icon="grain" />
          )
        }
        right={(props) => <IconButton {...props} icon="delete-outline" onPress={onDelete} />}
      />
      <Card.Content>
        {medium.low_stock && (
          <Chip compact icon="alert-outline" style={styles.chip}>
            Running low
          </Chip>
        )}
        {!!ph && <Text variant="bodySmall">{ph}</Text>}
        {medium.ec != null && <Text variant="bodySmall">EC {medium.ec} mS/cm</Text>}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  chip: {
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
});
