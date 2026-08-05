import { createNativeStackNavigator } from '@react-navigation/native-stack';
import GerminationStationsScreen from '../screens/germination/GerminationStationsScreen';
import CalendarScreen from '../screens/calendar/CalendarScreen';

const Stack = createNativeStackNavigator();

/**
 * The stations screen carries its own header, so the stack exists only to give
 * the calendar somewhere to be pushed onto from it.
 */
export default function GerminationStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="GerminationStations" component={GerminationStationsScreen} />
      <Stack.Screen
        name="Calendar"
        component={CalendarScreen}
        initialParams={{ scope: 'station' }}
      />
    </Stack.Navigator>
  );
}
