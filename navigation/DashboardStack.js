import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import SettingsScreen from '../screens/SettingsScreen';
import CalendarScreen from '../screens/calendar/CalendarScreen';

/** @typedef {import('./types').DashboardParamList} DashboardParamList */

const Stack = /** @type {typeof createNativeStackNavigator<DashboardParamList, undefined>} */ (
  createNativeStackNavigator
)();

/**
 * The landing tab, and the two screens reached from its header.
 *
 * Settings lives here rather than in the bottom bar: it is the one destination
 * that isn't visited daily, and giving up its slot is what lets the dashboard
 * have one without a sixth icon. The calendar sits here too, so the page that
 * says what is due can open the page that plans it.
 */
export default function DashboardStack() {
  return (
    /* id: see the note in ./types.js */
    <Stack.Navigator id={undefined} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Calendar" component={CalendarScreen} />
    </Stack.Navigator>
  );
}
