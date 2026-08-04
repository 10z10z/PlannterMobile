import { StyleSheet, View } from 'react-native';
import { Appbar } from 'react-native-paper';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import FertilizersTab from './FertilizersTab';
import SeedsTab from './SeedsTab';
import ContainersTab from './ContainersTab';
import MediumsTab from './MediumsTab';

const Tab = createMaterialTopTabNavigator();

export default function InventoryScreen() {
  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.Content title="Inventory" />
      </Appbar.Header>

      <Tab.Navigator screenOptions={{ tabBarScrollEnabled: true, tabBarItemStyle: { width: 'auto' } }}>
        <Tab.Screen name="Fertilizers" component={FertilizersTab} />
        <Tab.Screen name="Seeds" component={SeedsTab} />
        <Tab.Screen name="Containers" component={ContainersTab} />
        <Tab.Screen name="Mediums" component={MediumsTab} />
      </Tab.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
