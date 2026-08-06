/**
 * Every cache key in one place.
 *
 * Keys are arrays read left to right, and TanStack Query matches on prefixes —
 * so `['growspaces']` invalidates the list, every detail and everything hanging
 * off them. That is the whole design: the nesting *is* the invalidation rule,
 * and putting the keys in one file is what stops two screens inventing
 * `['plants', id]` and `['plant', id]` for the same row.
 *
 * The awkward part of this app is that one action touches several trees. Sowing
 * a tray writes a sowing, takes seeds out of a pack, marks a tray in use and
 * files a calendar entry — four roots from one press. Rather than leave each
 * mutation to remember that, what an action affects is written down once in
 * `AFFECTED_BY` at the bottom, and mutations name the action.
 */

export const keys = {
  growspaces: {
    all: ['growspaces'],
    list: () => ['growspaces', 'list'],
    detail: (growspaceId) => ['growspaces', 'detail', growspaceId],
    plants: (growspaceId) => ['growspaces', 'detail', growspaceId, 'plants'],
    grids: (growspaceId) => ['growspaces', 'detail', growspaceId, 'grids'],
    lights: (growspaceId) => ['growspaces', 'detail', growspaceId, 'lights'],
  },

  plants: {
    all: ['plants'],
    detail: (plantId) => ['plants', 'detail', plantId],
  },

  stations: {
    all: ['stations'],
    list: () => ['stations', 'list'],
    detail: (stationId) => ['stations', 'detail', stationId],
    lights: (stationId) => ['stations', 'detail', stationId, 'lights'],
    sowings: (stationId) => ['stations', 'detail', stationId, 'sowings'],
  },

  /**
   * The six inventory tabs. Grouped under one root because "something in the
   * cupboard changed" is a thing several screens want to hear at once, and
   * because the tabs are read together whenever the inventory screen opens.
   */
  inventory: {
    all: ['inventory'],
    fertilizers: () => ['inventory', 'fertilizers'],
    seedPacks: () => ['inventory', 'seedPacks'],
    containers: () => ['inventory', 'containers'],
    trays: () => ['inventory', 'trays'],
    mediums: () => ['inventory', 'mediums'],
    growLights: () => ['inventory', 'growLights'],
  },

  /**
   * Calendar reads are keyed by the range asked for, so paging back a month
   * doesn't throw away the month just left.
   */
  calendar: {
    all: ['calendar'],
    activity: (from, to) => ['calendar', 'activity', from, to],
    scheduled: (from, to) => ['calendar', 'scheduled', from, to],
  },

  feedings: {
    all: ['feedings'],
    detail: (feedingId) => ['feedings', 'detail', feedingId],
  },

  dashboard: {
    all: ['dashboard'],
    summary: (today) => ['dashboard', 'summary', today],
  },

  /** Growspaces and stations as one list, for the pickers that offer both. */
  places: {
    all: ['places'],
    list: () => ['places', 'list'],
  },

  weather: {
    all: ['weather'],
    current: (placeId) => ['weather', 'current', placeId],
    search: (query) => ['weather', 'search', query],
  },
};

/**
 * What each action makes stale, as a list of key prefixes.
 *
 * Written from the data's point of view rather than the screen's: a sowing
 * takes seeds out of a pack whether it was made from the station screen or from
 * a calendar plan, so both get the same invalidation and neither has to know.
 *
 * `dashboard` and `calendar` appear against almost everything on purpose —
 * both are summaries of the whole grow, so nearly any change dates them.
 */
export const AFFECTED_BY = {
  growspaceSaved: [keys.growspaces.all, keys.dashboard.all, keys.places.all],
  growspaceDeleted: [
    keys.growspaces.all,
    keys.plants.all,
    keys.dashboard.all,
    keys.places.all,
    keys.calendar.all,
  ],

  // A plant moving on the grid changes where it is, and files a calendar entry.
  plantMoved: [keys.growspaces.all, keys.plants.all, keys.calendar.all],
  // Watering restarts the reminder cycle, so the dashboard's "due" list shifts.
  plantWatered: [keys.growspaces.all, keys.plants.all, keys.dashboard.all, keys.calendar.all],
  plantSaved: [keys.growspaces.all, keys.plants.all, keys.dashboard.all, keys.inventory.all],
  plantDeleted: [
    keys.growspaces.all,
    keys.plants.all,
    keys.dashboard.all,
    keys.inventory.all,
    keys.calendar.all,
  ],

  stationSaved: [keys.stations.all, keys.places.all, keys.inventory.all],
  stationDeleted: [keys.stations.all, keys.places.all, keys.inventory.all, keys.calendar.all],

  // Sowing spends seeds and takes a tray out of circulation.
  sowingCreated: [keys.stations.all, keys.inventory.all, keys.calendar.all, keys.dashboard.all],
  sowingChanged: [keys.stations.all, keys.calendar.all, keys.dashboard.all],
  sowingDeleted: [keys.stations.all, keys.inventory.all, keys.calendar.all, keys.dashboard.all],

  // A transplant leaves the station side and arrives in the growspace side.
  transplanted: [
    keys.stations.all,
    keys.growspaces.all,
    keys.plants.all,
    keys.inventory.all,
    keys.calendar.all,
    keys.dashboard.all,
  ],

  inventoryChanged: [keys.inventory.all],
  // Lights are counted across both growspaces and stations, so a change to one
  // fixture's assignment moves a number on the inventory tab as well.
  lightsAssigned: [keys.inventory.all, keys.growspaces.all, keys.stations.all],

  feedingRecorded: [keys.calendar.all, keys.dashboard.all, keys.feedings.all],
  feedingDeleted: [keys.calendar.all, keys.dashboard.all, keys.feedings.all],

  scheduleChanged: [keys.calendar.all, keys.dashboard.all],
};

/**
 * Marks everything an action touched as stale.
 *
 * Invalidating rather than removing: what is on screen stays on screen and is
 * refetched underneath, so ticking a job off doesn't blank the dashboard for as
 * long as the round trip takes.
 *
 * @param {import('@tanstack/react-query').QueryClient} queryClient
 * @param {keyof typeof AFFECTED_BY} action
 */
export function invalidateFor(queryClient, action) {
  const affected = AFFECTED_BY[action];
  if (!affected) {
    throw new Error(`No invalidation rule for "${action}" — add one to AFFECTED_BY.`);
  }
  return Promise.all(affected.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}
