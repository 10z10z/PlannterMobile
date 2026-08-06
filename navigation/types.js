/**
 * Route names and their params, in one place.
 *
 * Naming these buys the thing an untyped navigator can't give: a route name
 * that no longer exists, or a screen pushed without the params it reads off
 * `route`, is a type error at the navigator rather than a blank screen on a
 * phone.
 *
 * A note on `id`: every `<X.Navigator>` in this app passes `id={undefined}`.
 * React Navigation 7 declares the prop as `id: NavigatorID` rather than
 * `id?: NavigatorID` (`@react-navigation/core`, types.d.ts), so it is required
 * by the types while being optional at runtime — nothing in this app nests
 * navigators deeply enough to need `getParent('someId')`. The alternative was
 * to leave the navigators unchecked entirely, which would have given up route
 * name checking to avoid one word.
 *
 * @module navigation/types
 */

/**
 * The signed-out stack.
 *
 * @typedef {object} AuthParamList
 * @property {undefined} Login
 * @property {undefined} Signup
 */

/**
 * The five bottom tabs. Each holds a stack or a screen of its own, so params
 * are forwarded rather than read here.
 *
 * @typedef {object} TabParamList
 * @property {undefined | { screen?: string, params?: object }} Home
 * @property {undefined | { screen?: string, params?: object }} Growspaces
 * @property {undefined | { screen?: string, params?: object }} Germination
 * @property {undefined} Inventory
 * @property {undefined} NPK
 */

/**
 * The dashboard tab: the landing screen and the two reached from its header.
 *
 * @typedef {object} DashboardParamList
 * @property {undefined} Dashboard
 * @property {undefined} Settings
 * @property {undefined | { date?: string }} Calendar
 */

/**
 * The growspace tab. `PlantDetail` carries the plant's name as well as its id
 * so the header can be titled before the plant itself has loaded.
 *
 * @typedef {object} GrowspacesParamList
 * @property {undefined | { screen?: string }} GrowspacesOverview
 * @property {{ plantId: string, plantName?: string }} PlantDetail
 * @property {undefined | { date?: string }} Calendar
 */

/**
 * The sowing tab.
 *
 * @typedef {object} GerminationParamList
 * @property {undefined} GerminationStations
 * @property {undefined | { date?: string }} Calendar
 */

export {};
