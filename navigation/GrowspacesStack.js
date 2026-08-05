import { createNativeStackNavigator } from '@react-navigation/native-stack';
import GrowspacesOverviewScreen from '../screens/growspaces/GrowspacesOverviewScreen';
import PlantDetailScreen from '../screens/plants/PlantDetailScreen';
import CalendarScreen from '../screens/calendar/CalendarScreen';
import ScreenTitle from '../components/ScreenTitle';

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
        options={({ route }) => ({
          title: route.params?.plantName ?? 'Plant',
          // The plant's own name still names the screen; the leaf is there so
          // the header reads like the ones the tabs lead to.
          headerTitle: ({ children, tintColor }) => (
            <ScreenTitle icon="leaf" label={children} color={tintColor} />
          ),
        })}
      />
      <Stack.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
