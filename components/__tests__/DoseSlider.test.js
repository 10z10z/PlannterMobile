import { act, renderWithProviders, screen } from '../../test/render';
import DoseSlider from '../DoseSlider';

/**
 * The slider, driven the way TalkBack drives it.
 *
 * The drag stays uncovered and can't easily be otherwise: it is a
 * `PanResponder` reading finger coordinates against a width that `onLayout`
 * never reports in a test renderer. What is covered is the path added for
 * everyone who can't drag — the `adjustable` role, the figure it announces, and
 * the nudge that moves it.
 *
 * Those nudges are delivered by calling `onAccessibilityAction` rather than
 * through `fireEvent`, which silently does nothing for this event: it finds the
 * handler and declines to dispatch, so an assertion written the obvious way
 * passes for the wrong reason — every "was not called" is trivially true when
 * nothing is ever called. The prop is as much this component's public contract
 * as `onPress` is, and the platform's accessibility bridge invokes it exactly
 * like this, so calling it is the real path rather than a way round one.
 */

const nudge = async (node, actionName) => {
  await act(async () => {
    node.props.onAccessibilityAction({ nativeEvent: { actionName } });
  });
};

async function openSlider(props = {}) {
  const onChange = jest.fn();
  await renderWithProviders(
    <DoseSlider value={1} onChange={onChange} max={5} label="CalMag dose" unit="ml/L" {...props} />
  );
  return { onChange, slider: screen.getByLabelText('CalMag dose') };
}

describe('DoseSlider', () => {
  it('announces itself as something that can be adjusted', async () => {
    const { slider } = await openSlider();

    expect(slider.props.accessibilityRole).toBe('adjustable');
    // The figure with its unit, so it isn't read out as a bare number.
    expect(slider.props.accessibilityValue).toEqual({ min: 0, max: 5, now: 1, text: '1 ml/L' });
    expect(slider.props.accessibilityActions.map((a) => a.name)).toEqual([
      'increment',
      'decrement',
    ]);
  });

  it('moves in steps big enough to cross the range', async () => {
    const { slider, onChange } = await openSlider();

    // A twentieth of a 0-5 track, snapped to the step: 0.3, not the drag's 0.1.
    // Fifty swipes from nothing to full is a control nobody would use twice.
    await nudge(slider, 'increment');
    expect(onChange).toHaveBeenCalledWith(1.3);
  });

  it('goes back down again', async () => {
    const { slider, onChange } = await openSlider();

    await nudge(slider, 'decrement');
    expect(onChange).toHaveBeenCalledWith(0.7);
  });

  it('stops at the top rather than running past it', async () => {
    const { slider, onChange } = await openSlider({ value: 5 });

    await nudge(slider, 'increment');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('stops at the bottom too', async () => {
    const { slider, onChange } = await openSlider({ value: 0 });

    await nudge(slider, 'decrement');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does nothing at all when disabled', async () => {
    const { slider, onChange } = await openSlider({ disabled: true });

    expect(slider.props.accessibilityState).toEqual({ disabled: true });
    await nudge(slider, 'increment');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('lands on a value the slider could reach by dragging', async () => {
    // Awkward on purpose: a value off the step grid still has to snap back onto
    // it, or the figure announced stops matching where the thumb can sit.
    const { slider, onChange } = await openSlider({ value: 0.7, max: 3, step: 0.25 });

    await nudge(slider, 'increment');
    expect(onChange).toHaveBeenCalledWith(1);
  });
});
