import InventoryTabScreen from '../../components/InventoryTabScreen';
import GrowLightCard from '../../components/GrowLightCard';
import GrowLightFormDialog from './GrowLightFormDialog';

export default function GrowLightsTab() {
  return (
    <InventoryTabScreen
      name="growLights"
      emptyIcon="lightbulb-outline"
      emptyText="No grow lights yet."
      errorText="Couldn’t load your grow lights."
      addLabel="Add grow lights"
      deleteTitle="Delete grow lights"
      deleteBody={(item) => `Remove “${item.name}” from your inventory?`}
      renderCard={({ item, onPress, onDelete }) => (
        <GrowLightCard light={item} inUse={item.inUse} onPress={onPress} onDelete={onDelete} />
      )}
      renderForm={({ visible, editing, onDismiss, onSaved }) => (
        <GrowLightFormDialog
          visible={visible}
          light={editing}
          onDismiss={onDismiss}
          onSaved={onSaved}
        />
      )}
    />
  );
}
