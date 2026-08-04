import { createNativeStackNavigator } from '@react-navigation/native-stack';
import GrowspacesOverviewScreen from '../screens/growspaces/GrowspacesOverviewScreen';
import PlantDetailScreen from '../screens/plants/PlantDetailScreen';

const Stack = createNativeStackNavigator();

export default function GrowspacesStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="GrowspacesOverview"
        component={GrowspacesOverviewScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PlantDetail"
        component={PlantDetailScreen}
        options={({ route }) => ({ title: route.params?.plantName ?? 'Plant' })}
      />
    </Stack.Navigator>
  );
}
