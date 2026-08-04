import { StyleSheet, View } from 'react-native';
import { Avatar, Card, Chip, IconButton, Text } from 'react-native-paper';
import { useUnits } from '../contexts/UnitsContext';
import { formatDoseRange } from '../lib/units';

function npkLabel({ n, p, k }) {
  if (n === null && p === null && k === null) return null;
  return `NPK ${n ?? 0}-${p ?? 0}-${k ?? 0}`;
}

export default function FertilizerCard({ fertilizer, onPress, onDelete }) {
  const { system } = useUnits();
  const npk = npkLabel(fertilizer);
  const foliar = formatDoseRange(
    fertilizer.foliar_dose_min,
    fertilizer.foliar_dose_max,
    system,
    fertilizer.form
  );
  const fertigation = formatDoseRange(
    fertilizer.fertigation_dose_min,
    fertilizer.fertigation_dose_max,
    system,
    fertilizer.form
  );

  return (
    <Card style={styles.card} onPress={onPress}>
      <Card.Title
        title={fertilizer.name}
        subtitle={npk || undefined}
        left={(props) =>
          fertilizer.image_url ? (
            <Avatar.Image {...props} source={{ uri: fertilizer.image_url }} />
          ) : (
            <Avatar.Icon {...props} icon="bottle-tonic-outline" />
          )
        }
        right={(props) => <IconButton {...props} icon="delete-outline" onPress={onDelete} />}
      />
      <Card.Content>
        <View style={styles.chips}>
          <Chip compact style={styles.chip}>
            {fertilizer.origin === 'organic' ? 'Organic' : 'Synthetic'}
          </Chip>
          <Chip compact style={styles.chip}>
            {fertilizer.form === 'solid' ? 'Crystal' : 'Liquid'}
          </Chip>
        </View>
        {!!foliar && <Text variant="bodySmall">Foliar: {foliar}</Text>}
        {!!fertigation && <Text variant="bodySmall">Fertigation: {fertigation}</Text>}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  chips: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    alignSelf: 'flex-start',
  },
});
