import { createNativeStackNavigator } from '@react-navigation/native-stack';
import GrowspacesOverviewScreen from '../screens/growspaces/GrowspacesOverviewScreen';
import PlantDetailScreen from '../screens/plants/PlantDetailScreen';
import CalendarScreen from '../screens/calendar/CalendarScreen';

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
      <Stack.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{ headerShown: false }}
        initialParams={{ scope: 'growspace' }}
      />
    </Stack.Navigator>
  );
}
