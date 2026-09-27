// The small "Stand …" footer line: which build the singer is looking at, in their own local time zone.
const formatter = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' });

export const formatBuildStamp = (isoTime: string, sha: string): string =>
  `Stand ${formatter.format(new Date(isoTime))} · ${sha}`;
