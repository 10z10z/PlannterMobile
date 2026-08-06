import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { messageFor } from '../lib/errors';

/**
 * The three states every loaded screen has, in one place.
 *
 * Before this, a screen rendered `!loading && <list/>` and dropped the error on
 * the floor — so a request that failed on a train looked exactly like an empty
 * growspace, and the only way out was to guess and pull the app shut. The
 * difference between "you have nothing here" and "we couldn't ask" is the whole
 * point of this component.
 *
 * Empty is a state and not an error, so it gets its own icon, its own words and
 * usually a button that fixes it — an empty inventory should invite the first
 * fertilizer, not apologise.
 *
 * @param {object} props
 * @param {import('@tanstack/react-query').UseQueryResult} props.query The query
 *   this stretch of screen is waiting on.
 * @param {boolean} [props.isEmpty] Whether the data that arrived was nothing.
 * @param {string} [props.emptyText] What to say when it was.
 * @param {keyof typeof MaterialCommunityIcons.glyphMap} [props.emptyIcon]
 * @param {import('react').ReactNode} [props.emptyAction] The way out of empty.
 * @param {string} [props.errorText] Wording for this screen's own failure, used
 *   when the error itself isn't one we have a sentence for.
 * @param {import('react').ReactNode} props.children What to draw once there is
 *   something to draw.
 */
export default function QueryBoundary({
  query,
  isEmpty = false,
  emptyText = 'Nothing here yet.',
  emptyIcon = 'tray',
  emptyAction = null,
  errorText,
  children,
}) {
  const theme = useTheme();

  // The first load is the only one worth a spinner. A refetch behind data that
  // is already on screen stays invisible — replacing a list with a spinner to
  // tell someone it is being confirmed is a downgrade.
  if (query.isPending) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator accessibilityLabel="Loading" />
      </View>
    );
  }

  if (query.isError) {
    return (
      <View style={styles.centre}>
        <MaterialCommunityIcons
          name="cloud-off-outline"
          size={40}
          color={theme.colors.onSurfaceVariant}
        />
        <Text variant="bodyLarge" style={styles.message}>
          {messageFor(query.error, errorText)}
        </Text>
        <Button
          mode="contained-tonal"
          icon="refresh"
          onPress={() => query.refetch()}
          loading={query.isFetching}
          disabled={query.isFetching}
        >
          Try again
        </Button>
      </View>
    );
  }

  if (isEmpty) {
    return (
      <View style={styles.centre}>
        <MaterialCommunityIcons name={emptyIcon} size={40} color={theme.colors.onSurfaceVariant} />
        <Text variant="bodyLarge" style={styles.message}>
          {emptyText}
        </Text>
        {emptyAction}
      </View>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  message: {
    textAlign: 'center',
    opacity: 0.7,
  },
});
