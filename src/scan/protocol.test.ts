import { describe, expect, it } from 'vitest';
import type { Score } from '../score/score';
import { NoStaffError, type Recognition } from './pipeline';
import { MAX_SIDE, MESSAGES, respond, scoreOf, workingSize } from './protocol';
import { toRgba } from './raster';

const SCORE: Score = { voices: { S: [{ midi: 60, start: 0, duration: 1, bar: 1 }] }, beatsPerBar: 4, keyFifths: 0 };
const blank = toRgba({ width: 40, height: 30, data: new Uint8Array(1200).fill(255) });

describe('workingSize', () => {
  it('shrinks the long side to MAX_SIDE and keeps the aspect ratio', () => {
    expect(workingSize(4000, 3000)).toEqual({ width: MAX_SIDE, height: 1800 });
    expect(workingSize(3000, 4000)).toEqual({ width: 1800, height: MAX_SIDE });
  });

  it('never enlarges and never reaches zero', () => {
    expect(workingSize(800, 600)).toEqual({ width: 800, height: 600 });
    expect(workingSize(100_000, 1)).toEqual({ width: MAX_SIDE, height: 1 });
  });
});

describe('respond', () => {
  it('answers with the Score that recognition read', () => {
    const read = (): Recognition => ({ score: SCORE }) as unknown as Recognition;
    expect(respond(blank, read)).toEqual({ ok: true, score: SCORE });
  });

  it('answers noStaff for a photo without staff lines', () => {
    expect(respond(blank)).toEqual({ ok: false, failure: 'noStaff' });
    const read = (): Recognition => {
      throw new NoStaffError();
    };
    expect(respond(blank, read)).toEqual({ ok: false, failure: 'noStaff' });
  });

  it('answers failed for anything else going wrong', () => {
    const read = (): Recognition => {
      throw new RangeError('broken');
    };
    expect(respond(blank, read)).toEqual({ ok: false, failure: 'failed' });
  });
});

describe('scoreOf', () => {
  it('passes the Score through', () => {
    expect(scoreOf({ ok: true, score: SCORE })).toBe(SCORE);
  });

  it('turns a failure into an Error with a German message for the user', () => {
    expect(() => scoreOf({ ok: false, failure: 'noStaff' })).toThrow(
      'Keine Notenlinien gefunden – bitte näher ran und gerade halten.',
    );
    expect(() => scoreOf({ ok: false, failure: 'failed' })).toThrow(MESSAGES.failed);
  });
});
