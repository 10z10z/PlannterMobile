import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Menu, Text } from 'react-native-paper';
import { useUnits } from '../contexts/UnitsContext';
import { formatVolume } from '../lib/units';
import { fetchContainersWithUsage, materialLabel } from '../lib/containers';

export default function ContainerPicker({ value, onChange }) {
  const { system } = useUnits();
  const [containers, setContainers] = useState([]);
  const [menuVisible, setMenuVisible] = useState(false);

  useEffect(() => {
    fetchContainersWithUsage()
      .then(setContainers)
      .catch(() => setContainers([]));
  }, []);

  const describe = (container) =>
    `${formatVolume(container.volume_liters, system)} ${materialLabel(container.material)}`;

  const selected = containers.find((container) => container.id === value);

  const select = (id) => {
    onChange(id);
    setMenuVisible(false);
  };

  return (
    <View style={styles.wrapper}>
      <Text variant="labelLarge" style={styles.label}>
        Container
      </Text>
      <Menu
        visible={menuVisible}
        onDismiss={() => setMenuVisible(false)}
        anchor={
          <Button mode="outlined" icon="cup-outline" onPress={() => setMenuVisible(true)}>
            {selected ? describe(selected) : 'No container'}
          </Button>
        }
      >
        <Menu.Item onPress={() => select(null)} title="No container" />
        {containers.map((container) => (
          <Menu.Item
            key={container.id}
            onPress={() => select(container.id)}
            title={describe(container)}
            trailingIcon={container.inUse >= container.quantity ? 'alert-circle-outline' : undefined}
          />
        ))}
        {containers.length === 0 && <Menu.Item title="No containers in inventory" disabled />}
      </Menu>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 8,
  },
  label: {
    marginBottom: 4,
    opacity: 0.7,
  },
});
