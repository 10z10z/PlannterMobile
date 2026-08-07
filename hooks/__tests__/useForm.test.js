import { Button } from 'react-native-paper';
import { fireEvent, renderWithProviders, screen } from '../../test/render';
import FormField from '../../components/FormField';
import { text, whole } from '../../lib/validation';
import useForm from '../useForm';

/**
 * When errors appear is the decision `useForm` exists to make, and it is only
 * visible through a rendered form: whether a message is on screen after a blur,
 * after a save, or while still typing is not something the values it returns can
 * be asked. So the tests drive a form built the way every dialog in the app
 * builds one — `form.field(name)` spread onto a `FormField` — and read what a
 * user would see.
 */
const schema = {
  name: text({ label: 'Name', required: true }),
  quantity: whole({ label: 'Quantity', required: true, min: 1, max: 99 }),
};

/** A check that no single field could make, which is what `checks` are for. */
const pairCheck = (values) =>
  values.name === 'basil' && values.quantity > 10
    ? { field: 'quantity', message: 'Nobody needs that much basil' }
    : null;

function TestForm({ onValid = () => {}, checks = [] }) {
  const form = useForm(schema, { checks });

  return (
    <>
      <FormField testID="name" label="Name" {...form.field('name')} />
      <FormField testID="quantity" label="Quantity" {...form.field('quantity')} />
      <Button testID="save" onPress={() => form.submit(onValid)} disabled={!form.canSubmit}>
        Save
      </Button>
    </>
  );
}

const save = () => screen.getByTestId('save');
const type = (field, value) => fireEvent.changeText(screen.getByTestId(field), value);
const leave = (field) => fireEvent(screen.getByTestId(field), 'blur');

describe('useForm', () => {
  it('says nothing about a field still being typed into', async () => {
    await renderWithProviders(<TestForm />);

    await type('name', 'B');

    expect(screen.queryByText('Name is required')).not.toBeOnTheScreen();
  });

  it('checks a field once it is left', async () => {
    await renderWithProviders(<TestForm />);

    await type('quantity', '0');
    await leave('quantity');

    expect(screen.getByText('Quantity must be between 1 and 99')).toBeOnTheScreen();
  });

  it('leaves the button live on an untouched form, since a dead one explains nothing', async () => {
    await renderWithProviders(<TestForm />);

    expect(save()).toBeEnabled();
  });

  it('shows every problem at once when save is pressed', async () => {
    const onValid = jest.fn();
    await renderWithProviders(<TestForm onValid={onValid} />);

    await fireEvent.press(save());

    expect(screen.getByText('Name is required')).toBeOnTheScreen();
    expect(screen.getByText('Quantity is required')).toBeOnTheScreen();
    expect(onValid).not.toHaveBeenCalled();
  });

  it('disables save after that first press, and only then', async () => {
    await renderWithProviders(<TestForm />);

    await fireEvent.press(save());

    expect(save()).toBeDisabled();
  });

  it('re-checks a field that is already wrong as it is typed into', async () => {
    await renderWithProviders(<TestForm />);

    await fireEvent.press(save());
    await type('name', 'Basil');

    // Without waiting to be left again — the point is that the button can come
    // back the moment the last problem is fixed.
    expect(screen.queryByText('Name is required')).not.toBeOnTheScreen();
  });

  it('brings the button back once the last problem is fixed', async () => {
    await renderWithProviders(<TestForm />);

    await fireEvent.press(save());
    await type('name', 'Basil');
    await type('quantity', '12');

    expect(save()).toBeEnabled();
  });

  it('hands over converted values, not the strings that were typed', async () => {
    const onValid = jest.fn();
    await renderWithProviders(<TestForm onValid={onValid} />);

    await type('name', '  Basil  ');
    await type('quantity', '12');
    await fireEvent.press(save());

    expect(onValid).toHaveBeenCalledWith({ name: 'Basil', quantity: 12 });
  });

  it('reports a cross-field check against the field it names', async () => {
    const onValid = jest.fn();
    await renderWithProviders(<TestForm onValid={onValid} checks={[pairCheck]} />);

    await type('name', 'basil');
    await type('quantity', '40');
    await fireEvent.press(save());

    expect(screen.getByText('Nobody needs that much basil')).toBeOnTheScreen();
    expect(onValid).not.toHaveBeenCalled();
  });
});
