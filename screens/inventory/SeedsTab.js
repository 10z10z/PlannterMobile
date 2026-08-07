import InventoryTabScreen from '../../components/InventoryTabScreen';
import SeedPackCard from '../../components/SeedPackCard';
import SeedPackFormDialog from './SeedPackFormDialog';

export default function SeedsTab() {
  return (
    <InventoryTabScreen
      name="seedPacks"
      emptyIcon="seed-outline"
      emptyText="No seed packs yet."
      errorText="Couldn’t load your seed packs."
      addLabel="Add seed pack"
      deleteTitle="Delete seed pack"
      deleteBody={(item) => `Remove “${item.name}” from your inventory?`}
      renderCard={({ item, onPress, onDelete }) => (
        <SeedPackCard seedPack={item} onPress={onPress} onDelete={onDelete} />
      )}
      renderForm={({ visible, editing, onDismiss, onSaved }) => (
        <SeedPackFormDialog
          visible={visible}
          seedPack={editing}
          onDismiss={onDismiss}
          onSaved={onSaved}
        />
      )}
    />
  );
}
