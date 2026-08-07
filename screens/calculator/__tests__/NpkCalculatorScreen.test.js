jest.mock('../../../lib/supabase');

import AsyncStorage from '@react-native-async-storage/async-storage';
import { fake } from '../../../test/fakeSupabase';
import { fireEvent, renderWithProviders, screen, settle } from '../../../test/render';
import NpkCalculatorScreen from '../NpkCalculatorScreen';

/**
 * The calculator, driven the way it is used rather than the way it is built.
 *
 * Everything asserted here is something on screen: a ppm figure, the reading a
 * meter is predicted to show, the note saying whether that prediction is a
 * guess. Nothing reaches for state or for a hook, so the extraction of
 * `useNpkMix` that this screen is waiting for can happen underneath without
 * touching a line of it — which is the point of writing it first.
 *
 * The dose slider is deliberately not driven. It is a bare `PanResponder` with
 * no accessibility role, so a test can't reach it and neither can TalkBack; the
 * two ways of setting a dose that don't need it — "Suggest for stage" and
 * reverse mode's poured amounts — cover the same arithmetic.
 */

/** A 10-5-20 feed as the bag prints it: 10% N, 5% P₂O₅, 20% K₂O. */
const FEED = {
  id: 'fert-1',
  user_id: 'user-1',
  name: 'Grow A',
  form: 'liquid',
  n: 10,
  p: 5,
  k: 20,
  fertigation_dose_min: 1,
  fertigation_dose_max: 4,
  created_at: '2026-08-01T00:00:00.000Z',
};

const press = async (label) => {
  await fireEvent.press(screen.getByText(label));
  await settle();
};

const type = async (label, value) => {
  await fireEvent.changeText(screen.getByLabelText(label), value);
  await settle();
};

/**
 * Open the calculator with one bottle picked and 8 ml of it in a 4 litre tank —
 * 2 ml/L, which is a round enough dose to check the arithmetic against by hand.
 */
async function pourTheTank() {
  await renderWithProviders(<NpkCalculatorScreen />);
  await screen.findAllByText('Grow A');

  await press('Reverse calc');
  await type('Water in the tank (L)', '4');
  await type('Amount poured (ml)', '8');
}

const openSettings = async () => {
  await fireEvent.press(screen.getByLabelText('Calculator settings'));
  await settle();
};

describe('NpkCalculatorScreen', () => {
  beforeEach(async () => {
    fake.reset();
    await AsyncStorage.clear();
    fake.seed('fertilizers', FEED);
  });

  it('reports what a poured tank actually delivered', async () => {
    await pourTheTank();

    // 2 ml/L of a 10-5-20 bag. Nitrogen is quoted as the element and goes
    // straight through; the other two are oxides and don't.
    expect(screen.getByText('N 200 · P 43.64 · K 332.06 ppm')).toBeOnTheScreen();
    expect(screen.getByText('575.7 ppm')).toBeOnTheScreen();
  });

  it('says what a meter should read, and admits when that is a guess', async () => {
    await pourTheTank();

    // 575.7 ppm of nutrient at the uncalibrated 420 ppm per mS/cm is EC 1.37,
    // which a 700-scale meter shows as 959.
    expect(screen.getByText(/Meter should read ≈ 959 ppm on the 700/)).toBeOnTheScreen();
    expect(screen.getByText(/EC ≈ 1.37 mS\/cm/)).toBeOnTheScreen();
    expect(screen.getByText(/Uncalibrated, so that reading is a rough guess/)).toBeOnTheScreen();
  });

  it('follows the scale the grower says their meter is on', async () => {
    await pourTheTank();
    await openSettings();

    // The same solution, a different meter: EC 1.37 on the 500 scale is 685.
    await press('500 · NaCl');
    expect(screen.getByText(/Meter should read ≈ 685 ppm on the 500/)).toBeOnTheScreen();
  });

  it('takes a meter that is on none of the usual scales', async () => {
    await pourTheTank();
    await openSettings();

    await press('Other');
    await type('Conversion factor (ppm per mS/cm)', '450');

    expect(screen.getByText(/Meter should read ≈ 617 ppm on the 450/)).toBeOnTheScreen();
  });

  it('learns the grower’s own figure from one measured batch', async () => {
    await pourTheTank();
    await openSettings();

    // The tank really measured 690, not the 959 that was predicted from a
    // typical figure. The reading is the truth and the factor gives way to it.
    await type('Measured reading (ppm)', '690');
    await press('Use this reading');

    expect(screen.getByText(/Calibrated: 584 ppm of nutrient per mS\/cm/)).toBeOnTheScreen();

    await press('Done');

    // Within rounding of the 690 that was measured, where it was 959 before.
    expect(screen.getByText(/Meter should read ≈ 693 ppm on the 700/)).toBeOnTheScreen();
    expect(screen.queryByText(/Uncalibrated/)).toBeNull();
  });

  it('will not calibrate on a reading that was never entered', async () => {
    await pourTheTank();
    await openSettings();

    // Nothing typed, so there is nothing to learn from and the default stands.
    await press('Use this reading');
    expect(screen.getByText(/Not calibrated/)).toBeOnTheScreen();
  });

  it('keeps the meter across a restart, since it belongs to the grower', async () => {
    await pourTheTank();
    await openSettings();
    await type('Measured reading (ppm)', '690');
    await press('Use this reading');
    await press('Done');

    // A fresh mount, as if the app had been closed and reopened.
    await pourTheTank();
    expect(screen.getByText(/Meter should read ≈ 693 ppm on the 700/)).toBeOnTheScreen();
  });

  it('hands the mix to the feeding dialog already filled in', async () => {
    await pourTheTank();

    await press('Save as a feeding');

    // The receiving end of this is covered in FeedingDialog's own tests with a
    // preset written by hand; what is checked here is that the calculator
    // builds the same shape out of a real mix — the dose it worked out, in the
    // units it was read in, and the tank it was actually poured into.
    expect(await screen.findByText('Log a feeding')).toBeOnTheScreen();
    expect(screen.getByLabelText('Grow A (ml/L)').props.value).toBe('2');
    expect(screen.getByLabelText('Batch mixed (L, optional)').props.value).toBe('4');
  });

  it('offers nothing to save until something is in the water', async () => {
    await renderWithProviders(<NpkCalculatorScreen />);
    await screen.findAllByText('Grow A');

    // The one bottle picks itself, but at no dose — so there is a mix on screen
    // with nothing in it. Pressing does nothing rather than opening a dialog
    // that would have no products to record.
    await press('Save as a feeding');
    expect(screen.queryByText('Log a feeding')).toBeNull();

    // Give it a dose and the same button works.
    await press('Suggest for stage');
    await press('Save as a feeding');
    expect(await screen.findByText('Log a feeding')).toBeOnTheScreen();
  });

  it('doses a bottle from the stage it is being grown for', async () => {
    await renderWithProviders(<NpkCalculatorScreen />);
    await screen.findAllByText('Grow A');

    // Nothing dialled in yet, so nothing is in the water.
    expect(screen.getByText('0.0 ml/L')).toBeOnTheScreen();

    await press('Suggest for stage');

    // A 10-5-20 bag is potassium-heavy once the oxide comes off it, so the dose
    // that scores best is the one that puts K in its band — 182 ppm against a
    // 150-200 target — and leaves nitrogen short rather than overshooting
    // potassium to chase it. That compromise is the whole job of the scoring.
    expect(screen.getByText('1.1 ml/L')).toBeOnTheScreen();
    expect(screen.getByText('N 110 · P 24 · K 182.63 ppm')).toBeOnTheScreen();
  });
});
