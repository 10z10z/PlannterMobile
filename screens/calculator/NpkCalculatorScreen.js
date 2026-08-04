import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  Appbar,
  Button,
  Card,
  Chip,
  Dialog,
  Divider,
  Portal,
  SegmentedButtons,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useUnits } from '../../contexts/UnitsContext';
import { doseUnit, formatDose, parseDose, parseVolume, volumeUnit } from '../../lib/units';
import {
  MACRO_KEYS,
  STAGE_KEYS,
  STAGE_LABELS,
  macroBars,
  microBars,
  mixParts,
  perLiterDose,
  ppmFromMix,
  suggestedDose,
  waterContribution,
  waterFromReport,
  WATER_PART_ID,
} from '../../lib/nutrients';
import { mixColor } from '../../lib/mixColors';
import NutrientTargetBar from '../../components/NutrientTargetBar';
import DoseSlider from '../../components/DoseSlider';

const WATER_KEYS = {
  source: 'waterSource',
  hardness: 'waterHardnessPpm',
  ca: 'waterCaPpm',
  mg: 'waterMgPpm',
};

function toNumber(text) {
  if (text === null || text === undefined || String(text).trim() === '') return 0;
  const value = Number(String(text).replace(',', '.'));
  return Number.isNaN(value) ? 0 : value;
}

/**
 * How far a product's dose slider can be pushed, in the user's own units.
 *
 * The label's own top fertigation rate is the honest anchor; doubling it leaves
 * room to deliberately overfeed while keeping the useful part of the travel in
 * the middle of the track. Products with no rate recorded fall back to a range
 * that covers most bottled feeds.
 */
function sliderMax(fertilizer, system) {
  const labelMax =
    Number(fertilizer?.fertigation_dose_max) || Number(fertilizer?.foliar_dose_max) || 0;
  const perLiter = labelMax > 0 ? labelMax * 2 : 5;
  return Math.max(1, Math.ceil(toNumber(formatDose(perLiter, system))));
}

/**
 * One product's row in the mix: its colour, whatever control sets its dose, and
 * what it actually put in the water.
 *
 * Both modes render it, so a mix reads the same whether the dose was dialled in
 * with a slider or measured back out of a tank that has already been poured.
 */
function ProductCard({ name, color, readout, control, part, total, action }) {
  const share = total > 0 ? Math.round((part.total / total) * 100) : 0;

  return (
    <Card style={styles.doseCard}>
      <Card.Content>
        <View style={styles.totalRow}>
          <View style={styles.nameRow}>
            <View style={[styles.swatch, { backgroundColor: color }]} />
            <Text variant="bodyMedium">{name}</Text>
          </View>
          {readout}
        </View>

        {control}

        <Text variant="bodySmall" style={styles.range}>
          N {part.n} · P {part.p} · K {part.k} ppm
        </Text>
        <View style={styles.doseFooter}>
          <Text variant="bodySmall" style={styles.range}>
            Adds {part.total} ppm · {share}% of the mix
          </Text>
          {action}
        </View>
      </Card.Content>
    </Card>
  );
}

/**
 * Two ways round the same sum, both working off the user's own fertilizer
 * panels: "Target ppm" picks doses and checks them against the stage's
 * recommended band, "Reverse" takes a mix that was already poured and reports
 * what it actually delivered. Either way several products can go into the same
 * water, and every figure describes the resulting mixture rather than any one
 * bottle.
 */
export default function NpkCalculatorScreen() {
  const { system } = useUnits();
  const theme = useTheme();

  const [fertilizers, setFertilizers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  // Doses are held in the unit the user reads; the maths converts to per litre.
  const [doses, setDoses] = useState({});
  const [amounts, setAmounts] = useState({});

  const [mode, setMode] = useState('target');
  const [stage, setStage] = useState('vegetative');
  const [volumeText, setVolumeText] = useState('4');
  const [showMicros, setShowMicros] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [waterSource, setWaterSource] = useState('hardness'); // 'hardness' | 'report'
  const [hardnessText, setHardnessText] = useState('');
  const [caText, setCaText] = useState('');
  const [mgText, setMgText] = useState('');

  // The tap is a property of where the grower lives, not of any one mix, so all
  // of this outlives the screen.
  useEffect(() => {
    AsyncStorage.multiGet(Object.values(WATER_KEYS)).then((pairs) => {
      const stored = Object.fromEntries(pairs);
      if (stored[WATER_KEYS.source] === 'report') setWaterSource('report');
      if (stored[WATER_KEYS.hardness]) setHardnessText(stored[WATER_KEYS.hardness]);
      if (stored[WATER_KEYS.ca]) setCaText(stored[WATER_KEYS.ca]);
      if (stored[WATER_KEYS.mg]) setMgText(stored[WATER_KEYS.mg]);
    });
  }, []);

  const closeSettings = () => {
    setSettingsOpen(false);
    AsyncStorage.multiSet([
      [WATER_KEYS.source, waterSource],
      [WATER_KEYS.hardness, hardnessText],
      [WATER_KEYS.ca, caText],
      [WATER_KEYS.mg, mgText],
    ]);
  };

  const hardness = toNumber(hardnessText);
  // Both sets of figures are kept, so switching back and forth doesn't lose
  // whichever one isn't in play.
  // Memoised because it is an object: rebuilding it every render would make the
  // mix results downstream recompute every render too.
  const water = useMemo(
    () =>
      waterSource === 'report'
        ? waterFromReport(toNumber(caText), toNumber(mgText))
        : waterContribution(hardness),
    [waterSource, caText, mgText, hardness]
  );

  // The hardness explainer needs something to illustrate the split with, so an
  // unset field falls back to a middling reading rather than showing zeroes.
  const example = hardness > 0 ? hardness : 150;
  const exampleWater = waterContribution(example);

  const fetchFertilizers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('fertilizers')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) {
      setFertilizers(data);
      // Keep the selection valid across edits and deletions made in Inventory.
      const ids = new Set(data.map((f) => f.id));
      setSelectedIds((current) => {
        const kept = current.filter((id) => ids.has(id));
        if (kept.length) return kept;
        return data[0] ? [data[0].id] : [];
      });
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchFertilizers();
    }, [fetchFertilizers])
  );

  const selected = useMemo(
    () => selectedIds.map((id) => fertilizers.find((f) => f.id === id)).filter(Boolean),
    [selectedIds, fertilizers]
  );

  /** The stage's suggested dose, in display units, for a newly added product. */
  const defaultDose = useCallback(
    (fertilizer) => {
      const perLiter = suggestedDose(fertilizer, stage);
      if (perLiter === null) return 1;
      return toNumber(formatDose(perLiter, system));
    },
    [stage, system]
  );

  const toggleFertilizer = (fertilizer) => {
    const isSelected = selectedIds.includes(fertilizer.id);
    setSelectedIds(
      isSelected ? selectedIds.filter((id) => id !== fertilizer.id) : [...selectedIds, fertilizer.id]
    );
    if (!isSelected && doses[fertilizer.id] === undefined) {
      setDoses({ ...doses, [fertilizer.id]: defaultDose(fertilizer) });
    }
  };

  const setDose = (id, value) => setDoses((current) => ({ ...current, [id]: value }));

  const batchVolumeLiters = parseVolume(volumeText, system) ?? 0;

  const mixEntries = useMemo(
    () =>
      selected.map((fertilizer) => ({
        fertilizer,
        dosePerLiter:
          mode === 'target'
            ? parseDose(String(doses[fertilizer.id] ?? 0), system) ?? 0
            : perLiterDose(toNumber(amounts[fertilizer.id]), batchVolumeLiters),
      })),
    [selected, doses, amounts, mode, system, batchVolumeLiters]
  );

  const result = useMemo(() => ppmFromMix(mixEntries, water), [mixEntries, water]);
  const parts = useMemo(() => mixParts(mixEntries, water), [mixEntries, water]);
  const bars = useMemo(() => macroBars(result, stage, parts), [result, stage, parts]);
  const micros = useMemo(() => microBars(result, parts), [result, parts]);

  // Colour by position in the mix, so a product keeps its colour across the
  // sliders, the stacked bars and the contribution list.
  const colors = useMemo(
    () => ({
      // Water gets a neutral grey rather than a palette slot — it is the
      // baseline the fertilizers are stacked on, not one of them.
      [WATER_PART_ID]: theme.colors.outline,
      ...Object.fromEntries(selected.map((f, index) => [f.id, mixColor(index)])),
    }),
    [selected, theme.colors.outline]
  );
  const contribution = useMemo(
    () => Object.fromEntries(parts.map((part) => [part.id, part.result])),
    [parts]
  );

  const hasMacros = selected.some((f) => MACRO_KEYS.some((key) => Number(f?.[key]) > 0));

  // Reverse mode wants the bands as much as target mode does: "here is what I
  // poured" only means something next to what the stage was asking for.
  const stageChips = (
    <>
      <View style={[styles.sectionLabel, styles.totalRow]}>
        <Text variant="labelLarge" style={styles.sectionLabelText}>
          Growth stage
        </Text>
        <Text variant="labelLarge" style={{ color: theme.colors.primary }}>
          {STAGE_LABELS[stage]}
        </Text>
      </View>
      <View style={styles.chips}>
        {STAGE_KEYS.map((key) => {
          const isOn = key === stage;
          return (
            <Chip
              key={key}
              compact
              mode={isOn ? 'flat' : 'outlined'}
              elevated={isOn}
              selected={isOn}
              showSelectedCheck={false}
              selectedColor={theme.colors.onPrimary}
              onPress={() => setStage(key)}
              style={isOn ? { backgroundColor: theme.colors.primary } : styles.chipOff}
              textStyle={
                isOn ? [styles.chipTextOn, { color: theme.colors.onPrimary }] : styles.chipTextOff
              }
            >
              {STAGE_LABELS[key]}
            </Chip>
          );
        })}
      </View>
    </>
  );

  const fertilizerChips = (
    <>
      <View style={[styles.sectionLabel, styles.totalRow]}>
        <Text variant="labelLarge" style={styles.sectionLabelText}>
          Fertilizers in the mix
        </Text>
        {selected.length > 0 && (
          <Text variant="labelLarge" style={{ color: theme.colors.primary }}>
            {selected.length} selected
          </Text>
        )}
      </View>
      <View style={styles.chips}>
        {fertilizers.map((f) => {
          const isOn = selectedIds.includes(f.id);
          return (
            <Chip
              key={f.id}
              compact
              mode={isOn ? 'flat' : 'outlined'}
              selected={isOn}
              showSelectedCheck={false}
              icon={isOn ? 'check' : undefined}
              selectedColor={theme.colors.onPrimaryContainer}
              onPress={() => toggleFertilizer(f)}
              // A softer fill than the stage row, so the loudest thing on screen
              // stays the one stage the whole calculation is judged against.
              style={
                isOn ? { backgroundColor: theme.colors.primaryContainer } : styles.chipOff
              }
              textStyle={
                isOn
                  ? [styles.chipTextOn, { color: theme.colors.onPrimaryContainer }]
                  : styles.chipTextOff
              }
            >
              {f.name}
            </Chip>
          );
        })}
      </View>
      {selected.length === 0 && (
        <Text variant="bodySmall" style={styles.note}>
          Pick one or more products — everything below describes the combined solution.
        </Text>
      )}
    </>
  );

  const resultCard = (
    <>
      <Card style={styles.card}>
        <Card.Content>
          {bars.map((bar) => (
            <NutrientTargetBar key={bar.key} bar={bar} colors={colors} />
          ))}
          <Divider style={styles.divider} />
          <View style={styles.totalRow}>
            <Text variant="bodyMedium">Total dissolved</Text>
            <Text variant="bodyMedium">
              {result.total} ppm · EC {result.ec} mS/cm
            </Text>
          </View>
          {water && (
            <View style={[styles.totalRow, styles.waterRow]}>
              <View style={styles.nameRow}>
                <View style={[styles.swatch, { backgroundColor: theme.colors.outline }]} />
                <Text variant="bodySmall" style={styles.range}>
                  Source water ·{' '}
                  {waterSource === 'report' ? 'from report' : `${hardness} ppm hardness`}
                </Text>
              </View>
              <Text variant="bodySmall" style={styles.range}>
                Ca {Math.round(water.ca)} · Mg {Math.round(water.mg)} ppm
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.totalRow}>
            <Text variant="labelLarge">Micronutrients</Text>
            <Button compact mode="text" onPress={() => setShowMicros((v) => !v)}>
              {showMicros ? 'Hide' : 'Show'}
            </Button>
          </View>
          {showMicros && (
            <>
              <Text variant="bodySmall" style={styles.microNote}>
                Secondary and trace targets hold steady across stages.
              </Text>
              {micros.map((bar) => (
                <NutrientTargetBar key={bar.key} bar={bar} compact colors={colors} />
              ))}
              <Divider style={styles.divider} />
              <View style={styles.totalRow}>
                <Text variant="bodyMedium">Micro total</Text>
                <Text variant="bodyMedium">{result.microTotal} ppm</Text>
              </View>
            </>
          )}
        </Card.Content>
      </Card>

      <Text variant="bodySmall" style={styles.note}>
        Target bands are typical hydroponic ranges, not advice for a particular plant. Your species,
        medium, water and light will all shift what "on target" really means — treat them as a
        starting point and trust what the plants tell you.
      </Text>
    </>
  );

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.Content title="NPK Calculator" />
        <Appbar.Action icon="cog-outline" onPress={() => setSettingsOpen(true)} />
      </Appbar.Header>

      {!loading && fertilizers.length === 0 ? (
        <View style={styles.empty}>
          <Text variant="bodyMedium" style={styles.emptyText}>
            Add a fertilizer under Inventory first — the calculator works off your own nutrient
            panels.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <SegmentedButtons
            value={mode}
            onValueChange={setMode}
            buttons={[
              { value: 'target', label: 'Target ppm' },
              { value: 'reverse', label: 'Reverse calc' },
            ]}
          />

          {stageChips}

          {mode === 'target' ? (
            <>
              {fertilizerChips}

              {selected.map((f) => {
                const unit = doseUnit(f.form, system);
                const dose = doses[f.id] ?? 0;
                const suggested = suggestedDose(f, stage);
                const color = colors[f.id];
                return (
                  <ProductCard
                    key={f.id}
                    name={f.name}
                    color={color}
                    part={contribution[f.id]}
                    total={result.total}
                    readout={
                      <Text variant="bodyMedium">
                        {/* Fixed to one decimal so the readout doesn't jitter mid-drag. */}
                        {Number(dose).toFixed(1)} {unit}
                      </Text>
                    }
                    control={
                      <DoseSlider
                        value={dose}
                        onChange={(value) => setDose(f.id, value)}
                        max={sliderMax(f, system)}
                        color={color}
                      />
                    }
                    action={
                      <Button
                        compact
                        mode="text"
                        disabled={suggested === null}
                        onPress={() => setDose(f.id, toNumber(formatDose(suggested, system)))}
                      >
                        Suggest for stage
                      </Button>
                    }
                  />
                );
              })}
            </>
          ) : (
            <>
              {fertilizerChips}

              <TextInput
                label={`Water in the tank (${volumeUnit(system)})`}
                value={volumeText}
                onChangeText={setVolumeText}
                keyboardType="decimal-pad"
                dense
                style={styles.volumeField}
              />

              {selected.map((f) => {
                const unit = doseUnit(f.form, system);
                const massUnit = f.form === 'solid' ? 'g' : 'ml';
                const perLiter = perLiterDose(toNumber(amounts[f.id]), batchVolumeLiters);
                return (
                  <ProductCard
                    key={f.id}
                    name={f.name}
                    color={colors[f.id]}
                    part={contribution[f.id]}
                    total={result.total}
                    readout={
                      <Text variant="bodyMedium">
                        {formatDose(perLiter, system)} {unit}
                      </Text>
                    }
                    control={
                      <TextInput
                        label={`Amount poured (${massUnit})`}
                        value={amounts[f.id] ?? ''}
                        onChangeText={(text) => setAmounts({ ...amounts, [f.id]: text })}
                        keyboardType="decimal-pad"
                        dense
                        style={styles.amountField}
                      />
                    }
                  />
                );
              })}
            </>
          )}

          {resultCard}

          {selected.length > 0 && !hasMacros && (
            <Text variant="bodySmall" style={styles.note}>
              Nothing in this mix has N-P-K percentages recorded, so there is nothing to compare
              against the stage targets.
            </Text>
          )}
        </ScrollView>
      )}

      <Portal>
        <Dialog visible={settingsOpen} onDismiss={closeSettings}>
          <Dialog.Title>Calculator settings</Dialog.Title>
          <Dialog.Content>
            <Text variant="labelLarge" style={styles.sectionLabelText}>
              Source water
            </Text>
            <SegmentedButtons
              value={waterSource}
              onValueChange={setWaterSource}
              style={styles.waterSwitch}
              buttons={[
                { value: 'hardness', label: 'Hardness' },
                { value: 'report', label: 'Water report' },
              ]}
            />

            {waterSource === 'hardness' ? (
              <>
                <TextInput
                  label="Water hardness (ppm as CaCO₃)"
                  value={hardnessText}
                  onChangeText={setHardnessText}
                  keyboardType="decimal-pad"
                  dense
                />
                <Text variant="bodySmall" style={styles.note}>
                  Taken as the calcium and magnesium already in the tap before anything is added,
                  split three parts calcium to one part magnesium — the usual ratio for a domestic
                  supply. At {example} ppm that is about {Math.round(exampleWater.ca)} ppm Ca and{' '}
                  {Math.round(exampleWater.mg)} ppm Mg.
                </Text>
              </>
            ) : (
              <>
                <View style={styles.reportRow}>
                  <TextInput
                    label="Calcium (ppm)"
                    value={caText}
                    onChangeText={setCaText}
                    keyboardType="decimal-pad"
                    dense
                    style={styles.reportField}
                  />
                  <TextInput
                    label="Magnesium (ppm)"
                    value={mgText}
                    onChangeText={setMgText}
                    keyboardType="decimal-pad"
                    dense
                    style={styles.reportField}
                  />
                </View>
                <Text variant="bodySmall" style={styles.note}>
                  Measured figures from a lab analysis or your utility's annual report, used as
                  given — no estimating. If the report quotes calcium as CaCO₃ rather than Ca,
                  divide it by 2.5 first.
                </Text>
              </>
            )}

            <Text variant="bodySmall" style={styles.note}>
              Leave the fields empty for rainwater or RO. Both sets of numbers are kept, so
              switching between the two doesn't lose either.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={closeSettings}>Done</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.6,
  },
  sectionLabel: {
    marginTop: 16,
    marginBottom: 6,
  },
  // The heading dims, but the value beside it must not go with it.
  sectionLabelText: {
    opacity: 0.7,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chipOff: {
    backgroundColor: 'transparent',
  },
  chipTextOn: {
    fontWeight: '600',
  },
  chipTextOff: {
    opacity: 0.7,
  },
  doseCard: {
    marginTop: 12,
  },
  doseFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  swatch: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  waterRow: {
    marginTop: 4,
  },
  waterSwitch: {
    marginTop: 8,
    marginBottom: 12,
  },
  reportRow: {
    flexDirection: 'row',
    gap: 8,
  },
  reportField: {
    flex: 1,
  },
  range: {
    opacity: 0.6,
  },
  volumeField: {
    marginTop: 16,
  },
  amountField: {
    marginBottom: 10,
  },
  card: {
    marginTop: 16,
  },
  divider: {
    marginBottom: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  microNote: {
    opacity: 0.6,
    marginBottom: 10,
  },
  note: {
    marginTop: 8,
    opacity: 0.6,
  },
});
