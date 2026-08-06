import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, Dialog, HelperText, Menu, Portal, Text } from 'react-native-paper';
import TextField from '../../components/TextField';
import { useUnits } from '../../contexts/UnitsContext';
import { formatVolume } from '../../lib/units';
import { materialLabel } from '../../lib/containers';
import { germinatedCells, transplant } from '../../lib/germination';
import { messageFor } from '../../lib/errors';
import { useGrowspaces } from '../../hooks/useGrowspaces';
import { useInventory } from '../../hooks/useInventory';
import { useDataMutation } from '../../hooks/useDataMutation';
import ErrorText from '../../components/ErrorText';

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

  const [growspaceId, setGrowspaceId] = useState(null);
  const [containerId, setContainerId] = useState(null);
  const [seedlings, setSeedlings] = useState('1');
  const [containerCount, setContainerCount] = useState('1');
  const [name, setName] = useState('');

  const [openMenu, setOpenMenu] = useState(null);
  // Only what this dialog checks itself; the server's objections arrive on the
  // mutation, and both are shown in the same place.
  const [validationError, setValidationError] = useState('');

  const move = useDataMutation({
    mutationFn: transplant,
    // The seedlings leave the station side and arrive as plants in a growspace,
    // taking containers out of the free count on the way.
    affects: 'transplanted',
    onSuccess: onDone,
  });

  const available = (cells ?? []).reduce((sum, cell) => sum + cell.germinated, 0);

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
    setSeedlings(String(available));
    setContainerCount(String(available || 1));
    setName(sowing?.seed_pack_name ?? '');
    setGrowspaceId(null);
    setContainerId(null);
    setValidationError('');
    move.reset();
    // Opening is the trigger; the lists come from the cache below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, available, sowing]);

  // With a single growspace there is nothing to choose, so it is chosen. Kept
  // apart from the setup above because the list arrives from the cache and may
  // land after the dialog has opened.
  useEffect(() => {
    if (!visible || growspaceId || growspaces.length !== 1) return;
    setGrowspaceId(growspaces[0].id);
  }, [visible, growspaceId, growspaces]);

  const seedlingCount = parseInt(seedlings, 10);
  const potCount = parseInt(containerCount, 10);
  const selectedGrowspace = growspaces.find((entry) => entry.id === growspaceId);
  const selectedContainer = containers.find((entry) => entry.id === containerId);

  const describeContainer = (entry) =>
    `${formatVolume(entry.volume_liters, system)} ${materialLabel(entry.material)}`;

  const perPot =
    seedlingCount > 0 && potCount > 0
      ? seedlingCount % potCount === 0
        ? `${seedlingCount / potCount} per container`
        : `${Math.floor(seedlingCount / potCount)}-${Math.ceil(
            seedlingCount / potCount
          )} per container`
      : null;

  const handleTransplant = () => {
    if (!seedlingCount || seedlingCount < 1 || seedlingCount > available) {
      setValidationError(`Pick between 1 and ${available} seedlings`);
      return;
    }
    if (!potCount || potCount < 1 || potCount > seedlingCount) {
      setValidationError('Containers must be between 1 and the number of seedlings');
      return;
    }
    if (!growspaceId) {
      setValidationError('Pick a growspace');
      return;
    }
    if (!name.trim()) {
      setValidationError('Name is required');
      return;
    }

    setValidationError('');
    move.mutate({
      sowing,
      cells,
      seedlingCount,
      growspaceId,
      containerId,
      containerCount: potCount,
      name: name.trim(),
    });
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>Transplant</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text variant="bodyMedium">
              {`${available} seedling${available === 1 ? '' : 's'} ready in ${source}.`}
            </Text>

            <TextField
              label="Seedlings to move"
              value={seedlings}
              onChangeText={setSeedlings}
              keyboardType="number-pad"
              style={[styles.input, styles.spacedInput]}
            />
            <TextField
              label="Containers to use"
              value={containerCount}
              onChangeText={setContainerCount}
              keyboardType="number-pad"
              style={styles.input}
            />
            {!!perPot && <HelperText type="info">{perPot}</HelperText>}

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
                    setGrowspaceId(entry.id);
                    setOpenMenu(null);
                  }}
                />
              ))}
              {growspaces.length === 0 && <Menu.Item title="No growspaces yet" disabled />}
            </Menu>

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
                  setContainerId(null);
                  setOpenMenu(null);
                }}
              />
              {containers.map((entry) => (
                <Menu.Item
                  key={entry.id}
                  title={`${describeContainer(entry)} · ${entry.quantity - entry.inUse} free`}
                  trailingIcon={entry.inUse >= entry.quantity ? 'alert-circle-outline' : undefined}
                  onPress={() => {
                    setContainerId(entry.id);
                    setOpenMenu(null);
                  }}
                />
              ))}
              {containers.length === 0 && <Menu.Item title="No containers in inventory" disabled />}
            </Menu>

            <TextField
              label="Plant name"
              value={name}
              onChangeText={setName}
              style={[styles.input, styles.spacedInput]}
            />
            <HelperText type="info">
              {potCount > 1
                ? `Numbered "${name || 'Plant'} 1" to "${name || 'Plant'} ${potCount}".`
                : 'One plant is created in the growspace.'}
            </HelperText>

            <ErrorText>{validationError || (move.isError ? messageFor(move.error) : '')}</ErrorText>
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button
            onPress={handleTransplant}
            loading={move.isPending}
            disabled={move.isPending || available === 0}
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
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  label: {
    marginTop: 12,
    marginBottom: 4,
    opacity: 0.7,
  },
  input: {
    marginBottom: 8,
  },
  spacedInput: {
    marginTop: 12,
  },
});
