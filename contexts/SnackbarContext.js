import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Portal, Snackbar } from 'react-native-paper';

const SnackbarContext = createContext(null);

/**
 * One place for the app to say what just happened, and offer to take it back.
 *
 * There was no toast layer at all before this, which is why every destructive
 * action in the app asks first: a confirmation is what you build when you have
 * nowhere to put an apology. Confirmations are the right answer for the ones
 * that can't be undone — deleting a plant cancels its reminders and files a
 * calendar entry, and unpicking that is not a snackbar's job — but they are the
 * wrong answer for an action the data model already reverses.
 *
 * One message at a time, deliberately. A queue would mean the undo a grower is
 * reaching for slides away while three others take their turn; replacing means
 * the offer on screen is always for the thing that just happened.
 */
export function SnackbarProvider({ children }) {
  const [current, setCurrent] = useState(null);

  /**
   * @param {string} message
   * @param {{ label: string, onPress: () => void }} [action]
   */
  const notify = useCallback((message, action) => {
    // Keyed by when it was raised, so saying the same thing twice re-shows it
    // rather than looking like nothing happened the second time.
    setCurrent({ message, action, raisedAt: Date.now() });
  }, []);

  const dismiss = useCallback(() => setCurrent(null), []);

  const value = useMemo(() => ({ notify, dismiss }), [notify, dismiss]);

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      <Portal>
        <Snackbar
          // Remounted per message so the timer starts again; without it a
          // second message inherits what was left of the first one's duration.
          key={current?.raisedAt}
          visible={!!current}
          onDismiss={dismiss}
          // Long enough to notice and reach for, short enough not to sit over
          // the tab bar while the next thing is being done.
          duration={5000}
          action={
            current?.action
              ? {
                  label: current.action.label,
                  onPress: () => {
                    current.action.onPress();
                    dismiss();
                  },
                }
              : undefined
          }
        >
          {current?.message ?? ''}
        </Snackbar>
      </Portal>
    </SnackbarContext.Provider>
  );
}

/**
 * `notify(message)` or `notify(message, { label, onPress })`.
 *
 * Falls back to doing nothing outside a provider rather than throwing: a
 * snackbar is the least important thing on any screen, and a test or a
 * standalone render of a component shouldn't fail for want of one.
 */
export function useSnackbar() {
  return useContext(SnackbarContext) ?? { notify: () => {}, dismiss: () => {} };
}
