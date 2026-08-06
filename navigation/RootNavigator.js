import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useThemePreference } from '../contexts/ThemeContext';
import LoginScreen from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';
import DashboardStack from './DashboardStack';
import GrowspacesStack from './GrowspacesStack';
import GerminationStack from './GerminationStack';
import InventoryScreen from '../screens/inventory/InventoryScreen';
import NpkCalculatorScreen from '../screens/calculator/NpkCalculatorScreen';
import ErrorBoundary from '../components/ErrorBoundary';

/** @typedef {import('./types').AuthParamList} AuthParamList */
/** @typedef {import('./types').TabParamList} TabParamList */

const Stack = /** @type {typeof createNativeStackNavigator<AuthParamList, undefined>} */ (
  createNativeStackNavigator
)();
const Tab = /** @type {typeof createBottomTabNavigator<TabParamList, undefined>} */ (
  createBottomTabNavigator
)();

function AuthStack() {
  return (
    /* id: see the note in ./types.js */
    <Stack.Navigator id={undefined} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
    </Stack.Navigator>
  );
}

/**
 * A tab's icon, as the render function `tabBarIcon` wants.
 *
 * Named rather than returned anonymously so React DevTools and any component
 * stack in a crash report say which tab it was, instead of "Unknown".
 *
 * @param {keyof typeof MaterialCommunityIcons.glyphMap} name
 */
function tabIcon(name) {
  const TabIcon = ({ color, size }) => (
    <MaterialCommunityIcons name={name} color={color} size={size} />
  );
  TabIcon.displayName = `TabIcon(${name})`;
  return TabIcon;
}

/**
 * A tab behind its own error boundary.
 *
 * Each tab gets one so that a screen which throws takes only itself down — the
 * bar stays up and the other four still work, which also means the grower can
 * carry on with the rest of the app instead of force-quitting.
 *
 * Built once at module scope rather than inline in `component={...}`: a fresh
 * component identity on each render would remount the whole tab, throwing away
 * its scroll position and its navigation state.
 *
 * @param {import('react').ComponentType<any>} Screen
 * @param {string} label Names the tab in the fallback, so it says which broke.
 */
function guarded(Screen, label) {
  const Guarded = (props) => (
    <ErrorBoundary label={label}>
      <Screen {...props} />
    </ErrorBoundary>
  );
  Guarded.displayName = `Guarded(${label})`;
  return Guarded;
}

const GuardedDashboard = guarded(DashboardStack, 'The dashboard');
const GuardedGrowspaces = guarded(GrowspacesStack, 'Growspaces');
const GuardedGermination = guarded(GerminationStack, 'Sowing');
const GuardedInventory = guarded(InventoryScreen, 'Inventory');
const GuardedNpk = guarded(NpkCalculatorScreen, 'The NPK calculator');

function AppTabs() {
  return (
    /* id: see the note in ./types.js */
    <Tab.Navigator id={undefined} screenOptions={{ headerShown: false }}>
      {/* The route names are what the rest of the app navigates by, so the
          labels are set separately rather than by renaming the routes. */}
      <Tab.Screen
        name="Home"
        component={GuardedDashboard}
        options={{ tabBarIcon: tabIcon('view-dashboard-outline'), title: 'Home' }}
      />
      <Tab.Screen
        name="Growspaces"
        component={GuardedGrowspaces}
        options={{ tabBarIcon: tabIcon('flower-outline'), title: 'Growspace' }}
      />
      <Tab.Screen
        name="Germination"
        component={GuardedGermination}
        options={{ tabBarIcon: tabIcon('sprout-outline'), title: 'Sowing' }}
      />
      <Tab.Screen
        name="Inventory"
        component={GuardedInventory}
        options={{ tabBarIcon: tabIcon('package-variant-closed') }}
      />
      <Tab.Screen
        name="NPK"
        component={GuardedNpk}
        options={{ tabBarIcon: tabIcon('calculator-variant-outline'), title: 'NPK Calc' }}
      />
      {/* Settings has no tab of its own: it sits behind the gear on the
          dashboard, which is what keeps this bar at five icons. */}
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { session, loading } = useAuth();
  const { navigationTheme } = useThemePreference();

  if (loading) return null;

  return (
    <NavigationContainer theme={navigationTheme}>
      {session ? <AppTabs /> : <AuthStack />}
    </NavigationContainer>
  );
}
