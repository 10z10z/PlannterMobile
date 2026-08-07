import InventoryTabScreen from '../../components/InventoryTabScreen';
import MediumCard from '../../components/MediumCard';
import MediumFormDialog from './MediumFormDialog';

export default function MediumsTab() {
  return (
    <InventoryTabScreen
      name="mediums"
      emptyIcon="shovel"
      emptyText="No growing mediums yet."
      errorText="Couldn’t load your growing mediums."
      addLabel="Add growing medium"
      deleteTitle="Delete medium"
      deleteBody={(item) => `Remove “${item.name}” from your inventory?`}
      renderCard={({ item, onPress, onDelete }) => (
        <MediumCard medium={item} onPress={onPress} onDelete={onDelete} />
      )}
      renderForm={({ visible, editing, onDismiss, onSaved }) => (
        <MediumFormDialog
          visible={visible}
          medium={editing}
          onDismiss={onDismiss}
          onSaved={onSaved}
        />
      )}
    />
  );
}
