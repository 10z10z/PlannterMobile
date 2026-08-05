import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
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
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useUnits } from '../../contexts/UnitsContext';
import { formatVolume } from '../../lib/units';
import { materialLabel } from '../../lib/containers';
import { fetchTraysWithUsage, trayGridLabel } from '../../lib/trays';
import { createSowing, originalSeedsPerCell } from '../../lib/germination';
import DateField, { toDateString } from '../../components/DateField';

/**
 * Sowing a seed pack into a tray or a single container. The seeds are taken out
 * of the pack on save, so the form shows what the sowing will cost against
 * what's left before it's committed.
 *
 * `template` is an existing sowing to copy, for sowing the same thing again. It
 * fills the form in rather than saving straight away: the seed pack may have run
 * low and the tray may be in use since, and both are worth seeing before
 * committing. Everything is still editable, and the date resets to today.
 */
export default function SowingFormDialog({ visible, onDismiss, onSaved, stationId, template }) {
  const { session } = useAuth();
  const { system } = useUnits();

  const [seedPacks, setSeedPacks] = useState([]);
  const [trays, setTrays] = useState([]);
  const [containers, setContainers] = useState([]);

  const [seedPack, setSeedPack] = useState(null);
  const [target, setTarget] = useState('tray');
  const [tray, setTray] = useState(null);
  const [container, setContainer] = useState(null);
  const [seedsPerCell, setSeedsPerCell] = useState('1');
  const [sownOn, setSownOn] = useState(toDateString(new Date()));

  const [openMenu, setOpenMenu] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setSeedPack(null);
    setTarget(template?.container_id ? 'container' : 'tray');
    setTray(null);
    setContainer(null);
    setSeedsPerCell(template ? String(originalSeedsPerCell(template.grid)) : '1');
    setSownOn(toDateString(new Date()));
    setError('');

    Promise.all([
      supabase.from('seed_packs').select('*').order('name'),
      fetchTraysWithUsage().catch(() => []),
      supabase.from('containers').select('*').order('volume_liters'),
    ]).then(([packs, trayRows, containerRows]) => {
      const packRows = packs.data ?? [];
      const containerList = containerRows.data ?? [];
      setSeedPacks(packRows);
      setTrays(trayRows);
      setContainers(containerList);

      // Resolved once the lists are in, and only to rows that still exist —
      // a pack or tray deleted since the original sowing simply comes up blank
      // rather than preselecting something that isn't there.
      if (!template) return;
      setSeedPack(packRows.find((pack) => pack.id === template.seed_pack_id) ?? null);
      setTray(trayRows.find((entry) => entry.id === template.tray_id) ?? null);
      setContainer(containerList.find((entry) => entry.id === template.container_id) ?? null);
    });
  }, [visible, template]);

  const perCell = parseInt(seedsPerCell, 10);
  const cellCount = target === 'tray' ? (tray ? tray.grid_rows * tray.grid_cols : null) : 1;
  const totalSeeds = cellCount && perCell > 0 ? cellCount * perCell : null;

  const describeContainer = (entry) =>
    `${formatVolume(entry.volume_liters, system)} ${materialLabel(entry.material)}`;

  const handleSave = async () => {
    if (!seedPack) {
      setError('Pick a seed pack');
      return;
    }
    if (target === 'tray' && !tray) {
      setError('Pick a tray');
      return;
    }
    if (target === 'container' && !container) {
      setError('Pick a container');
      return;
    }
    if (!perCell || perCell < 1) {
      setError('Seeds must be at least 1');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await createSowing({
        userId: session.user.id,
        stationId,
        seedPack,
        tray: target === 'tray' ? tray : null,
        container: target === 'container' ? container : null,
        seedsPerCell: perCell,
        sownOn,
      });
      onSaved();
    } catch (saveError) {
      setError(saveError.message);
    }
    setSaving(false);
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
                    setSeedPack(pack);
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
                      setTray(entry);
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
                  <Button mode="outlined" icon="cup-outline" onPress={() => setOpenMenu('container')}>
                    {container ? describeContainer(container) : 'Pick a container'}
                  </Button>
                }
              >
                {containers.map((entry) => (
                  <Menu.Item
                    key={entry.id}
                    title={describeContainer(entry)}
                    onPress={() => {
                      setContainer(entry);
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

            <DateField label="Sown on" value={sownOn} onChange={setSownOn} maximumDate={new Date()} />

            {!!error && <Text style={styles.errorText}>{error}</Text>}
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button onPress={handleSave} loading={saving} disabled={saving}>
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
  errorText: {
    color: 'red',
    marginTop: 8,
  },
});
