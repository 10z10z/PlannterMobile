/**
 * The two colours that don't belong to a scheme.
 *
 * Everything else in the app is drawn from one of the six generated MD3
 * palettes in `lib/themes.js`, and changes with the grower's choice of scheme
 * and with light or dark. The mark doesn't: it is gold on this green wherever
 * it appears, the same as it is on the app icon and the splash, and a logo that
 * changed colour with a setting would stop being a logo.
 *
 * The green is also written into `app.json` as the splash background, where a
 * JS constant can't reach. They have to be changed together — the splash and
 * the login screen are the same panel as far as anyone opening the app is
 * concerned, and a seam between them is the first thing they'd see.
 */
export const BRAND = {
  /** `expo-splash-screen`'s `backgroundColor` in app.json. */
  green: '#12370F',
  /** The lighter end of the mark's gradient, for text set beside it. */
  gold: '#E3C878',
  /** The wordmark's subtitle, which has to hold up on the green above. */
  onGreen: 'rgba(255, 255, 255, 0.72)',
};
