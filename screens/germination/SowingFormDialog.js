import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import {
  Button,
  Dialog,
  HelperText,
  Menu,
  Portal,
  SegmentedButtons,
  Text,
} from 'react-native-paper';
import TextField from '../../components/TextField';
import { useUnits } from '../../contexts/UnitsContext';
import { formatVolume } from '../../lib/units';
import { materialLabel } from '../../lib/containers';
import { trayGridLabel } from '../../lib/trays';
import { messageFor } from '../../lib/errors';
import { useInventory } from '../../hooks/useInventory';
import { useDataMutation } from '../../hooks/useDataMutation';
import { createSowing, originalSeedsPerCell } from '../../lib/germination';
import DateField, { toDateString } from '../../components/DateField';
import ErrorText from '../../components/ErrorText';

/**
 * Sowing a seed pack into a tray or a single container. The seeds are taken out
 * of the pack on save, so the form shows what the sowing will cost against
 * what's left before it's committed.
 *
 * `template` is an existing sowing to copy, for sowing the same thing again. It
 * fills the form in rather than saving straight away: the seed pack may have run
 * low and the tray may be in use since, and both are worth seeing before
 * committing. Everything is still editable, and the date resets to today.
 *
 * `seedPackId` does the lighter version of the same thing for a sowing that was
 * planned on the calendar: the pack is chosen, and nothing else is assumed.
 *
 * @param {object} props
 * @param {boolean} props.visible
 * @param {() => void} props.onDismiss
 * @param {() => void} props.onSaved
 * @param {string} [props.stationId] The station to sow into, when one is known.
 * @param {object} [props.template] An existing sowing to copy into the form.
 * @param {string} [props.seedPackId] Preselects the pack, for a planned sowing.
 */
export default function SowingFormDialog({
  visible,
  onDismiss,
  onSaved,
  stationId,
  template,
  seedPackId,
}) {
  const { system } = useUnits();

  // Alphabetical for the pickers; the shelves themselves are newest first.
  const byName = (a, b) => a.name.localeCompare(b.name);
  const packShelf = useInventory('seedPacks');
  const trayShelf = useInventory('trays');
  const containerShelf = useInventory('containers');

  const seedPacks = useMemo(() => [...(packShelf.data ?? [])].sort(byName), [packShelf.data]);
  const trays = useMemo(() => [...(trayShelf.data ?? [])].sort(byName), [trayShelf.data]);
  const containers = useMemo(
    () => [...(containerShelf.data ?? [])].sort((a, b) => a.volume_liters - b.volume_liters),
    [containerShelf.data]
  );

  /**
   * What is picked is held as an id rather than the row itself.
   *
   * The lists come from the cache now, and can arrive after this dialog opens
   * or change underneath it while it's up. Keeping the id and looking the row
   * up on each render means the form follows the shelf — and a pack deleted
   * mid-edit simply comes up blank rather than leaving a stale copy selected.
   */
  const [packId, setPackId] = useState(null);
  const [trayId, setTrayId] = useState(null);
  const [containerId, setContainerId] = useState(null);
  const [target, setTarget] = useState('tray');
  const [seedsPerCell, setSeedsPerCell] = useState('1');
  const [sownOn, setSownOn] = useState(toDateString(new Date()));

  const seedPack = seedPacks.find((pack) => pack.id === packId) ?? null;
  const tray = trays.find((entry) => entry.id === trayId) ?? null;
  const container = containers.find((entry) => entry.id === containerId) ?? null;

  const [openMenu, setOpenMenu] = useState(null);
  // Only what this form checks itself; anything the server objects to arrives
  // on the mutation, and both are shown in the same place.
  const [validationError, setValidationError] = useState('');

  const sow = useDataMutation({
    mutationFn: createSowing,
    affects: 'sowingCreated',
    onSuccess: onSaved,
  });
  const resetSow = sow.reset;

  useEffect(() => {
    if (!visible) return;
    setTarget(template?.container_id ? 'container' : 'tray');
    setSeedsPerCell(template ? String(originalSeedsPerCell(template.grid)) : '1');
    setSownOn(toDateString(new Date()));
    setValidationError('');
    resetSow();

    // Sowing again from an existing sowing carries its pack and its tray over;
    // a sowing planned on the calendar brings only the pack. Either way these
    // are ids, so a row that has since been deleted resolves to nothing rather
    // than to a stale copy of itself.
    setPackId(template?.seed_pack_id ?? seedPackId ?? null);
    setTrayId(template?.tray_id ?? null);
    setContainerId(template?.container_id ?? null);
  }, [visible, template, seedPackId, resetSow]);

  const perCell = parseInt(seedsPerCell, 10);
  const cellCount = target === 'tray' ? (tray ? tray.grid_rows * tray.grid_cols : null) : 1;
  const totalSeeds = cellCount && perCell > 0 ? cellCount * perCell : null;

  const describeContainer = (entry) =>
    `${formatVolume(entry.volume_liters, system)} ${materialLabel(entry.material)}`;

  const handleSave = () => {
    if (!seedPack) {
      setValidationError('Pick a seed pack');
      return;
    }
    if (target === 'tray' && !tray) {
      setValidationError('Pick a tray');
      return;
    }
    if (target === 'container' && !container) {
      setValidationError('Pick a container');
      return;
    }
    if (!perCell || perCell < 1) {
      setValidationError('Seeds must be at least 1');
      return;
    }

    setValidationError('');
    sow.mutate({
      stationId,
      seedPack,
      tray: target === 'tray' ? tray : null,
      container: target === 'container' ? container : null,
      seedsPerCell: perCell,
      sownOn,
    });
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>{template ? 'Sow again' : 'New Sowing'}</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text variant="labelLarge" style={styles.label}>
              Seed pack
            </Text>
            <Menu
              visible={openMenu === 'seeds'}
              onDismiss={() => setOpenMenu(null)}
              anchor={
                <Button mode="outlined" icon="seed-outline" onPress={() => setOpenMenu('seeds')}>
                  {seedPack ? seedPack.name : 'Pick a seed pack'}
                </Button>
              }
            >
              {seedPacks.map((pack) => (
                <Menu.Item
                  key={pack.id}
                  title={
                    pack.seed_count === null ? pack.name : `${pack.name} (${pack.seed_count} left)`
                  }
                  onPress={() => {
                    setPackId(pack.id);
                    setOpenMenu(null);
                  }}
                />
              ))}
              {seedPacks.length === 0 && <Menu.Item title="No seed packs in inventory" disabled />}
            </Menu>

            <Text variant="labelLarge" style={styles.label}>
              Sow into
            </Text>
            <SegmentedButtons
              value={target}
              onValueChange={setTarget}
              buttons={[
                { value: 'tray', label: 'Tray' },
                { value: 'container', label: 'Container' },
              ]}
              style={styles.input}
            />

            {target === 'tray' ? (
              <Menu
                visible={openMenu === 'tray'}
                onDismiss={() => setOpenMenu(null)}
                anchor={
                  <Button mode="outlined" icon="grid" onPress={() => setOpenMenu('tray')}>
                    {tray ? `${tray.name} · ${trayGridLabel(tray)}` : 'Pick a tray'}
                  </Button>
                }
              >
                {trays.map((entry) => (
                  <Menu.Item
                    key={entry.id}
                    title={`${entry.name} · ${trayGridLabel(entry)}`}
                    trailingIcon={
                      entry.inUse >= entry.quantity ? 'alert-circle-outline' : undefined
                    }
                    onPress={() => {
                      setTrayId(entry.id);
                      setOpenMenu(null);
                    }}
                  />
                ))}
                {trays.length === 0 && <Menu.Item title="No trays in inventory" disabled />}
              </Menu>
            ) : (
              <Menu
                visible={openMenu === 'container'}
                onDismiss={() => setOpenMenu(null)}
                anchor={
                  <Button
                    mode="outlined"
                    icon="cup-outline"
                    onPress={() => setOpenMenu('container')}
                  >
                    {container ? describeContainer(container) : 'Pick a container'}
                  </Button>
                }
              >
                {containers.map((entry) => (
                  <Menu.Item
                    key={entry.id}
                    title={describeContainer(entry)}
                    onPress={() => {
                      setContainerId(entry.id);
                      setOpenMenu(null);
                    }}
                  />
                ))}
                {containers.length === 0 && (
                  <Menu.Item title="No containers in inventory" disabled />
                )}
              </Menu>
            )}

            <TextField
              label={target === 'tray' ? 'Seeds per cell' : 'Seeds'}
              value={seedsPerCell}
              onChangeText={setSeedsPerCell}
              keyboardType="number-pad"
              style={[styles.input, styles.spacedInput]}
            />
            {!!totalSeeds && (
              <HelperText type="info">
                {`${totalSeeds} seeds in total`}
                {seedPack?.seed_count !== null && seedPack
                  ? `, leaving ${seedPack.seed_count - totalSeeds} in the pack`
                  : ''}
              </HelperText>
            )}

            <DateField
              label="Sown on"
              value={sownOn}
              onChange={setSownOn}
              maximumDate={new Date()}
            />

            <ErrorText>{validationError || (sow.isError ? messageFor(sow.error) : '')}</ErrorText>
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button onPress={handleSave} loading={sow.isPending} disabled={sow.isPending}>
            Sow
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
    marginTop: 8,
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
