import { renderWithProviders, screen } from '../../test/render';
import FormField from '../FormField';

describe('FormField', () => {
  it('shows the hint when nothing is wrong', async () => {
    await renderWithProviders(
      <FormField label="Quantity" value="1" hint="One entry covers a set." />
    );

    expect(screen.getByText('One entry covers a set.')).toBeOnTheScreen();
  });

  it('replaces the hint with the error rather than stacking them', async () => {
    await renderWithProviders(
      <FormField label="Quantity" value="" hint="One entry covers a set." error="Required." />
    );

    expect(screen.getByText('Required.')).toBeOnTheScreen();
    expect(screen.queryByText('One entry covers a set.')).not.toBeOnTheScreen();
  });

  it('says nothing at all when it has neither', async () => {
    await renderWithProviders(<FormField label="Name" value="" />);

    // The helper line is absent rather than blank — a field with nothing to say
    // must not push the rest of a dialog down by a line. The wrapper holds the
    // input and nothing else.
    expect(screen.root.children).toHaveLength(1);
  });
});
