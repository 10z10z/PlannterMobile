import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Appbar, Button } from 'react-native-paper';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import ScreenTitle from '../../components/ScreenTitle';
import QueryBoundary from '../../components/QueryBoundary';
import { useStations } from '../../hooks/useStations';
import StationFormDialog from './StationFormDialog';
import StationTabScreen from './StationTabScreen';

const Tab = createMaterialTopTabNavigator();

/** Stations sit in swipeable tabs, the same shape as the growspace screen. */
export default function GerminationStationsScreen({ navigation }) {
  const stationQuery = useStations();
  const stations = stationQuery.data ?? [];
  const [dialogVisible, setDialogVisible] = useState(false);

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.Content title={<ScreenTitle icon="sprout-outline" label="Sowing" />} />
        <Appbar.Action
          icon="calendar-month-outline"
          accessibilityLabel="Calendar"
          onPress={() => navigation.navigate('Calendar')}
        />
        <Appbar.Action
          icon="plus"
          accessibilityLabel="New germination station"
          onPress={() => setDialogVisible(true)}
        />
      </Appbar.Header>

      <QueryBoundary
        query={stationQuery}
        isEmpty={stations.length === 0}
        emptyIcon="sprout-outline"
        emptyText="No germination stations yet."
        errorText="Couldn’t load your germination stations."
        emptyAction={
          <Button mode="contained" icon="plus" onPress={() => setDialogVisible(true)}>
            Create a station to start sowing
          </Button>
        }
      >
        {/* Routes are named by station id at runtime, so there is no param
            list to give this one. id: see navigation/types.js. */}
        <Tab.Navigator id={undefined}>
          {stations.map((station) => (
            <Tab.Screen
              key={station.id}
              name={station.id}
              component={StationTabScreen}
              initialParams={{ stationId: station.id }}
              options={{ tabBarLabel: station.name }}
            />
          ))}
        </Tab.Navigator>
      </QueryBoundary>

      <StationFormDialog
        visible={dialogVisible}
        station={null}
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
