/**
 * Pull-to-refresh over however many queries a screen is built from.
 *
 * Most screens here are several reads rather than one — a growspace is its own
 * row, its grids, its plants and its lights, split up because they change at
 * quite different rates. That split is right for reading and wrong for a pull:
 * a grower dragging the screen down means "check all of this", not "check the
 * one whose spinner you happen to be showing".
 *
 * So the indicator stays up until every one of them has come back. Refetching
 * four and hiding the spinner when the first finishes is how a pull ends with
 * three quarters of the screen still stale and no sign of it.
 *
 * `isRefetching` rather than `isFetching`, deliberately: the first load has its
 * own spinner in `QueryBoundary`, and a screen that shows both at once looks
 * like it is loading twice.
 *
 * @param {Array<import('@tanstack/react-query').UseQueryResult | null | undefined>} queries
 * @returns {{ refreshing: boolean, onRefresh: () => void }}
 */
export default function useRefresh(queries) {
  const active = (queries ?? []).filter(Boolean);

  return {
    refreshing: active.some((query) => query.isRefetching),
    onRefresh: () => {
      for (const query of active) query.refetch();
    },
  };
}
