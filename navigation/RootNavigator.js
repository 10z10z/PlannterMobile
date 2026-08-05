import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useThemePreference } from '../contexts/ThemeContext';
import LoginScreen from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';
import GrowspacesStack from './GrowspacesStack';
import GerminationStationsScreen from '../screens/germination/GerminationStationsScreen';
import InventoryScreen from '../screens/inventory/InventoryScreen';
import NpkCalculatorScreen from '../screens/calculator/NpkCalculatorScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
    </Stack.Navigator>
  );
}

function tabIcon(name) {
  return ({ color, size }) => <MaterialCommunityIcons name={name} color={color} size={size} />;
}

function AppTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      {/* The route names are what the rest of the app navigates by, so the
          labels are set separately rather than by renaming the routes. */}
      <Tab.Screen
        name="Growspaces"
        component={GrowspacesStack}
        options={{ tabBarIcon: tabIcon('flower-outline'), title: 'Growspace' }}
      />
      <Tab.Screen
        name="Germination"
        component={GerminationStationsScreen}
        options={{ tabBarIcon: tabIcon('sprout-outline'), title: 'Sowing' }}
      />
      <Tab.Screen
        name="Inventory"
        component={InventoryScreen}
        options={{ tabBarIcon: tabIcon('package-variant-closed') }}
      />
      <Tab.Screen
        name="NPK"
        component={NpkCalculatorScreen}
        options={{ tabBarIcon: tabIcon('calculator-variant-outline'), title: 'NPK Calc' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarIcon: tabIcon('cog-outline') }}
      />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { session, loading } = useAuth();
  const { isDark } = useThemePreference();

  if (loading) return null;

  return (
    <NavigationContainer theme={isDark ? DarkTheme : DefaultTheme}>
      {session ? <AppTabs /> : <AuthStack />}
    </NavigationContainer>
  );
}
