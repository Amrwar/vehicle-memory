import { Skeleton, StatRowSkeleton, TableSkeleton } from '@carnet/ui';

/**
 * Shown the instant a workshop link is clicked.
 *
 * Every page here reads live data, so none of them can be served from a cache;
 * the server round trip is real and it is not going away. What this removes is
 * the dead interval where the old page sat on screen and the click appeared to
 * do nothing. The sidebar and page frame stay put, so only the region that is
 * actually changing shows movement.
 */
export default function WorkshopLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>

      <div className="mb-5 flex items-end justify-between gap-4">
        <div className="grid gap-2">
          <Skeleton className="h-2.5" width="5rem" />
          <Skeleton className="h-7" width="14rem" />
          <Skeleton className="h-3" width="20rem" />
        </div>
        <div className="hidden gap-2 sm:flex">
          <Skeleton className="h-8 rounded-(--radius-sm)" width="5rem" />
          <Skeleton className="h-8 rounded-(--radius-sm)" width="5rem" />
        </div>
      </div>

      <StatRowSkeleton />

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <TableSkeleton rows={7} columns={4} />
        <div className="grid content-start gap-5">
          <TableSkeleton rows={3} columns={2} />
          <TableSkeleton rows={2} columns={2} />
        </div>
      </div>
    </div>
  );
}
