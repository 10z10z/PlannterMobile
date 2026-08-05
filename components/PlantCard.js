import { Avatar, Card, Text } from 'react-native-paper';
import { daysSinceTransplant, plantSummary, wateringLabel } from '../lib/plants';
import { speciesIcon } from '../lib/species';
import { containerLabel } from '../lib/containers';
import { useUnits } from '../contexts/UnitsContext';

export default function PlantCard({ plant, onPress }) {
  const { system } = useUnits();
  const dueText = wateringLabel(plant);
  const sinceTransplant = daysSinceTransplant(plant);
  // The pot joins the crop and phase, since how big a plant's container is says
  // as much about where it is in its life as the phase does.
  const summary = [plantSummary(plant), containerLabel(plant.container, system)]
    .filter(Boolean)
    .join(' · ');

  return (
    <Card style={{ marginHorizontal: 16, marginBottom: 12 }} onPress={onPress}>
      <Card.Title
        title={plant.name}
        subtitle={summary || plant.species || undefined}
        subtitleNumberOfLines={2}
        left={(props) =>
          plant.image_url ? (
            <Avatar.Image {...props} source={{ uri: plant.image_url }} />
          ) : (
            <Avatar.Icon {...props} icon={speciesIcon(plant.plant_type)} />
          )
        }
      />
      <Card.Content>
        <Text variant="bodyMedium">{dueText}</Text>
        {sinceTransplant !== null && (
          <Text variant="bodySmall">
            {sinceTransplant === 0
              ? 'Planted here today'
              : `${sinceTransplant}d in this growspace`}
          </Text>
        )}
        {plant.seedling_count > 1 && (
          <Text variant="bodySmall">{plant.seedling_count} seedlings in one container</Text>
        )}
      </Card.Content>
    </Card>
  );
}
