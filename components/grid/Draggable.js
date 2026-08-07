import { useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet } from 'react-native';

const HOLD_MS = 1000;
/** How far a finger may wander before a hold counts as a drag attempt instead. */
const HOLD_SLOP = 8;

/**
 * One plant, pickable up after a hold.
 *
 * The whole gesture lives here rather than in a library: with one plant per cell
 * and a snap on release there is no physics to run, so a PanResponder and an
 * offset are the entire interaction. Keeping it in one component is also what
 * makes it cheap to swap for a gesture-handler version later.
 *
 * Nothing here is covered by a test, and it is the only part of the grid that
 * isn't. A `PanResponder` reads finger coordinates against a layout measured
 * from a real screen, and the test renderer has neither — which is the same
 * reason TalkBack can't drive it, and why `PlantButton` exists alongside.
 */
export default function Draggable({ plant, size, left, top, onPress, onPickUp, onDrop, children }) {
  const pan = useRef(new Animated.ValueXY()).current;
  const [dragging, setDragging] = useState(false);

  // The responder is built once, so everything it reads has to come through a
  // ref — a captured prop would still be the one from the first render.
  const latest = useRef({ plant, onPress, onPickUp, onDrop });
  latest.current = { plant, onPress, onPickUp, onDrop };

  const state = useRef({ dragging: false, moved: false, timer: null }).current;

  const stop = () => {
    clearTimeout(state.timer);
    state.timer = null;
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => state.dragging,
      onPanResponderGrant: () => {
        state.moved = false;
        state.timer = setTimeout(() => {
          state.dragging = true;
          setDragging(true);
          latest.current.onPickUp(latest.current.plant);
        }, HOLD_MS);
      },
      onPanResponderMove: (event, gesture) => {
        if (!state.dragging) {
          // Moving before the hold lands means this was never a pick-up.
          if (Math.hypot(gesture.dx, gesture.dy) > HOLD_SLOP) {
            state.moved = true;
            stop();
          }
          return;
        }
        pan.setValue({ x: gesture.dx, y: gesture.dy });
      },
      onPanResponderRelease: (event, gesture) => {
        stop();
        if (state.dragging) {
          state.dragging = false;
          setDragging(false);
          latest.current.onDrop(latest.current.plant, gesture.moveX, gesture.moveY);
          // Snapped home either way: a refused drop belongs where it started,
          // and an accepted one is redrawn from the reloaded plants.
          pan.setValue({ x: 0, y: 0 });
        } else if (!state.moved) {
          latest.current.onPress(latest.current.plant);
        }
      },
      onPanResponderTerminate: () => {
        stop();
        state.dragging = false;
        setDragging(false);
        pan.setValue({ x: 0, y: 0 });
      },
    })
  ).current;

  return (
    <Animated.View
      {...responder.panHandlers}
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          left,
          top,
          transform: pan.getTranslateTransform(),
        },
        dragging && styles.dragging,
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: {
    position: 'absolute',
  },
  // No transform here: it would replace the drag's own translate, since a later
  // style in the array wins outright rather than merging.
  dragging: {
    zIndex: 10,
    elevation: 8,
    opacity: 0.9,
  },
});
