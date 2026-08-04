import { Avatar, Card, Text } from 'react-native-paper';

function daysUntilDue(lastWateredAt, intervalDays) {
  const due = new Date(lastWateredAt);
  due.setDate(due.getDate() + intervalDays);
  const diffMs = due.getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export default function PlantCard({ plant, onPress }) {
  const daysLeft = daysUntilDue(plant.last_watered_at, plant.watering_interval_days);
  const dueText =
    daysLeft < 0
      ? `Overdue by ${Math.abs(daysLeft)}d`
      : daysLeft === 0
        ? 'Water today'
        : `Water in ${daysLeft}d`;

  return (
    <Card style={{ marginHorizontal: 16, marginBottom: 12 }} onPress={onPress}>
      <Card.Title
        title={plant.name}
        subtitle={plant.species || undefined}
        left={(props) => <Avatar.Icon {...props} icon="leaf" />}
      />
      <Card.Content>
        <Text variant="bodyMedium">{dueText}</Text>
      </Card.Content>
    </Card>
  );
}
