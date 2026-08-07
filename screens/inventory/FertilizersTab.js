import InventoryTabScreen from '../../components/InventoryTabScreen';
import FertilizerCard from '../../components/FertilizerCard';
import FertilizerFormDialog from './FertilizerFormDialog';

export default function FertilizersTab() {
  return (
    <InventoryTabScreen
      name="fertilizers"
      emptyIcon="bottle-tonic-outline"
      emptyText="No fertilizers yet."
      errorText="Couldn’t load your fertilizers."
      addLabel="Add fertilizer"
      deleteTitle="Delete fertilizer"
      deleteBody={(item) => `Remove “${item.name}” from your inventory?`}
      renderCard={({ item, onPress, onDelete }) => (
        <FertilizerCard fertilizer={item} onPress={onPress} onDelete={onDelete} />
      )}
      renderForm={({ visible, editing, onDismiss, onSaved }) => (
        <FertilizerFormDialog
          visible={visible}
          fertilizer={editing}
          onDismiss={onDismiss}
          onSaved={onSaved}
        />
      )}
    />
  );
}
