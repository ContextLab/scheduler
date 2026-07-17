/**
 * Tests for ApiClient prefetch caching + invalidation.
 *
 * The page-load prefetch is a snapshot; before this fix it was never
 * invalidated, so post-booking slot fetches (including the "pick another time"
 * refresh) served stale availability. invalidatePrefetch() must force a fresh
 * backend call.
 */

let ApiClient;

function mockFetch(payload) {
  return jest.fn(function () {
    return Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: function () { return Promise.resolve(payload); },
    });
  });
}

const FUTURE_START = new Date(Date.now() + 12 * 3600 * 1000).toISOString();
const FUTURE_END = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

describe('ApiClient prefetch cache', () => {
  beforeEach(() => {
    jest.resetModules();
    ApiClient = require('../../js/api-client');
    global.fetch = mockFetch({ success: true, slots: [] });
    ApiClient.init('https://example.test/exec');
  });

  test('serves a slot request from the prefetch without a second network call', async () => {
    ApiClient.prefetchSlots(FUTURE_START, FUTURE_END);
    await ApiClient.getAvailableSlots(FUTURE_START, FUTURE_END, 15);
    expect(global.fetch).toHaveBeenCalledTimes(1); // only the prefetch itself
  });

  test('invalidatePrefetch forces the next fetch to hit the backend', async () => {
    ApiClient.prefetchSlots(FUTURE_START, FUTURE_END);
    await ApiClient.getAvailableSlots(FUTURE_START, FUTURE_END, 15);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    ApiClient.invalidatePrefetch();

    await ApiClient.getAvailableSlots(FUTURE_START, FUTURE_END, 15);
    expect(global.fetch).toHaveBeenCalledTimes(2); // fresh call, not stale cache
  });
});

describe('ApiClient client-side merge (larger durations)', () => {
  // 15-min slots with a gap at [45,60): 0,15,30 | (gap) | 60,75,90,105 minutes.
  const base = Math.floor((Date.now() + 24 * 3600 * 1000) / (15 * 60 * 1000)) * (15 * 60 * 1000);
  const MIN = 60 * 1000;
  function slot(offMin) {
    return {
      start: new Date(base + offMin * MIN).toISOString(),
      end: new Date(base + (offMin + 15) * MIN).toISOString(),
    };
  }
  const FIFTEEN = [0, 15, 30, 60, 75, 90, 105].map(slot);
  const RANGE_START = new Date(base).toISOString();
  const RANGE_END = new Date(base + 3 * 3600 * 1000).toISOString();

  let ApiClient;
  beforeEach(() => {
    jest.resetModules();
    ApiClient = require('../../js/api-client');
    global.fetch = mockFetch({ success: true, slots: FIFTEEN });
    ApiClient.init('https://example.test/exec');
    ApiClient.prefetchSlots(RANGE_START, RANGE_END);
  });

  test('merges only consecutive slots and never bridges the busy gap', async () => {
    const result = await ApiClient.getAvailableSlots(RANGE_START, RANGE_END, 45);
    const startsMin = result.slots.map((s) => (new Date(s.start).getTime() - base) / MIN);
    // 45-min slots need 3 consecutive 15-min slots: only 0, 60, 75 qualify.
    expect(startsMin.sort((a, b) => a - b)).toEqual([0, 60, 75]);
  });

  test('every merged slot is exactly the requested duration', async () => {
    const result = await ApiClient.getAvailableSlots(RANGE_START, RANGE_END, 45);
    result.slots.forEach((s) => {
      const lenMin = (new Date(s.end).getTime() - new Date(s.start).getTime()) / MIN;
      expect(lenMin).toBe(45);
    });
  });

  test('no merged slot spans the [45,60) gap', async () => {
    const result = await ApiClient.getAvailableSlots(RANGE_START, RANGE_END, 45);
    const gapStart = base + 45 * MIN;
    const gapEnd = base + 60 * MIN;
    result.slots.forEach((s) => {
      const a = new Date(s.start).getTime();
      const b = new Date(s.end).getTime();
      expect(a < gapEnd && gapStart < b).toBe(false); // must not overlap the gap
    });
  });
});
