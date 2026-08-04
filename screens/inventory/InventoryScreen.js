import { StyleSheet, View } from 'react-native';
import { Appbar } from 'react-native-paper';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import ComingSoonScreen from '../ComingSoonScreen';
import FertilizersTab from './FertilizersTab';

const Tab = createMaterialTopTabNavigator();

function SeedsTab() {
  return <ComingSoonScreen title="Seed Packs" icon="seed-outline" />;
}

function ContainersTab() {
  return <ComingSoonScreen title="Containers" icon="cup-outline" />;
}

function MediumsTab() {
  return <ComingSoonScreen title="Growing Mediums" icon="grain" />;
}

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
