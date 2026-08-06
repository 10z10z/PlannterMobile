import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Dialog, FAB, Portal, Text } from 'react-native-paper';
import QueryBoundary from './QueryBoundary';
import ErrorText from './ErrorText';
import { messageFor } from '../lib/errors';
import { useDeleteInventoryItem, useInventory } from '../hooks/useInventory';

/**
 * One inventory tab: a list, a button that adds to it, and a confirmation
 * before anything leaves it.
 *
 * All six tabs are this screen. They differ in which card draws a row, which
 * dialog edits one, and what the confirmation says — so those are passed in,
 * and everything else, including the three states a load can be in and what
 * happens when a delete fails, is decided here once.
 *
 * The card and the form arrive as render functions rather than as components
 * with fixed prop names, because each dialog names its own subject: a
 * `seedPack`, a `medium`, a `light`. Mapping that at the call site keeps the
 * six dialogs free to stay themselves.
 *
 * @param {object} props
 * @param {import('../lib/inventory').ShelfName} props.name Picks the data and
 *   the cache key together.
 * @param {string} props.emptyText
 * @param {keyof typeof import('@expo/vector-icons').MaterialCommunityIcons.glyphMap} props.emptyIcon
 * @param {string} props.errorText Wording for a failed load.
 * @param {string} props.addLabel What the add button is called, for screen readers.
 * @param {string} props.deleteTitle
 * @param {(item: any) => string} props.deleteBody What removing this one costs.
 * @param {(row: { item: any, onPress: () => void, onDelete: () => void }) => import('react').ReactElement} props.renderCard
 * @param {(form: { visible: boolean, editing: any, onDismiss: () => void, onSaved: () => void }) => import('react').ReactNode} props.renderForm
 */
export default function InventoryTabScreen({
  name,
  emptyText,
  emptyIcon,
  errorText,
  addLabel,
  deleteTitle,
  deleteBody,
  renderCard,
  renderForm,
}) {
  const items = useInventory(name);
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const remove = useDeleteInventoryItem(name, { onSuccess: () => setPendingDelete(null) });

  const closeDelete = () => {
    remove.reset();
    setPendingDelete(null);
  };

  const rows = items.data ?? [];

  return (
    <View style={styles.container}>
      <QueryBoundary
        query={items}
        isEmpty={rows.length === 0}
        emptyIcon={emptyIcon}
        emptyText={emptyText}
        errorText={errorText}
      >
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          // The pull spinner, not the first-load one: the list underneath stays
          // where it is while it refreshes.
          refreshing={items.isRefetching}
          onRefresh={items.refetch}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) =>
            renderCard({
              item,
              onPress: () => {
                setEditing(item);
                setFormVisible(true);
              },
              onDelete: () => setPendingDelete(item),
            })
          }
        />
      </QueryBoundary>

      <FAB
        icon="plus"
        style={styles.fab}
        accessibilityLabel={addLabel}
        onPress={() => {
          setEditing(null);
          setFormVisible(true);
        }}
      />

      {renderForm({
        visible: formVisible,
        editing,
        onDismiss: () => setFormVisible(false),
        onSaved: () => setFormVisible(false),
      })}

      <Portal>
        <Dialog visible={!!pendingDelete} onDismiss={closeDelete}>
          <Dialog.Title>{deleteTitle}</Dialog.Title>
          <Dialog.Content>
            <Text>{pendingDelete ? deleteBody(pendingDelete) : ''}</Text>
            {/* A delete that fails says so here, rather than closing onto a row
                that is somehow still in the list. */}
            <ErrorText>{remove.isError ? messageFor(remove.error) : ''}</ErrorText>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={closeDelete} disabled={remove.isPending}>
              Cancel
            </Button>
            <Button
              onPress={() => remove.mutate(pendingDelete.id)}
              loading={remove.isPending}
              disabled={remove.isPending}
            >
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingTop: 16,
    paddingBottom: 96,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
});
