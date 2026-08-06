import { Component } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { describeError } from '../lib/errors';

/**
 * Catches a render that threw, so one broken screen doesn't take the app with
 * it.
 *
 * Without this, a single bad read — a plant whose growspace was deleted under
 * it, a shape the server changed — unmounts the whole tree and leaves a white
 * screen with no way back but force-quitting. React gives exactly one tool for
 * this and it only works on a class, which is why this is the one class
 * component in the app.
 *
 * It has to be used more than once to be worth much. Wrapping the root alone
 * turns a white screen into a nicer white screen; wrapping each tab as well
 * means the growspace that broke is the only thing that broke, and the other
 * four tabs still work while it is being fixed.
 *
 * Resetting remounts the children rather than reloading the app. That is enough
 * whenever the cause has since been fixed — a refetch that now succeeds, a row
 * that has been deleted properly — and when it isn't, the fallback simply comes
 * straight back rather than pretending.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.reset = this.reset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Development only — a released build has nowhere to put this yet. The
    // component stack is the useful half: it names the screen that threw.
    if (__DEV__) {
      console.error(`[render] ${describeError(error)}`, info?.componentStack);
    }
  }

  reset() {
    this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.container}>
        <Text variant="titleMedium" style={styles.title}>
          {this.props.label ? `${this.props.label} stopped working` : 'Something went wrong'}
        </Text>
        <Text variant="bodyMedium" style={styles.body}>
          The rest of the app is still fine. Try this screen again, and if it keeps happening it’s a
          bug worth reporting.
        </Text>

        {/* The developer's half of the story, kept out of a release build. */}
        {__DEV__ && (
          <ScrollView style={styles.detailBox} contentContainerStyle={styles.detailContent}>
            <Text variant="bodySmall" style={styles.detail}>
              {describeError(error)}
            </Text>
          </ScrollView>
        )}

        <Button mode="contained" icon="refresh" onPress={this.reset}>
          Try again
        </Button>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  title: {
    textAlign: 'center',
  },
  body: {
    textAlign: 'center',
    opacity: 0.7,
  },
  detailBox: {
    maxHeight: 140,
    alignSelf: 'stretch',
  },
  detailContent: {
    padding: 12,
  },
  detail: {
    opacity: 0.6,
    fontFamily: 'monospace',
  },
});
