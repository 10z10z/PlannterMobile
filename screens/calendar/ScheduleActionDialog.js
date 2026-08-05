import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, Dialog, HelperText, Menu, Portal, Text } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import TextField from '../../components/TextField';
import DateField, { toDateString } from '../../components/DateField';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { fetchPlaces, placeIcon, placeIds, placeOf } from '../../lib/places';
import { fetchSowings } from '../../lib/germination';
import {
  SCHEDULE_KINDS,
  allowsWholePlace,
  formatMinutes,
  minutesOf,
  saveScheduledAction,
  targetKindFor,
  targetSummary,
} from '../../lib/scheduling';
import ErrorText from '../../components/ErrorText';

/**
 * Plans an action for a day, with an optional reminder at a time.
 *
 * Nothing is written to the growing data here: on the day, the entry opens the
 * form the action is normally done through, prefilled with what was planned.
 * The seed pack is therefore a hint rather than a commitment — it is what the
 * sowing form will start from, and it can still be changed or have run out.
 *
 * A growspace and a station are both just places to plan for, so both are on
 * the one list: the calendar this opens from no longer takes a side.
 */
export default function ScheduleActionDialog({
  visible,
  action,
  defaultDate,
  onDismiss,
  onDone,
}) {
  const { session } = useAuth();

  const [places, setPlaces] = useState([]);
  const [seedPacks, setSeedPacks] = useState([]);
  // What there is to aim at in the place currently picked, and which of it is.
  const [choices, setChoices] = useState([]);
  const [chosenIds, setChosenIds] = useState([]);

  const [kind, setKind] = useState('sow');
  const [placeId, setPlaceId] = useState(null);
  const [subject, setSubject] = useState('');
  const [seedPackId, setSeedPackId] = useState(null);
  const [dueOn, setDueOn] = useState(toDateString(new Date()));
  const [dueMinutes, setDueMinutes] = useState(null);
  const [note, setNote] = useState('');

  const [openMenu, setOpenMenu] = useState(null);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setKind(action?.kind ?? 'feed');
    setSubject(action?.subject ?? '');
    setSeedPackId(action?.seed_pack_id ?? null);
    setDueOn(action?.due_on ?? defaultDate ?? toDateString(new Date()));
    setDueMinutes(action?.due_minutes ?? null);
    setNote(action?.note ?? '');
    setChosenIds(
      (action?.targets ?? []).map((target) => target.plant_id ?? target.sowing_id).filter(Boolean)
    );
    setError('');

    Promise.all([
      fetchPlaces(),
      supabase.from('seed_packs').select('id, name, seed_count').order('name'),
    ]).then(([placeList, packRows]) => {
      setPlaces(placeList);
      setSeedPacks(packRows.data ?? []);
      setPlaceId(
        placeOf(placeList, action)?.id ?? (placeList.length === 1 ? placeList[0].id : null)
      );
    });
    // Read when the dialog opens, like every other form in the app: what is
    // being edited cannot change underneath it while it is up.
  }, [visible]);

  const place = places.find((entry) => entry.id === placeId);
  const seedPack = seedPacks.find((pack) => pack.id === seedPackId);
  const targetKind = targetKindFor(kind, place?.type);

  /**
   * What this kind can be aimed at where it is being done: the plants standing
   * in a growspace, or the sowings in a station.
   *
   * Reloaded when the place or the kind changes, and the selection is pared
   * back to what the new list actually holds — moving a plan from one tent to
   * another must not leave it pointing at plants standing somewhere else.
   */
  useEffect(() => {
    if (!visible || !place || !targetKind) {
      setChoices([]);
      return;
    }

    const load =
      targetKind === 'plants'
        ? supabase
            .from('plants')
            .select('id, name')
            .eq('growspace_id', place.id)
            .order('created_at')
            .then(({ data }) => (data ?? []).map((row) => ({ id: row.id, label: row.name })))
        : fetchSowings(place.id).then((sowings) =>
            sowings.map((sowing) => ({
              id: sowing.id,
              label: sowing.seed_pack_name,
              detail: sowing.tray?.name ?? null,
            }))
          );

    load.then((rows) => {
      setChoices(rows);
      const ids = new Set(rows.map((row) => row.id));
      setChosenIds((current) => current.filter((id) => ids.has(id)));
    });
  }, [visible, place?.id, targetKind]);

  const toggleTarget = (id) =>
    setChosenIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    );

  // The picked rows as the target list, each carrying the name it had when it
  // was planned so the entry still reads after the row is gone.
  const chosen = choices.filter((choice) => chosenIds.includes(choice.id));
  const targets = chosen.map((choice) => ({
    [targetKind === 'plants' ? 'plantId' : 'sowingId']: choice.id,
    label: choice.label,
  }));

  // What the plan is called, if nothing was typed: the things it is aimed at.
  // Saves typing "Basil, Chilli" under a picker that already says so.
  const impliedSubject = targetSummary(targets) ?? (kind === 'sow' ? seedPack?.name : place?.name);

  const handleSave = async () => {
    if (!place) {
      setError('Pick a growspace or station');
      return;
    }
    if (targetKind && !allowsWholePlace(kind) && targets.length === 0) {
      setError(targetKind === 'plants' ? 'Pick the plants' : 'Pick what to work on');
      return;
    }
    const name = subject.trim() || impliedSubject?.trim();
    if (!name) {
      setError('Say what this is for');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await saveScheduledAction({
        userId: session.user.id,
        id: action?.id,
        kind,
        dueOn,
        dueMinutes,
        ...placeIds(place),
        subject: name,
        note,
        seedPackId: kind === 'sow' ? seedPackId : null,
        targets,
      });
      onDone();
    } catch (saveError) {
      setError(saveError.message);
    }
    setSaving(false);
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>{action ? 'Edit planned action' : 'Schedule an action'}</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text variant="labelLarge" style={styles.label}>
              Action
            </Text>
            <View style={styles.chips}>
              {SCHEDULE_KINDS.map((entry) => (
                <Chip
                  key={entry.value}
                  compact
                  icon={entry.icon}
                  mode={entry.value === kind ? 'flat' : 'outlined'}
                  selected={entry.value === kind}
                  showSelectedCheck={false}
                  onPress={() => setKind(entry.value)}
                >
                  {entry.label}
                </Chip>
              ))}
            </View>

            <Text variant="labelLarge" style={styles.label}>
              Where
            </Text>
            <Menu
              visible={openMenu === 'place'}
              onDismiss={() => setOpenMenu(null)}
              anchor={
                <Button
                  mode="outlined"
                  icon={placeIcon(place?.type)}
                  onPress={() => setOpenMenu('place')}
                >
                  {place ? place.name : 'Pick a growspace or station'}
                </Button>
              }
            >
              {places.map((entry) => (
                <Menu.Item
                  key={entry.id}
                  title={entry.name}
                  leadingIcon={placeIcon(entry.type)}
                  onPress={() => {
                    setPlaceId(entry.id);
                    setOpenMenu(null);
                  }}
                />
              ))}
              {places.length === 0 && <Menu.Item title="Nothing to plan for yet" disabled />}
            </Menu>

            {kind === 'sow' && (
              <>
                <Text variant="labelLarge" style={styles.label}>
                  Seed pack (optional)
                </Text>
                <Menu
                  visible={openMenu === 'pack'}
                  onDismiss={() => setOpenMenu(null)}
                  anchor={
                    <Button mode="outlined" icon="seed-outline" onPress={() => setOpenMenu('pack')}>
                      {seedPack ? seedPack.name : 'Pick a seed pack'}
                    </Button>
                  }
                >
                  <Menu.Item
                    title="No pack chosen yet"
                    onPress={() => {
                      setSeedPackId(null);
                      setOpenMenu(null);
                    }}
                  />
                  {seedPacks.map((pack) => (
                    <Menu.Item
                      key={pack.id}
                      title={
                        pack.seed_count === null ? pack.name : `${pack.name} (${pack.seed_count} left)`
                      }
                      onPress={() => {
                        setSeedPackId(pack.id);
                        // The pack names the job unless something was typed.
                        setSubject((current) => current.trim() || pack.name);
                        setOpenMenu(null);
                      }}
                    />
                  ))}
                  {seedPacks.length === 0 && <Menu.Item title="No seed packs in inventory" disabled />}
                </Menu>
              </>
            )}

            {targetKind && (
              <>
                <Text variant="labelLarge" style={styles.label}>
                  {targetKind === 'plants' ? 'Which plants' : 'Which sowings'}
                </Text>
                {choices.length === 0 ? (
                  <HelperText type="info">
                    {targetKind === 'plants'
                      ? 'No plants in this growspace yet.'
                      : 'Nothing sown in this station yet.'}
                  </HelperText>
                ) : (
                  <>
                    <View style={styles.chips}>
                      {choices.map((choice) => {
                        const isOn = chosenIds.includes(choice.id);
                        return (
                          <Chip
                            key={choice.id}
                            compact
                            mode={isOn ? 'flat' : 'outlined'}
                            selected={isOn}
                            showSelectedCheck={false}
                            icon={isOn ? 'check' : undefined}
                            onPress={() => toggleTarget(choice.id)}
                          >
                            {choice.label}
                          </Chip>
                        );
                      })}
                    </View>
                    <HelperText type="info">
                      {chosenIds.length > 0
                        ? `${targetSummary(targets, { limit: 3 })} on the day.`
                        : allowsWholePlace(kind)
                          ? `Nothing picked means the whole of ${place?.name ?? 'the place'}.`
                          : 'Pick what this is for.'}
                    </HelperText>
                  </>
                )}
              </>
            )}

            <TextField
              label="What"
              placeholder={impliedSubject || 'Chilli, the whole tent, the front bed…'}
              value={subject}
              onChangeText={setSubject}
              style={[styles.input, styles.spacedInput]}
            />

            <DateField label="On" value={dueOn} onChange={setDueOn} />

            <Text variant="labelLarge" style={styles.label}>
              Remind me
            </Text>
            <View style={styles.timeRow}>
              <Button mode="outlined" icon="clock-outline" onPress={() => setTimePickerOpen(true)}>
                {formatMinutes(dueMinutes) ?? 'No reminder'}
              </Button>
              {dueMinutes !== null && (
                <Button mode="text" onPress={() => setDueMinutes(null)}>
                  Clear
                </Button>
              )}
            </View>
            <HelperText type="info">
              {dueMinutes === null
                ? 'Without a time this is a note on the day, with no notification.'
                : 'A notification on this device at that time. Nothing is planted for you.'}
            </HelperText>

            <TextField
              label="Note (optional)"
              value={note}
              onChangeText={setNote}
              style={styles.input}
            />

            <ErrorText>{error}</ErrorText>
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button onPress={handleSave} loading={saving} disabled={saving}>
            Save
          </Button>
        </Dialog.Actions>
      </Dialog>

      {timePickerOpen && (
        <DateTimePicker
          value={
            new Date(
              2000,
              0,
              1,
              Math.floor((dueMinutes ?? 480) / 60),
              (dueMinutes ?? 480) % 60
            )
          }
          mode="time"
          onChange={(event, selected) => {
            setTimePickerOpen(false);
            if (event.type === 'set' && selected) setDueMinutes(minutesOf(selected));
          }}
        />
      )}
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  input: {
    marginBottom: 8,
  },
  spacedInput: {
    marginTop: 12,
  },
});
