import { describe, expect, it } from 'vitest';
import { formatBuildStamp } from './build-info';

describe('formatBuildStamp', () => {
  it('starts with "Stand" and ends with the given commit sha', () => {
    const stamp = formatBuildStamp('2026-09-27T13:52:00.000Z', '1a2b3c4');
    expect(stamp.startsWith('Stand ')).toBe(true);
    expect(stamp.endsWith('· 1a2b3c4')).toBe(true);
  });

  it('formats the timestamp the same way the app does, in the viewer’s local time zone', () => {
    const iso = '2026-09-27T13:52:00.000Z';
    const expectedDateTime = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(iso),
    );
    expect(formatBuildStamp(iso, 'abc1234')).toBe(`Stand ${expectedDateTime} · abc1234`);
  });

  it('passes the sha through unchanged, including the local-build fallback', () => {
    expect(formatBuildStamp('2026-01-01T00:00:00.000Z', 'lokal')).toContain('lokal');
  });
});
