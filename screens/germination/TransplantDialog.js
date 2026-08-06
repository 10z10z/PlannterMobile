import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, Dialog, HelperText, Menu, Portal, Text } from 'react-native-paper';
import TextField from '../../components/TextField';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useUnits } from '../../contexts/UnitsContext';
import { formatVolume } from '../../lib/units';
import { fetchContainersWithUsage, materialLabel } from '../../lib/containers';
import { germinatedCells, transplant } from '../../lib/germination';
import ErrorText from '../../components/ErrorText';

/**
 * Moves germinated seedlings into a growspace, from one held cell, a selection
 * of cells, or a whole sowing. Several seedlings can share a container — the
 * split is even, and each container becomes one plant carrying its count.
 */
export default function TransplantDialog({ visible, sowing, cells, onDismiss, onDone }) {
  const { session } = useAuth();
  const { system } = useUnits();

  const [growspaces, setGrowspaces] = useState([]);
  const [containers, setContainers] = useState([]);
  const [growspaceId, setGrowspaceId] = useState(null);
  const [containerId, setContainerId] = useState(null);
  const [seedlings, setSeedlings] = useState('1');
  const [containerCount, setContainerCount] = useState('1');
  const [name, setName] = useState('');

  const [openMenu, setOpenMenu] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
    setError('');

    Promise.all([
      supabase.from('growspaces').select('*').order('created_at'),
      fetchContainersWithUsage().catch(() => []),
    ]).then(([growspaceRows, containerRows]) => {
      setGrowspaces(growspaceRows.data ?? []);
      setContainers(containerRows);
      // With a single growspace there is nothing to choose, so it's preselected.
      if (growspaceRows.data?.length === 1) setGrowspaceId(growspaceRows.data[0].id);
    });
  }, [visible, available, sowing]);

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

  const handleTransplant = async () => {
    if (!seedlingCount || seedlingCount < 1 || seedlingCount > available) {
      setError(`Pick between 1 and ${available} seedlings`);
      return;
    }
    if (!potCount || potCount < 1 || potCount > seedlingCount) {
      setError('Containers must be between 1 and the number of seedlings');
      return;
    }
    if (!growspaceId) {
      setError('Pick a growspace');
      return;
    }
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await transplant({
        userId: session.user.id,
        sowing,
        cells,
        seedlingCount,
        growspaceId,
        containerId,
        containerCount: potCount,
        name: name.trim(),
      });
      onDone();
    } catch (transplantError) {
      setError(transplantError.message);
    }
    setSaving(false);
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

            <ErrorText>{error}</ErrorText>
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button onPress={handleTransplant} loading={saving} disabled={saving || available === 0}>
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
