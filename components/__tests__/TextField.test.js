import { useState } from 'react';
import { fireEvent, renderWithProviders, screen } from '../../test/render';
import TextField from '../TextField';

/**
 * The bug this component exists for: a parent slow to hand the value back used
 * to reset the field to the stale one, and text typed fast came out reversed.
 * A test can't be slow the way a busy JS thread is, but it can be a parent that
 * never sends anything back, which is the same thing taken to its limit.
 */
function StuckParent({ onChangeText }) {
  return <TextField testID="field" label="Name" value="" onChangeText={onChangeText} />;
}

/** The ordinary case: a parent that does hold the value it is given. */
function ControlledParent() {
  const [value, setValue] = useState('');
  return (
    <>
      <TextField testID="field" label="Name" value={value} onChangeText={setValue} />
      <TextField testID="echo" label="Echo" value={value} onChangeText={() => {}} />
    </>
  );
}

describe('TextField', () => {
  it('keeps what was typed even when the parent never sends it back', async () => {
    const onChangeText = jest.fn();
    await renderWithProviders(<StuckParent onChangeText={onChangeText} />);

    await fireEvent.changeText(screen.getByTestId('field'), 'Basil');

    expect(screen.getByTestId('field').props.value).toBe('Basil');
    expect(onChangeText).toHaveBeenCalledWith('Basil');
  });

  it('tells the parent what was typed', async () => {
    await renderWithProviders(<ControlledParent />);

    await fireEvent.changeText(screen.getByTestId('field'), 'Basil');

    expect(screen.getByTestId('echo').props.value).toBe('Basil');
  });

  it('takes a value the parent genuinely sets, which is what filling a form in is', async () => {
    const { rerender } = await renderWithProviders(<TextField testID="field" value="Basil" />);

    await rerender(<TextField testID="field" value="Thyme" />);

    expect(screen.getByTestId('field').props.value).toBe('Thyme');
  });

  it('empties when a dialog resets it', async () => {
    const { rerender } = await renderWithProviders(<TextField testID="field" value="Basil" />);

    await rerender(<TextField testID="field" value="" />);

    expect(screen.getByTestId('field').props.value).toBe('');
  });
});
