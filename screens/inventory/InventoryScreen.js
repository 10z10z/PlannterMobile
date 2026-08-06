import { StyleSheet, View } from 'react-native';
import { Appbar } from 'react-native-paper';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import ScreenTitle from '../../components/ScreenTitle';
import TabLabel from '../../components/TabLabel';
import FertilizersTab from './FertilizersTab';
import SeedsTab from './SeedsTab';
import ContainersTab from './ContainersTab';
import TraysTab from './TraysTab';
import MediumsTab from './MediumsTab';
import GrowLightsTab from './GrowLightsTab';

const Tab = createMaterialTopTabNavigator();

/** Each shelf of the inventory, with the icon it is drawn with elsewhere. */
const INVENTORY_TABS = [
  { name: 'Fertilizers', icon: 'bottle-tonic-outline', component: FertilizersTab },
  { name: 'Seeds', icon: 'seed-outline', component: SeedsTab },
  { name: 'Containers', icon: 'pot-outline', component: ContainersTab },
  { name: 'Trays', icon: 'grid', component: TraysTab },
  { name: 'Mediums', icon: 'pot-mix-outline', component: MediumsTab },
  { name: 'Lights', icon: 'lightbulb-on-outline', component: GrowLightsTab },
];

export default function InventoryScreen() {
  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.Content title={<ScreenTitle icon="package-variant-closed" label="Inventory" />} />
      </Appbar.Header>

      {/* id: see navigation/types.js. */}
      <Tab.Navigator
        id={undefined}
        screenOptions={{ tabBarScrollEnabled: true, tabBarItemStyle: { width: 'auto' } }}
      >
        {INVENTORY_TABS.map(({ name, icon, component }) => (
          <Tab.Screen
            key={name}
            name={name}
            component={component}
            options={{
              tabBarLabel: ({ color }) => <TabLabel icon={icon} label={name} color={color} />,
            }}
          />
        ))}
      </Tab.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
