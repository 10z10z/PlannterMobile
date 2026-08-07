import InventoryTabScreen from '../../components/InventoryTabScreen';
import TrayCard from '../../components/TrayCard';
import TrayFormDialog from './TrayFormDialog';

export default function TraysTab() {
  return (
    <InventoryTabScreen
      name="trays"
      emptyIcon="grid"
      emptyText="No trays yet."
      errorText="Couldn’t load your trays."
      addLabel="Add trays"
      deleteTitle="Delete trays"
      deleteBody={(item) => `Remove “${item.name}” from your inventory?`}
      renderCard={({ item, onPress, onDelete }) => (
        <TrayCard tray={item} inUse={item.inUse} onPress={onPress} onDelete={onDelete} />
      )}
      renderForm={({ visible, editing, onDismiss, onSaved }) => (
        <TrayFormDialog visible={visible} tray={editing} onDismiss={onDismiss} onSaved={onSaved} />
      )}
    />
  );
}
