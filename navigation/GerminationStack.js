import { createNativeStackNavigator } from '@react-navigation/native-stack';
import GerminationStationsScreen from '../screens/germination/GerminationStationsScreen';
import CalendarScreen from '../screens/calendar/CalendarScreen';

/** @typedef {import('./types').GerminationParamList} GerminationParamList */

const Stack = /** @type {typeof createNativeStackNavigator<GerminationParamList, undefined>} */ (
  createNativeStackNavigator
)();

/**
 * The stations screen carries its own header, so the stack exists only to give
 * the calendar somewhere to be pushed onto from it.
 */
export default function GerminationStack() {
  return (
    /* id: see the note in ./types.js */
    <Stack.Navigator id={undefined} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="GerminationStations" component={GerminationStationsScreen} />
      <Stack.Screen name="Calendar" component={CalendarScreen} />
    </Stack.Navigator>
  );
}
