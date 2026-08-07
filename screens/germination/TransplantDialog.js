import { useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Dialog, HelperText, Menu, Portal, Text } from 'react-native-paper';
import DialogScroll from '../../components/DialogScroll';
import FormField from '../../components/FormField';
import { useUnits } from '../../contexts/UnitsContext';
import { formatVolume } from '../../lib/units';
import { materialLabel } from '../../lib/containers';
import { germinatedCells, transplant } from '../../lib/germination';
import { messageFor } from '../../lib/errors';
import { useGrowspaces } from '../../hooks/useGrowspaces';
import { useInventory } from '../../hooks/useInventory';
import { useDataMutation } from '../../hooks/useDataMutation';
import useForm from '../../hooks/useForm';
import { containersFitSeedlingsCheck, transplantSchema } from '../../lib/schemas';
import { parseWhole } from '../../lib/numbers';
import ErrorText from '../../components/ErrorText';

const CHECKS = [containersFitSeedlingsCheck];

/**
 * Moves germinated seedlings into a growspace, from one held cell, a selection
 * of cells, or a whole sowing. Several seedlings can share a container — the
 * split is even, and each container becomes one plant carrying its count.
 */
export default function TransplantDialog({ visible, sowing, cells, onDismiss, onDone }) {
  const { system } = useUnits();

  const growspaceQuery = useGrowspaces();
  const growspaces = useMemo(() => growspaceQuery.data ?? [], [growspaceQuery.data]);
  const containerShelf = useInventory('containers');
  const containers = containerShelf.data ?? [];

  const [openMenu, setOpenMenu] = useState(null);

  const move = useDataMutation({
    mutationFn: transplant,
    // The seedlings leave the station side and arrive as plants in a growspace,
    // taking containers out of the free count on the way.
    affects: 'transplanted',
    onSuccess: onDone,
  });

  const available = (cells ?? []).reduce((sum, cell) => sum + cell.germinated, 0);

  const form = useForm(transplantSchema(available), { checks: CHECKS });
  const resetForm = form.reset;

  // Names where the seedlings came from, so a partial move can't be mistaken for
  // emptying the tray.
  const ready = germinatedCells(sowing?.grid);
  const source =
    cells?.length === 1
      ? 'this cell'
      : cells?.length === ready.length
        ? 'this sowing'
        : `the ${cells?.length} selected cells`;

  useEffect(() => {
    if (!visible) return;
    resetForm({
      seedlings: String(available),
      container_count: String(available || 1),
      growspace_id: null,
      container_id: null,
      name: sowing?.seed_pack_name ?? '',
    });
    move.reset();
    // Opening is the trigger; the lists come from the cache below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, available, sowing, resetForm]);

  // With a single growspace there is nothing to choose, so it is chosen. Kept
  // apart from the setup above because the list arrives from the cache and may
  // land after the dialog has opened.
  useEffect(() => {
    if (!visible || form.values.growspace_id || growspaces.length !== 1) return;
    form.set('growspace_id', growspaces[0].id);
  }, [visible, form, growspaces]);

  const seedlingCount = parseWhole(form.values.seedlings);
  const potCount = parseWhole(form.values.container_count);
  const selectedGrowspace = growspaces.find((entry) => entry.id === form.values.growspace_id);
  const selectedContainer = containers.find((entry) => entry.id === form.values.container_id);
  const name = form.values.name;

  const describeContainer = (entry) =>
    `${formatVolume(entry.volume_liters, system)} ${materialLabel(entry.material)}`;

  const perPot =
    seedlingCount > 0 && potCount > 0
      ? seedlingCount % potCount === 0
        ? `${seedlingCount / potCount} per container`
        : `${Math.floor(seedlingCount / potCount)}-${Math.ceil(
            seedlingCount / potCount
          )} per container`
      : undefined;

  const handleTransplant = () => {
    form.submit((values) =>
      move.mutate({
        sowing,
        cells,
        seedlingCount: values.seedlings,
        growspaceId: values.growspace_id,
        containerId: values.container_id,
        containerCount: values.container_count,
        name: values.name,
      })
    );
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>Transplant</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <DialogScroll>
            <Text variant="bodyMedium">
              {`${available} seedling${available === 1 ? '' : 's'} ready in ${source}.`}
            </Text>

            <FormField
              label="Seedlings to move"
              keyboardType="number-pad"
              style={styles.spacedInput}
              {...form.field('seedlings')}
            />
            <FormField
              label="Containers to use"
              keyboardType="number-pad"
              hint={perPot}
              {...form.field('container_count')}
            />

            <Text variant="labelLarge" style={styles.label}>
              Growspace
            </Text>
            <Menu
              visible={openMenu === 'growspace'}
              onDismiss={() => setOpenMenu(null)}
              anchor={
                <Button
                  mode="outlined"
                  icon="flower-outline"
                  onPress={() => setOpenMenu('growspace')}
                >
                  {selectedGrowspace ? selectedGrowspace.name : 'Pick a growspace'}
                </Button>
              }
            >
              {growspaces.map((entry) => (
                <Menu.Item
                  key={entry.id}
                  title={entry.name}
                  onPress={() => {
                    form.set('growspace_id', entry.id);
                    setOpenMenu(null);
                  }}
                />
              ))}
              {growspaces.length === 0 && <Menu.Item title="No growspaces yet" disabled />}
            </Menu>
            {!!form.errors.growspace_id && (
              <HelperText type="error">{form.errors.growspace_id}</HelperText>
            )}

            <Text variant="labelLarge" style={styles.label}>
              Container
            </Text>
            <Menu
              visible={openMenu === 'container'}
              onDismiss={() => setOpenMenu(null)}
              anchor={
                <Button mode="outlined" icon="cup-outline" onPress={() => setOpenMenu('container')}>
                  {selectedContainer ? describeContainer(selectedContainer) : 'No container'}
                </Button>
              }
            >
              <Menu.Item
                title="No container"
                onPress={() => {
                  form.set('container_id', null);
                  setOpenMenu(null);
                }}
              />
              {containers.map((entry) => (
                <Menu.Item
                  key={entry.id}
                  title={`${describeContainer(entry)} · ${entry.quantity - entry.inUse} free`}
                  trailingIcon={entry.inUse >= entry.quantity ? 'alert-circle-outline' : undefined}
                  onPress={() => {
                    form.set('container_id', entry.id);
                    setOpenMenu(null);
                  }}
                />
              ))}
              {containers.length === 0 && <Menu.Item title="No containers in inventory" disabled />}
            </Menu>

            <FormField
              label="Plant name"
              style={styles.spacedInput}
              hint={
                potCount > 1
                  ? `Numbered "${name || 'Plant'} 1" to "${name || 'Plant'} ${potCount}".`
                  : 'One plant is created in the growspace.'
              }
              {...form.field('name')}
            />

            <ErrorText>{move.isError ? messageFor(move.error) : ''}</ErrorText>
          </DialogScroll>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button
            onPress={handleTransplant}
            loading={move.isPending}
            disabled={move.isPending || available === 0 || !form.canSubmit}
          >
            Transplant
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    maxHeight: '85%',
  },
  scrollArea: {
    paddingHorizontal: 0,
  },
  label: {
    marginTop: 12,
    marginBottom: 4,
    opacity: 0.7,
  },
  spacedInput: {
    marginTop: 12,
  },
});
