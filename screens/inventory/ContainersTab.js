import InventoryTabScreen from '../../components/InventoryTabScreen';
import ContainerCard from '../../components/ContainerCard';
import ContainerFormDialog from './ContainerFormDialog';

export default function ContainersTab() {
  return (
    <InventoryTabScreen
      name="containers"
      emptyIcon="cup-outline"
      emptyText="No containers yet."
      errorText="Couldn’t load your containers."
      addLabel="Add containers"
      deleteTitle="Delete containers"
      deleteBody={() =>
        'Remove this set of containers? Plants using them will be left without a container.'
      }
      renderCard={({ item, onPress, onDelete }) => (
        <ContainerCard container={item} inUse={item.inUse} onPress={onPress} onDelete={onDelete} />
      )}
      renderForm={({ visible, editing, onDismiss, onSaved }) => (
        <ContainerFormDialog
          visible={visible}
          container={editing}
          onDismiss={onDismiss}
          onSaved={onSaved}
        />
      )}
    />
  );
}
