import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText, IconButton, Menu, Text } from 'react-native-paper';
import { fetchGrowLightsWithUsage, lightTypeLabel } from '../lib/growLights';

/**
 * Picks fixtures out of the inventory and says how many of each hang here.
 *
 * `value` is a list of `{ grow_light_id, quantity }`. `baseline` is what this
 * place already has saved: those are added back when working out how many are
 * free, since a station's own lights are counted as in use by the inventory and
 * would otherwise look unavailable to itself.
 */
export default function LightAssignmentField({ value, onChange, baseline = [] }) {
  const [lights, setLights] = useState([]);
  const [menuVisible, setMenuVisible] = useState(false);

  useEffect(() => {
    fetchGrowLightsWithUsage()
      .then(setLights)
      .catch(() => setLights([]));
  }, []);

  const freeCount = (light) => {
    const here = baseline.find((entry) => entry.grow_light_id === light.id)?.quantity ?? 0;
    return light.quantity - light.inUse + here;
  };

  const unassigned = lights.filter(
    (light) => !value.some((entry) => entry.grow_light_id === light.id)
  );

  const add = (light) => {
    onChange([...value, { grow_light_id: light.id, quantity: 1 }]);
    setMenuVisible(false);
  };

  const setQuantity = (id, quantity) => {
    onChange(
      value.map((entry) => (entry.grow_light_id === id ? { ...entry, quantity } : entry))
    );
  };

  const remove = (id) => {
    onChange(value.filter((entry) => entry.grow_light_id !== id));
  };

  return (
    <View style={styles.wrapper}>
      <Text variant="labelLarge" style={styles.label}>
        Lights
      </Text>

      {value.map((entry) => {
        const light = lights.find((candidate) => candidate.id === entry.grow_light_id);
        const free = light ? freeCount(light) : 0;
        return (
          <View key={entry.grow_light_id} style={styles.row}>
            <View style={styles.rowText}>
              <Text variant="bodyMedium">{light?.name ?? 'Light'}</Text>
              <Text variant="bodySmall" style={styles.subtitle}>
                {light ? `${lightTypeLabel(light.type)} · ${free} free` : ''}
              </Text>
            </View>
            <IconButton
              icon="minus"
              disabled={entry.quantity <= 1}
              onPress={() => setQuantity(entry.grow_light_id, entry.quantity - 1)}
            />
            <Text variant="titleMedium">{entry.quantity}</Text>
            <IconButton
              icon="plus"
              onPress={() => setQuantity(entry.grow_light_id, entry.quantity + 1)}
            />
            <IconButton icon="close" onPress={() => remove(entry.grow_light_id)} />
          </View>
        );
      })}

      {value.some((entry) => {
        const light = lights.find((candidate) => candidate.id === entry.grow_light_id);
        return light && entry.quantity > freeCount(light);
      }) && (
        <HelperText type="error" visible>
          More lights assigned than you own — the inventory will show the shortfall.
        </HelperText>
      )}

      <Menu
        visible={menuVisible}
        onDismiss={() => setMenuVisible(false)}
        anchor={
          <Button
            mode="outlined"
            icon="lightbulb-on-outline"
            onPress={() => setMenuVisible(true)}
            style={styles.addButton}
          >
            Add a light
          </Button>
        }
      >
        {unassigned.map((light) => (
          <Menu.Item
            key={light.id}
            title={`${light.name} · ${freeCount(light)} free`}
            onPress={() => add(light)}
          />
        ))}
        {unassigned.length === 0 && (
          <Menu.Item
            title={lights.length ? 'All lights already added' : 'No grow lights in inventory'}
            disabled
          />
        )}
      </Menu>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 8,
  },
  label: {
    marginTop: 8,
    marginBottom: 4,
    opacity: 0.7,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowText: {
    flex: 1,
  },
  subtitle: {
    opacity: 0.7,
  },
  addButton: {
    marginTop: 4,
  },
});
