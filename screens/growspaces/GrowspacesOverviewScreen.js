import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Appbar, Button } from 'react-native-paper';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useGrowspaces } from '../../hooks/useGrowspaces';
import QueryBoundary from '../../components/QueryBoundary';
import ScreenTitle from '../../components/ScreenTitle';
import GrowspaceTabScreen from './GrowspaceTabScreen';
import GrowspaceFormDialog from './GrowspaceFormDialog';

const Tab = createMaterialTopTabNavigator();

export default function GrowspacesOverviewScreen({ navigation, route }) {
  const growspaceQuery = useGrowspaces();
  const growspaces = growspaceQuery.data ?? [];
  const [dialogVisible, setDialogVisible] = useState(false);

  const openDialog = () => setDialogVisible(true);

  /**
   * The growspace the dashboard asked for, if it is one we have.
   *
   * The tabs mount only once the growspaces have loaded, which is after the
   * navigation that asked for one has already happened — so the request is read
   * back off the route here rather than relied on to arrive in time. Checked
   * against the loaded list, since naming an initial route that doesn't exist
   * would leave the navigator with nothing to show.
   */
  const asked = route?.params?.screen;
  const initialRouteName = growspaces.some((growspace) => growspace.id === asked)
    ? asked
    : undefined;

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.Content title={<ScreenTitle icon="flower-outline" label="My Growspace" />} />
        <Appbar.Action
          icon="calendar-month-outline"
          accessibilityLabel="Calendar"
          onPress={() => navigation.navigate('Calendar')}
        />
        <Appbar.Action icon="plus" accessibilityLabel="New growspace" onPress={openDialog} />
      </Appbar.Header>

      <QueryBoundary
        query={growspaceQuery}
        isEmpty={growspaces.length === 0}
        emptyIcon="flower-outline"
        emptyText="No growspaces yet."
        errorText="Couldn’t load your growspaces."
        emptyAction={
          <Button mode="contained" icon="plus" onPress={openDialog}>
            Create a growspace to start growing
          </Button>
        }
      >
        {/* Routes are named by growspace id at runtime, so there is no param
            list to give this one. id: see navigation/types.js. */}
        <Tab.Navigator id={undefined} initialRouteName={initialRouteName}>
          {growspaces.map((growspace) => (
            <Tab.Screen
              key={growspace.id}
              name={growspace.id}
              component={GrowspaceTabScreen}
              initialParams={{ growspaceId: growspace.id }}
              options={{ tabBarLabel: growspace.name }}
            />
          ))}
        </Tab.Navigator>
      </QueryBoundary>

      <GrowspaceFormDialog
        visible={dialogVisible}
        growspace={null}
        onDismiss={() => setDialogVisible(false)}
        onSaved={() => setDialogVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  emptyText: {
    opacity: 0.7,
  },
});
