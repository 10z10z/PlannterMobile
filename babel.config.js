/**
 * Metro already applies babel-preset-expo by default; this file exists so that
 * jest picks up the same transform when it runs the tests outside Metro.
 */
module.exports = function (api) {
  api.cache(true);
  return { presets: ['babel-preset-expo'] };
};
