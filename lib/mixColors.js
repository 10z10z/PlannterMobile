/**
 * One colour per product in a mix, so a bottle's slider and its share of every
 * nutrient bar are recognisably the same thing.
 *
 * Assignment is by position in the mix rather than by id, which keeps the first
 * product green whatever it happens to be. The hues are spaced far enough apart
 * to stay separable when they sit side by side in a stacked bar, and they are
 * mid-toned so they hold up against both the light and dark themes.
 */
const MIX_COLORS = [
  '#4C9F70', // green
  '#3F7CAC', // blue
  '#E4A33A', // amber
  '#B05CA5', // purple
  '#D4674F', // terracotta
  '#5FB6C2', // teal
];

/** The colour for the product at `index` in the mix, cycling once past the end. */
export function mixColor(index) {
  return MIX_COLORS[index % MIX_COLORS.length];
}

export default MIX_COLORS;
