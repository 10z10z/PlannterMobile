/**
 * What an imported image is, as far as the typechecker is concerned.
 *
 * Metro turns `import mark from './mark.png'` into a number — an id in the
 * asset registry, which `Image`'s `source` accepts directly. `tsc` doesn't know
 * that, and without this it refuses to resolve the module at all (TS2307) on
 * the first file in the repo to import a picture.
 *
 * This is what Expo's generated `expo-env.d.ts` would do, except that file is
 * gitignored and never exists in CI — which runs `npm run typecheck` against a
 * clean checkout, so the declaration has to be committed to be there when it
 * matters.
 */
declare module '*.png' {
  const asset: number;
  export default asset;
}

declare module '*.jpg' {
  const asset: number;
  export default asset;
}

declare module '*.svg' {
  const asset: number;
  export default asset;
}
