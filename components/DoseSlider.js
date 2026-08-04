import { useMemo, useRef } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import { useTheme } from 'react-native-paper';

/**
 * A plain-JS slider, built on PanResponder rather than a native slider package
 * so that adding one to the calculator doesn't force a new dev-client build.
 *
 * A press jumps the thumb to where it landed and drags on from there, which is
 * the behaviour a tap-then-nudge dose adjustment wants.
 */
export default function DoseSlider({
  value,
  onChange,
  min = 0,
  max = 5,
  step = 0.1,
  disabled,
  color,
}) {
  const theme = useTheme();
  const accent = color ?? theme.colors.primary;

  /**
   * The PanResponder is built once and never rebuilt. Each instance keeps its
   * own gesture state, which only onPanResponderGrant initialises — so swapping
   * in a fresh instance part-way through a drag would leave the replacement
   * reading a dx that no touch ever populated. Since a drag re-renders this
   * component on every frame (the dose changes), the live props have to reach
   * the handlers through a ref instead of through the closure.
   */
  const live = useRef({ onChange, min, max, step, disabled });
  live.current = { onChange, min, max, step, disabled };

  const width = useRef(0);
  const startValue = useRef(value);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Claim the gesture in the capture phase so the surrounding ScrollView
        // doesn't take the drag and scroll the page instead.
        onStartShouldSetPanResponderCapture: () => !live.current.disabled,
        onMoveShouldSetPanResponderCapture: () => !live.current.disabled,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,

        onPanResponderGrant: (event) => {
          const next = valueAt(live.current, event.nativeEvent.locationX, width.current);
          if (next === null) return;
          startValue.current = next;
          live.current.onChange(next);
        },

        onPanResponderMove: (_event, gesture) => {
          const { min: lo, max: hi } = live.current;
          if (!width.current) return;
          const travelled = (gesture.dx / width.current) * (hi - lo);
          live.current.onChange(snap(live.current, startValue.current + travelled));
        },
      }),
    []
  );

  const range = Math.max(max - min, Number.EPSILON);
  const fillPct = Math.min(100, Math.max(0, ((value - min) / range) * 100));

  return (
    <View
      style={styles.container}
      onLayout={(event) => {
        width.current = event.nativeEvent.layout.width;
      }}
      {...panResponder.panHandlers}
    >
      <View style={[styles.track, { backgroundColor: theme.colors.surfaceVariant }]}>
        <View style={[styles.fill, { width: `${fillPct}%`, backgroundColor: accent }]} />
      </View>
      <View
        pointerEvents="none"
        style={[
          styles.thumb,
          {
            left: `${fillPct}%`,
            backgroundColor: disabled ? theme.colors.surfaceVariant : accent,
            borderColor: theme.colors.surface,
          },
        ]}
      />
    </View>
  );
}

/** Clamps to the track and lands on the nearest step, at the step's precision. */
function snap({ min, max, step }, raw) {
  const decimals = String(step).split('.')[1]?.length ?? 0;
  const stepped = Math.round(raw / step) * step;
  return Number(Math.min(max, Math.max(min, stepped)).toFixed(decimals));
}

/** The value under a touch, or null before the track has been measured. */
function valueAt(props, x, width) {
  if (!width) return null;
  return snap(props, props.min + (x / width) * (props.max - props.min));
}

const THUMB = 20;

const styles = StyleSheet.create({
  container: {
    height: 36,
    justifyContent: 'center',
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 2,
    // Centres the thumb on its position instead of hanging off the right edge.
    marginLeft: -THUMB / 2,
  },
});
