import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  Appbar,
  Button,
  Card,
  Chip,
  Dialog,
  Divider,
  FAB,
  Portal,
  SegmentedButtons,
  Text,
  useTheme,
} from 'react-native-paper';
import TextField from '../../components/TextField';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUnits } from '../../contexts/UnitsContext';
import QueryBoundary from '../../components/QueryBoundary';
import { useInventory } from '../../hooks/useInventory';
import { doseUnit, formatDose, parseDose, parseVolume, volumeUnit } from '../../lib/units';
import { parseDecimal } from '../../lib/numbers';
import {
  DEFAULT_EC_SCALE,
  DEFAULT_NUTRIENT_PPM_PER_EC,
  EC_SCALES,
  MACRO_KEYS,
  STAGE_KEYS,
  STAGE_LABELS,
  calibrationFactor,
  ecFromMeterPpm,
  estimateEc,
  macroBars,
  meterPpmFor,
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
import ScreenTitle from '../../components/ScreenTitle';
import FeedingDialog from '../calendar/FeedingDialog';

const WATER_KEYS = {
  source: 'waterSource',
  hardness: 'waterHardnessPpm',
  ca: 'waterCaPpm',
  mg: 'waterMgPpm',
};

/**
 * The meter, which belongs to the grower rather than to any one mix — so like
 * the tap, it is stored rather than asked for again each time.
 */
const METER_KEYS = {
  scale: 'meterScale',
  perEc: 'nutrientPpmPerEc',
};

/** The scale values that get their own button; anything else is typed in. */
const PRESET_SCALES = EC_SCALES.map((scale) => scale.value);

/**
 * A typed figure as a number, treating both blank and rubbish as zero.
 *
 * The calculator recomputes on every keystroke, so it has to have an answer for
 * a half-typed field rather than an error — a mix showing nothing while "1." is
 * being typed would flicker on every entry.
 */
function toNumber(text) {
  const value = parseDecimal(text);
  return value === null || Number.isNaN(value) ? 0 : value;
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
 *
 * @param {object} props
 * @param {string} props.name
 * @param {string} props.color
 * @param {import('react').ReactNode} props.readout
 * @param {import('react').ReactNode} props.control
 * @param {import('../../lib/nutrients').NutrientResult} props.part
 * @param {number} props.total
 * @param {import('react').ReactNode} [props.action] Trailing button, if the mode has one.
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

  const shelf = useInventory('fertilizers');
  const fertilizers = useMemo(() => shelf.data ?? [], [shelf.data]);
  const [selectedIds, setSelectedIds] = useState([]);
  // Doses are held in the unit the user reads; the maths converts to per litre.
  const [doses, setDoses] = useState({});
  const [amounts, setAmounts] = useState({});

  const [mode, setMode] = useState('target');
  const [stage, setStage] = useState('vegetative');
  const [volumeText, setVolumeText] = useState('4');
  const [showMicros, setShowMicros] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [feedOpen, setFeedOpen] = useState(false);
  const [waterSource, setWaterSource] = useState('hardness'); // 'hardness' | 'report'
  const [hardnessText, setHardnessText] = useState('');
  const [caText, setCaText] = useState('');
  const [mgText, setMgText] = useState('');

  // What the grower's meter is, and what it has taught the calculator so far.
  const [scaleText, setScaleText] = useState(String(DEFAULT_EC_SCALE));
  // Whether the scale is being typed rather than picked. Held rather than
  // derived from the value: a custom field cleared back to empty falls through
  // to the default, which is itself a preset, and the field would close under
  // the fingers of the person emptying it.
  const [customScale, setCustomScale] = useState(false);
  const [perEcText, setPerEcText] = useState(String(DEFAULT_NUTRIENT_PPM_PER_EC));
  // The reading being calibrated from, which is not stored: it belongs to the
  // batch on screen, not to the meter.
  const [readingText, setReadingText] = useState('');
  const [readingUnit, setReadingUnit] = useState('ppm'); // 'ppm' | 'ec'

  // The tap is a property of where the grower lives, not of any one mix, so all
  // of this outlives the screen.
  useEffect(() => {
    AsyncStorage.multiGet([...Object.values(WATER_KEYS), ...Object.values(METER_KEYS)]).then(
      (pairs) => {
        const stored = Object.fromEntries(pairs);
        if (stored[WATER_KEYS.source] === 'report') setWaterSource('report');
        if (stored[WATER_KEYS.hardness]) setHardnessText(stored[WATER_KEYS.hardness]);
        if (stored[WATER_KEYS.ca]) setCaText(stored[WATER_KEYS.ca]);
        if (stored[WATER_KEYS.mg]) setMgText(stored[WATER_KEYS.mg]);
        if (stored[METER_KEYS.scale]) {
          setScaleText(stored[METER_KEYS.scale]);
          // A stored scale that isn't one of the buttons was typed in, so the
          // sheet reopens on the field it was typed into.
          setCustomScale(!PRESET_SCALES.includes(Number(stored[METER_KEYS.scale])));
        }
        if (stored[METER_KEYS.perEc]) setPerEcText(stored[METER_KEYS.perEc]);
      }
    );
  }, []);

  const closeSettings = () => {
    setSettingsOpen(false);
    AsyncStorage.multiSet([
      [WATER_KEYS.source, waterSource],
      [WATER_KEYS.hardness, hardnessText],
      [WATER_KEYS.ca, caText],
      [WATER_KEYS.mg, mgText],
      [METER_KEYS.scale, scaleText],
      [METER_KEYS.perEc, perEcText],
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

  /**
   * Keeps the selection valid across edits and deletions made in Inventory.
   *
   * The shelf is now shared cache rather than this screen's own fetch, so a
   * product deleted from the inventory tab lands here without the calculator
   * asking — which is the point, but it does mean a mix can be left pointing at
   * a bottle that no longer exists.
   */
  useEffect(() => {
    if (!shelf.data) return;
    const ids = new Set(shelf.data.map((fertilizer) => fertilizer.id));
    setSelectedIds((current) => {
      const kept = current.filter((id) => ids.has(id));
      if (kept.length) return kept;
      return shelf.data[0] ? [shelf.data[0].id] : [];
    });
  }, [shelf.data]);

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
      isSelected
        ? selectedIds.filter((id) => id !== fertilizer.id)
        : [...selectedIds, fertilizer.id]
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
            ? (parseDose(String(doses[fertilizer.id] ?? 0), system) ?? 0)
            : perLiterDose(toNumber(amounts[fertilizer.id]), batchVolumeLiters),
      })),
    [selected, doses, amounts, mode, system, batchVolumeLiters]
  );

  const result = useMemo(() => ppmFromMix(mixEntries, water), [mixEntries, water]);

  // A blank or half-typed field falls back to the defaults rather than to zero,
  // so the readout keeps working while the settings sheet is being filled in.
  const meterScale = toNumber(scaleText) || DEFAULT_EC_SCALE;
  const nutrientPerEc = toNumber(perEcText) || DEFAULT_NUTRIENT_PPM_PER_EC;
  const isCalibrated = nutrientPerEc !== DEFAULT_NUTRIENT_PPM_PER_EC;

  const estimatedEc = estimateEc(result.total, nutrientPerEc);
  const expectedReading = meterPpmFor(estimatedEc, meterScale);

  /** The conductivity behind whatever was typed into the calibration field. */
  const measuredEc =
    readingUnit === 'ec'
      ? toNumber(readingText)
      : ecFromMeterPpm(toNumber(readingText), meterScale);
  const pendingFactor = calibrationFactor(result.total, measuredEc);

  /**
   * Take the reading as the truth and work backwards to what this grower's
   * bottles and meter actually do — which is the only figure here that isn't
   * an assumption about somebody else's fertilizer.
   */
  const applyCalibration = () => {
    if (pendingFactor === null) return;
    setPerEcText(String(pendingFactor));
    setReadingText('');
  };

  const resetCalibration = () => {
    setPerEcText(String(DEFAULT_NUTRIENT_PPM_PER_EC));
    setReadingText('');
  };

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
              style={isOn ? { backgroundColor: theme.colors.primaryContainer } : styles.chipOff}
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

  /**
   * The mix as the calendar records it: the products and the rates they were
   * worked out at, per litre. A tank measured back out in reverse mode brings
   * its volume along too, since that one really was poured.
   */
  const feedPreset = {
    products: mixEntries
      .filter((entry) => entry.dosePerLiter > 0)
      .map((entry) => ({
        fertilizer_id: entry.fertilizer.id,
        fertilizer_name: entry.fertilizer.name,
        form: entry.fertilizer.form,
        dose_per_liter: entry.dosePerLiter,
      })),
    volumeLiters: mode === 'reverse' && batchVolumeLiters > 0 ? batchVolumeLiters : null,
  };

  const resultCard = (
    <>
      <Card style={styles.card}>
        <Card.Content>
          {bars.map((bar) => (
            <NutrientTargetBar key={bar.key} bar={bar} colors={colors} />
          ))}
          <Divider style={styles.divider} />
          <View style={styles.totalRow}>
            <Text variant="bodyMedium">Nutrients delivered</Text>
            <Text variant="bodyMedium">{result.total} ppm</Text>
          </View>
          {/* The figure above counts nutrients; a meter weighs every ion in the
              tank and will read higher. This line is the one to hold a meter
              against, which is why it says which meter it means. */}
          {result.total > 0 && (
            <View style={[styles.totalRow, styles.waterRow]}>
              <Text variant="bodySmall" style={styles.range}>
                Meter should read ≈{' '}
                {expectedReading === null ? '—' : `${expectedReading} ppm on the ${meterScale}`}
              </Text>
              <Text variant="bodySmall" style={styles.range}>
                EC ≈ {estimatedEc} mS/cm
              </Text>
            </View>
          )}
          {result.total > 0 && !isCalibrated && (
            <Text variant="bodySmall" style={styles.note}>
              Uncalibrated, so that reading is a rough guess. Measure one batch and enter it under
              settings to make it yours.
            </Text>
          )}
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
        medium, water and light will all shift what “on target” really means — treat them as a
        starting point and trust what the plants tell you.
      </Text>
    </>
  );

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.Content
          title={<ScreenTitle icon="calculator-variant-outline" label="NPK Calculator" />}
        />
        <Appbar.Action
          icon="cog-outline"
          accessibilityLabel="Calculator settings"
          onPress={() => setSettingsOpen(true)}
        />
      </Appbar.Header>

      <QueryBoundary
        query={shelf}
        isEmpty={fertilizers.length === 0}
        emptyIcon="bottle-tonic-outline"
        emptyText="Add a fertilizer under Inventory first — the calculator works off your own nutrient panels."
        errorText="Couldn’t load your fertilizers."
      >
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

              <TextField
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
                      <TextField
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
      </QueryBoundary>

      {/* The calculator works out a mix; this is what turns one that was
          actually poured into a dated entry on the growspace calendar. It
          floats rather than sitting at the end of the scroll, because the one
          action the screen exists to produce shouldn't be the hardest thing on
          it to reach. */}
      {fertilizers.length > 0 && (
        <FAB
          icon="cup-water"
          label="Save as a feeding"
          onPress={() => setFeedOpen(true)}
          disabled={feedPreset.products.length === 0}
          style={styles.fab}
        />
      )}

      <FeedingDialog
        visible={feedOpen}
        preset={feedPreset}
        onDismiss={() => setFeedOpen(false)}
        onDone={() => setFeedOpen(false)}
      />

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
                <TextField
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
                  <TextField
                    label="Calcium (ppm)"
                    value={caText}
                    onChangeText={setCaText}
                    keyboardType="decimal-pad"
                    dense
                    style={styles.reportField}
                  />
                  <TextField
                    label="Magnesium (ppm)"
                    value={mgText}
                    onChangeText={setMgText}
                    keyboardType="decimal-pad"
                    dense
                    style={styles.reportField}
                  />
                </View>
                <Text variant="bodySmall" style={styles.note}>
                  Measured figures from a lab analysis or your utility’s annual report, used as
                  given — no estimating. If the report quotes calcium as CaCO₃ rather than Ca,
                  divide it by 2.5 first.
                </Text>
              </>
            )}

            <Text variant="bodySmall" style={styles.note}>
              Leave the fields empty for rainwater or RO. Both sets of numbers are kept, so
              switching between the two doesn’t lose either.
            </Text>

            <Divider style={styles.divider} />

            <Text variant="labelLarge" style={styles.sectionLabelText}>
              Your meter
            </Text>
            <SegmentedButtons
              value={customScale ? 'custom' : String(meterScale)}
              onValueChange={(value) => {
                setCustomScale(value === 'custom');
                // Switching to Other keeps the figure that was showing, so it
                // is something to edit rather than an empty box.
                if (value !== 'custom') setScaleText(value);
              }}
              style={styles.waterSwitch}
              buttons={[
                ...EC_SCALES.map((scale) => ({
                  value: String(scale.value),
                  label: scale.label,
                })),
                { value: 'custom', label: 'Other' },
              ]}
            />
            {customScale && (
              <TextField
                label="Conversion factor (ppm per mS/cm)"
                value={scaleText}
                onChangeText={setScaleText}
                keyboardType="decimal-pad"
                dense
              />
            )}
            <Text variant="bodySmall" style={styles.note}>
              A meter measures conductivity and multiplies it by this to get the ppm it shows, so
              two meters in the same jug can disagree by 40%. It is on the box, in the manual, or
              switchable on the meter itself.
            </Text>

            <Text variant="labelLarge" style={styles.sectionLabelText}>
              Calibration
            </Text>
            <Text variant="bodySmall" style={styles.note}>
              This mix works out at {result.total} ppm of nutrient. Mix it for real, measure it, and
              enter what the meter said — everything the label can’t tell us goes into one number.
            </Text>
            <SegmentedButtons
              value={readingUnit}
              onValueChange={setReadingUnit}
              style={styles.waterSwitch}
              buttons={[
                { value: 'ppm', label: 'ppm' },
                { value: 'ec', label: 'EC' },
              ]}
            />
            <TextField
              label={readingUnit === 'ec' ? 'Measured EC (mS/cm)' : 'Measured reading (ppm)'}
              value={readingText}
              onChangeText={setReadingText}
              keyboardType="decimal-pad"
              dense
            />
            <View style={styles.calibrateRow}>
              <Button mode="contained-tonal" onPress={applyCalibration} disabled={!pendingFactor}>
                Use this reading
              </Button>
              {isCalibrated && <Button onPress={resetCalibration}>Reset</Button>}
            </View>
            <Text variant="bodySmall" style={styles.note}>
              {isCalibrated
                ? `Calibrated: ${nutrientPerEc} ppm of nutrient per mS/cm.`
                : `Not calibrated — using ${DEFAULT_NUTRIENT_PPM_PER_EC} ppm per mS/cm, which is a
                   typical figure rather than yours.`}
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
    // Clears the floating save button, so the closing note isn't sat on.
    paddingBottom: 96,
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
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
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
  calibrateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
});
