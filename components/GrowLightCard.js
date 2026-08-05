import { StyleSheet } from 'react-native';
import { Avatar, Card, IconButton, ProgressBar, Text, useTheme } from 'react-native-paper';
import { useUnits } from '../contexts/UnitsContext';
import { formatLength, lengthUnit } from '../lib/units';
import { hasColorTemp, lightTypeLabel, spectrumLabel } from '../lib/growLights';

/**
 * `inUse` is summed from the growspace and germination-station assignments, so
 * the free count reflects what is actually hanging rather than a number kept by
 * hand.
 */
export default function GrowLightCard({ light, inUse, onPress, onDelete }) {
  const { system } = useUnits();
  const theme = useTheme();
  const free = Math.max(light.quantity - inUse, 0);

  // Only the specs this fixture actually has, so a floodlight entry doesn't
  // read as a wall of blanks next to a spec-sheet LED.
  const specs = [
    lightTypeLabel(light.type),
    light.watts ? `${light.watts} W` : null,
    hasColorTemp(light.type) && light.color_temp_k ? `${light.color_temp_k} K` : null,
    spectrumLabel(light.spectrum),
    light.ppf_umol_s ? `${light.ppf_umol_s} µmol/s` : null,
    light.efficacy_umol_j ? `${light.efficacy_umol_j} µmol/J` : null,
    light.beam_angle_deg ? `${light.beam_angle_deg}° beam` : null,
    light.ip_rating || null,
    light.dimmable ? 'Dimmable' : null,
  ].filter(Boolean);

  const coverage =
    light.coverage_width_cm && light.coverage_depth_cm
      ? `Covers ${formatLength(light.coverage_width_cm, system)} × ${formatLength(
          light.coverage_depth_cm,
          system
        )} ${lengthUnit(system)}`
      : null;

  const ppfd = light.ppfd_umol_m2_s
    ? `${light.ppfd_umol_m2_s} µmol/m²/s${
        light.ppfd_distance_cm
          ? ` at ${formatLength(light.ppfd_distance_cm, system, { withUnit: true })}`
          : ''
      }`
    : null;

  return (
    <Card style={styles.card} onPress={onPress}>
      <Card.Title
        title={light.name}
        subtitle={`${inUse}/${light.quantity} in use · ${free} free`}
        left={(props) =>
          light.image_url ? (
            <Avatar.Image {...props} source={{ uri: light.image_url }} />
          ) : (
            <Avatar.Icon {...props} icon="lightbulb-on-outline" />
          )
        }
        right={(props) => <IconButton {...props} icon="delete-outline" onPress={onDelete} />}
      />
      <Card.Content>
        <ProgressBar progress={light.quantity ? inUse / light.quantity : 0} />
        <Text variant="bodySmall" style={styles.specs}>
          {specs.join(' · ')}
        </Text>
        {!!ppfd && (
          <Text variant="bodySmall" style={styles.specs}>
            {ppfd}
          </Text>
        )}
        {!!coverage && (
          <Text variant="bodySmall" style={styles.specs}>
            {coverage}
          </Text>
        )}
        {inUse > light.quantity && (
          <Text variant="bodySmall" style={[styles.warning, { color: theme.colors.error }]}>
            {inUse - light.quantity} more assigned than owned
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
  specs: {
    marginTop: 8,
    opacity: 0.7,
  },
  warning: {
    marginTop: 8,
  },
});
