import { describe, expect, it } from 'vitest';

import { money, toDecimalString } from '../shared/money';
import {
  canSeeLocation,
  consolidate,
  netInterSite,
  resolveLocationFilter,
  scopeFor,
  type SitePerformance,
} from './consolidation';
import {
  applyTransferReceipt,
  assertCancellable,
  assertDispatchable,
  canTransitionTransfer,
  checkDispatch,
  groupStockValue,
  inTransit,
  inTransitValue,
  type SiteStock,
  type StockTransfer,
  suggestTransfers,
  TransferError,
} from './transfer';

const gbp = (major: number) => money(Math.round(major * 100));

const TRANSFER: StockTransfer = {
  id: 'tr-1',
  reference: 'TRF-0007',
  fromWarehouseId: 'wh-leeds',
  toWarehouseId: 'wh-bradford',
  status: 'IN_TRANSIT',
  dispatchedAt: new Date('2026-09-07T09:00:00Z'),
  receivedAt: null,
  lines: [
    {
      productId: 'p-pads',
      partNumber: 'BP-4471',
      description: 'Front brake pads',
      sent: 10,
      received: 0,
      unitCost: gbp(18),
    },
    {
      productId: 'p-filter',
      partNumber: 'OF-0091',
      description: 'Oil filter',
      sent: 6,
      received: 0,
      unitCost: gbp(8),
    },
  ],
};

/* ===========================================================================
   Transfers
   =========================================================================== */

describe('stock transfer', () => {
  it('counts what has left but not arrived', () => {
    expect(transferring()).toBe(16);
    expect(toDecimalString(inTransitValue(TRANSFER))).toBe('228.00');
  });

  it('keeps in-transit stock in the group value', () => {
    // The failure this prevents: stock deducted on dispatch and added on
    // receipt, with nothing holding the gap, reads as shrinkage at stocktake.
    const value = groupStockValue([gbp(5000), gbp(3000)], [TRANSFER]);

    expect(toDecimalString(value.onShelf)).toBe('8000.00');
    expect(toDecimalString(value.inTransit)).toBe('228.00');
    expect(toDecimalString(value.total)).toBe('8228.00');
  });

  it('stops counting in transit once a transfer is received', () => {
    const value = groupStockValue([gbp(5000)], [{ ...TRANSFER, status: 'RECEIVED' }]);
    expect(value.inTransit.minor).toBe(0);
  });

  it('refuses a transfer to the same site', () => {
    expect(() =>
      assertDispatchable(
        { ...TRANSFER, toWarehouseId: 'wh-leeds' },
        new Map([
          ['p-pads', 20],
          ['p-filter', 20],
        ]),
      ),
    ).toThrow(TransferError);
  });

  it('refuses to send stock that is reserved for a job at the origin', () => {
    // On hand is 12 but 8 are promised to jobs here, so only 4 may travel.
    const check = checkDispatch(
      TRANSFER,
      new Map([
        ['p-pads', 4],
        ['p-filter', 6],
      ]),
    );

    expect(check.ok).toBe(false);
    expect(check.problems[0]).toMatch(/already reserved for a job here/);
  });

  it('accepts a dispatch when everything is genuinely available', () => {
    const check = checkDispatch(
      TRANSFER,
      new Map([
        ['p-pads', 10],
        ['p-filter', 6],
      ]),
    );

    expect(check.ok).toBe(true);
  });

  it('refuses an empty transfer', () => {
    const check = checkDispatch({ ...TRANSFER, lines: [] }, new Map());
    expect(check.problems).toContain('Nothing to send.');
  });

  it('books in a full delivery and closes the transfer', () => {
    const outcome = applyTransferReceipt(TRANSFER, [
      { productId: 'p-pads', quantity: 10 },
      { productId: 'p-filter', quantity: 6 },
    ]);

    expect(outcome.status).toBe('RECEIVED');
    expect(outcome.discrepancies).toHaveLength(0);
  });

  it('leaves a partial delivery in transit for the remainder', () => {
    const outcome = applyTransferReceipt(TRANSFER, [{ productId: 'p-pads', quantity: 4 }]);

    expect(outcome.status).toBe('PART_RECEIVED');
    expect(outcome.lines[0]!.received).toBe(4);
    expect(inTransit(outcome.lines[0]!)).toBe(6);
    // Nothing is reported missing yet: the rest may still be on the van.
    expect(outcome.discrepancies).toHaveLength(0);
  });

  it('accumulates across two partial deliveries', () => {
    const first = applyTransferReceipt(TRANSFER, [{ productId: 'p-pads', quantity: 4 }]);
    const second = applyTransferReceipt({ ...TRANSFER, status: first.status, lines: first.lines }, [
      { productId: 'p-pads', quantity: 6 },
      { productId: 'p-filter', quantity: 6 },
    ]);

    expect(second.status).toBe('RECEIVED');
    expect(second.lines[0]!.received).toBe(10);
  });

  it('refuses to book in more than was sent', () => {
    expect(() => applyTransferReceipt(TRANSFER, [{ productId: 'p-pads', quantity: 11 }])).toThrow(
      /Count it again before accepting/,
    );
  });

  it('reports the shortfall when a transfer is closed short', () => {
    const outcome = applyTransferReceipt(TRANSFER, [{ productId: 'p-pads', quantity: 8 }], {
      closeShort: true,
    });

    expect(outcome.status).toBe('RECEIVED');
    expect(outcome.discrepancies).toHaveLength(2);
    expect(outcome.discrepancies[0]!.short).toBe(2);
  });

  it('refuses a receipt against a transfer that never left', () => {
    expect(() =>
      applyTransferReceipt({ ...TRANSFER, status: 'DRAFT' }, [
        { productId: 'p-pads', quantity: 1 },
      ]),
    ).toThrow(TransferError);
  });

  it('refuses to cancel a transfer that is already on the road', () => {
    expect(() => assertCancellable(TRANSFER)).toThrow(/Book in what arrives/);
  });

  it('allows a draft to be cancelled', () => {
    expect(() => assertCancellable({ ...TRANSFER, status: 'DRAFT' })).not.toThrow();
  });

  it('treats a received transfer as history', () => {
    expect(canTransitionTransfer('RECEIVED', 'IN_TRANSIT')).toBe(false);
    expect(canTransitionTransfer('RECEIVED', 'CANCELLED')).toBe(false);
  });

  function transferring() {
    return TRANSFER.lines.reduce((total, line) => total + inTransit(line), 0);
  }
});

/* ===========================================================================
   Suggestions
   =========================================================================== */

describe('transfer suggestions', () => {
  const stock: SiteStock[] = [
    {
      warehouseId: 'wh-leeds',
      siteName: 'Leeds',
      productId: 'p-pads',
      partNumber: 'BP-4471',
      onHand: 30,
      reserved: 2,
      reorderPoint: 10,
    },
    {
      warehouseId: 'wh-bradford',
      siteName: 'Bradford',
      productId: 'p-pads',
      partNumber: 'BP-4471',
      onHand: 3,
      reserved: 1,
      reorderPoint: 8,
    },
  ];

  it('moves surplus to the site that is short', () => {
    const [suggestion] = suggestTransfers(stock);

    expect(suggestion?.fromSite).toBe('Leeds');
    expect(suggestion?.toSite).toBe('Bradford');
    expect(suggestion?.quantity).toBe(6);
  });

  it('offers only stock above the holder’s own reorder point', () => {
    // Solving one site's shortage by creating another's is the same purchase
    // order with a van journey attached.
    // Leeds holds 13, two are reserved, and its own reorder point is 10, so
    // exactly one is genuinely spare even though Bradford needs six.
    const tight = stock.map((row) =>
      row.warehouseId === 'wh-leeds' ? { ...row, onHand: 13 } : row,
    );

    const suggestions = suggestTransfers(tight);
    expect(suggestions[0]?.quantity).toBe(1);
  });

  it('suggests nothing when the holder has no spare', () => {
    const tight = stock.map((row) =>
      row.warehouseId === 'wh-leeds' ? { ...row, onHand: 10, reserved: 0 } : row,
    );

    expect(suggestTransfers(tight)).toHaveLength(0);
  });

  it('suggests nothing when nobody is short', () => {
    const healthy = stock.map((row) => ({ ...row, onHand: 40 }));
    expect(suggestTransfers(healthy)).toHaveLength(0);
  });
});

/* ===========================================================================
   Consolidation
   =========================================================================== */

const SITES: SitePerformance[] = [
  {
    locationId: 'loc-leeds',
    siteName: 'Leeds',
    revenue: gbp(60_000),
    costOfSales: gbp(21_000),
    overheads: gbp(24_000),
    jobsCompleted: 240,
    attendedMinutes: 60_000,
    soldMinutes: 54_000,
    stockValue: gbp(9_000),
    receivables: gbp(4_200),
  },
  {
    locationId: 'loc-bradford',
    siteName: 'Bradford',
    revenue: gbp(20_000),
    costOfSales: gbp(9_000),
    overheads: gbp(12_000),
    jobsCompleted: 90,
    attendedMinutes: 30_000,
    soldMinutes: 12_600,
    stockValue: gbp(3_000),
    receivables: gbp(1_800),
  },
];

describe('consolidation', () => {
  it('totals the group from the sites', () => {
    const group = consolidate(SITES);

    expect(toDecimalString(group.total.revenue)).toBe('80000.00');
    expect(toDecimalString(group.total.grossProfit)).toBe('50000.00');
    expect(toDecimalString(group.total.netProfit)).toBe('14000.00');
  });

  it('computes group productivity from minutes rather than averaging sites', () => {
    // Leeds is 90%, Bradford 42%. Averaging those two percentages gives 66%
    // and weights a small site the same as a large one. Weighted by the hours
    // actually worked, the group is at 74%.
    const group = consolidate(SITES);
    expect(group.total.productivityPct).toBe(74);
  });

  it('reports each site’s share of the group', () => {
    const group = consolidate(SITES);
    expect(group.sites[0]!.shareOfGroupPct).toBe(75);
    expect(group.sites[1]!.shareOfGroupPct).toBe(25);
  });

  it('names the spread rather than only the middle', () => {
    const group = consolidate(SITES);

    expect(group.spread.best?.siteName).toBe('Leeds');
    expect(group.spread.worst?.siteName).toBe('Bradford');
    expect(group.spread.gapPoints).toBe(48);
  });

  it('reports no spread for a single-site group', () => {
    const group = consolidate([SITES[0]!]);
    expect(group.spread.gapPoints).toBeNull();
  });

  it('picks out sites below the group margin', () => {
    const group = consolidate(SITES);

    expect(group.laggards).toHaveLength(1);
    expect(group.laggards[0]!.siteName).toBe('Bradford');
  });

  it('handles a site with no revenue without dividing by zero', () => {
    const group = consolidate([
      ...SITES,
      {
        ...SITES[1]!,
        locationId: 'loc-new',
        siteName: 'Halifax',
        revenue: gbp(0),
        jobsCompleted: 0,
        attendedMinutes: 0,
        soldMinutes: 0,
      },
    ]);

    const halifax = group.sites.find((site) => site.siteName === 'Halifax')!;
    expect(halifax.marginPct).toBeNull();
    expect(halifax.productivityPct).toBeNull();
    expect(halifax.revenuePerJob.minor).toBe(0);
  });

  it('nets out movements between sites in the group', () => {
    const netted = netInterSite([
      { fromLocationId: 'loc-leeds', toLocationId: 'loc-bradford', value: gbp(228), count: 1 },
      { fromLocationId: 'loc-leeds', toLocationId: 'loc-bradford', value: gbp(112), count: 1 },
      { fromLocationId: 'loc-bradford', toLocationId: 'loc-leeds', value: gbp(40), count: 1 },
    ]);

    expect(toDecimalString(netted.eliminated)).toBe('380.00');
    expect(netted.count).toBe(3);
    expect(netted.byPair).toHaveLength(2);
    expect(toDecimalString(netted.byPair[0]!.value)).toBe('340.00');
  });
});

/* ===========================================================================
   Per-site access
   =========================================================================== */

describe('location scope', () => {
  const all = ['loc-leeds', 'loc-bradford'];

  it('gives a membership without a location the whole group', () => {
    const scope = scopeFor(null, all);

    expect(scope.locationIds).toBeNull();
    expect(canSeeLocation(scope, 'loc-bradford')).toBe(true);
  });

  it('pins a membership with a location to that site', () => {
    const scope = scopeFor('loc-bradford', all);

    expect(scope.locationIds).toEqual(['loc-bradford']);
    expect(canSeeLocation(scope, 'loc-leeds')).toBe(false);
  });

  it('resolves "all" to no filter for a group-wide member', () => {
    expect(resolveLocationFilter(scopeFor(null, all), 'all')).toBeNull();
  });

  it('resolves "all" to their own site for a pinned member', () => {
    expect(resolveLocationFilter(scopeFor('loc-bradford', all), 'all')).toBe('loc-bradford');
  });

  it('quietly redirects a stale link to a site somebody has left', () => {
    // Their own work, not an error page.
    expect(resolveLocationFilter(scopeFor('loc-bradford', all), 'loc-leeds')).toBe('loc-bradford');
  });

  it('honours an explicit site for a group-wide member', () => {
    expect(resolveLocationFilter(scopeFor(null, all), 'loc-leeds')).toBe('loc-leeds');
  });
});
