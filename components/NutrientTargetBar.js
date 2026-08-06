import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { STATUS_LABELS } from '../lib/nutrients';

/**
 * One nutrient's delivered ppm drawn against its recommended band: a
 * translucent zone marks where the value should land, the solid fill is where
 * it actually landed.
 *
 * `compact` drops the status caption and thins the track, so the nine micros
 * can be listed without burying the three macros that matter most.
 *
 * `colors` maps a fertilizer id to its colour in the mix. Given one, the fill
 * is drawn as stacked per-product segments instead of a single block, so the
 * bar reads as "who contributed what" as well as "how much".
 *
 * @param {object} props
 * @param {import('../lib/nutrients').NutrientBar} props.bar
 * @param {boolean} [props.compact] Thins the track and drops the status caption.
 * @param {Record<string, string>} [props.colors] Fertilizer id to mix colour.
 */
export default function NutrientTargetBar({ bar, compact, colors }) {
  const theme = useTheme();
  const offTarget = bar.status !== 'on';

  return (
    <View style={compact ? styles.compactContainer : styles.container}>
      <View style={styles.header}>
        <Text variant={compact ? 'bodySmall' : 'bodyMedium'}>{bar.label}</Text>
        <Text variant="bodySmall" style={styles.range}>
          {bar.value} ppm · target {bar.min}–{bar.max} ppm
        </Text>
      </View>

      <View
        style={[
          styles.track,
          compact && styles.compactTrack,
          { backgroundColor: theme.colors.surfaceVariant },
        ]}
      >
        <View
          style={[
            styles.zone,
            {
              left: `${bar.zoneLeftPct}%`,
              width: `${bar.zoneWidthPct}%`,
              backgroundColor: theme.colors.primaryContainer,
            },
          ]}
        />
        {colors && bar.segments?.length ? (
          <View style={styles.segments}>
            {bar.segments.map((segment) => (
              <View
                key={segment.id}
                style={[
                  styles.segment,
                  {
                    width: `${segment.widthPct}%`,
                    backgroundColor: colors[segment.id] ?? theme.colors.primary,
                  },
                ]}
              />
            ))}
          </View>
        ) : (
          <View
            style={[
              styles.fill,
              {
                width: `${bar.fillPct}%`,
                backgroundColor: offTarget ? theme.colors.tertiary : theme.colors.primary,
              },
            ]}
          />
        )}

        {/*
          The band's edges are drawn last, on top of whatever fill reached them.
          The translucent zone underneath disappears the moment the mix covers
          it, which is precisely when knowing where the target sat matters most.
        */}
        <View
          style={[
            styles.edge,
            { left: `${bar.zoneLeftPct}%`, backgroundColor: theme.colors.onSurface },
          ]}
        />
        <View
          style={[
            styles.edge,
            {
              left: `${bar.zoneLeftPct + bar.zoneWidthPct}%`,
              backgroundColor: theme.colors.onSurface,
            },
          ]}
        />
      </View>

      {!compact && (
        <Text variant="bodySmall" style={styles.status}>
          {STATUS_LABELS[bar.status]}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 14,
  },
  compactContainer: {
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 4,
    gap: 8,
  },
  range: {
    opacity: 0.6,
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  compactTrack: {
    height: 5,
    borderRadius: 3,
  },
  zone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  fill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: 4,
  },
  edge: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    // Straddles the boundary rather than sitting to the right of it.
    marginLeft: -1,
    opacity: 0.55,
  },
  segments: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  segment: {
    height: '100%',
    // Without this a mix that overshoots the bar's scale would be squeezed to
    // fit rather than running off the end and being clipped by the track.
    flexShrink: 0,
  },
  status: {
    marginTop: 3,
    opacity: 0.6,
  },
});
