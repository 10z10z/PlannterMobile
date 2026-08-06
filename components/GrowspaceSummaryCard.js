import { StyleSheet, View } from 'react-native';
import { Card, Icon, Text, useTheme } from 'react-native-paper';
import { useUnits } from '../contexts/UnitsContext';
import { useWeather } from '../contexts/WeatherContext';
import { formatTemperature } from '../lib/units';
import { environmentLabel, sunHoursLabel } from '../lib/growspaces';
import { conditionsFor } from '../lib/weather';

/**
 * One growspace at a glance: what is in it, and what it is being held at.
 *
 * An outdoor space reads its temperature and humidity off the weather where it
 * stands and an indoor one off what was recorded for it — the same rule the
 * growspace screen follows, so the dashboard never disagrees with the screen it
 * is summarising. A live figure is marked as live rather than quietly mixed in
 * with the stored ones.
 */
export default function GrowspaceSummaryCard({ growspace, onPress }) {
  const theme = useTheme();
  const { system } = useUnits();
  const { reading } = useWeather();

  const { tempC, humidityPct, liveTemp, liveHumidity } = conditionsFor(growspace, reading);
  const outdoor = growspace.environment === 'outdoor';

  // Only what this space actually knows about itself: a tent with no lights
  // assigned says nothing about a photoperiod rather than claiming none.
  const figures = [
    tempC !== null && tempC !== undefined
      ? {
          icon: 'thermometer',
          text: formatTemperature(tempC, system, { withUnit: true }),
          live: liveTemp,
        }
      : null,
    humidityPct !== null && humidityPct !== undefined
      ? { icon: 'water-percent', text: `${Math.round(humidityPct)}%`, live: liveHumidity }
      : null,
    growspace.photoperiod ? { icon: 'lightbulb-on-outline', text: growspace.photoperiod } : null,
    outdoor ? { icon: 'weather-sunny', text: sunHoursLabel(growspace.sun_hours) } : null,
  ].filter((figure) => figure && figure.text);

  return (
    <Card style={styles.card} onPress={onPress}>
      <Card.Content>
        <View style={styles.head}>
          <Text variant="titleMedium" numberOfLines={1} style={styles.name}>
            {growspace.name}
          </Text>
          <View style={styles.environment}>
            <Icon
              source={outdoor ? 'weather-partly-cloudy' : 'home-outline'}
              size={14}
              color={theme.colors.onSurfaceVariant}
            />
            <Text variant="labelSmall" style={styles.environmentText}>
              {environmentLabel(growspace.environment)}
            </Text>
          </View>
        </View>

        <Text variant="bodySmall" style={styles.counts}>
          {growspace.plantCount === 1 ? '1 plant' : `${growspace.plantCount} plants`}
          {growspace.spots > 0 ? ` · ${growspace.spots} spots` : ''}
        </Text>

        {figures.length > 0 && (
          <View style={styles.figures}>
            {figures.map((figure) => (
              <View key={figure.icon} style={styles.figure}>
                <Icon
                  source={figure.icon}
                  size={15}
                  color={figure.live ? theme.colors.primary : theme.colors.onSurfaceVariant}
                />
                <Text
                  variant="bodySmall"
                  style={figure.live ? { color: theme.colors.primary } : styles.figureText}
                >
                  {figure.text}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 8,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    flex: 1,
  },
  environment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  environmentText: {
    opacity: 0.7,
  },
  counts: {
    opacity: 0.7,
    marginTop: 2,
  },
  figures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  figure: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  figureText: {
    opacity: 0.85,
  },
});
