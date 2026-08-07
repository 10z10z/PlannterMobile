import { Image, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useThemePreference } from '../../contexts/ThemeContext';
import { useUnits } from '../../contexts/UnitsContext';
import { containerSize } from '../../lib/containers';
import { daysSinceGermination, plantPhase, wateringColors, wateringStatus } from '../../lib/plants';

/**
 * The face of a plant on the grid: its photo where it has one, its name, the
 * phase it's in, and a dot when it wants watering.
 *
 * The photo is a backdrop rather than the whole tile — a grid of pictures with
 * no names is pretty and unusable, so the name always sits on top of a scrim.
 *
 * The same face goes inside both kinds of tile, the draggable one and the
 * button, so that turning Rearrange on changes how a plant is operated and not
 * what it looks like.
 */
export default function PlantFace({ plant, size }) {
  const theme = useTheme();
  const { isDark } = useThemePreference();
  const { system } = useUnits();
  const flag = wateringColors(wateringStatus(plant), isDark);
  const phase = plantPhase(plant);
  const pot = containerSize(plant.container, system);
  const age = daysSinceGermination(plant);

  // Age first, then pot, then phase — as much as the tile can hold without
  // clipping. A small cell shows the age alone rather than nothing at all,
  // which is what hiding the whole line used to do.
  const parts = [age !== null ? `${age}d` : null, pot, phase?.label].filter(Boolean);
  const room = size >= 88 ? 3 : size >= 64 ? 2 : 1;
  const detail = parts.slice(0, room).join(' · ');

  return (
    <View
      style={[
        styles.face,
        { backgroundColor: theme.colors.secondaryContainer, borderColor: theme.colors.outline },
      ]}
    >
      {!!plant.image_url && <Image source={{ uri: plant.image_url }} style={styles.faceImage} />}
      {!!flag && <View style={[styles.flag, { backgroundColor: flag }]} />}
      <Text
        variant={size > 64 ? 'labelMedium' : 'labelSmall'}
        numberOfLines={size >= 64 ? 2 : 1}
        style={[styles.faceText, { color: theme.colors.onSecondaryContainer }]}
      >
        {plant.name}
      </Text>
      {!!detail && (
        <Text
          variant="labelSmall"
          numberOfLines={1}
          style={[styles.facePhase, { color: theme.colors.onSecondaryContainer }]}
        >
          {detail}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  face: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  faceImage: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 7,
    opacity: 0.4,
  },
  faceText: {
    textAlign: 'center',
  },
  facePhase: {
    textAlign: 'center',
    opacity: 0.75,
  },
  flag: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
