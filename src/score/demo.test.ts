import { describe, expect, it } from 'vitest';
import { demoScore } from './demo';
import { scoreLength, VOICES } from './score';

describe('demoScore', () => {
  it('has all four voices, ending together after the pickup and four bars', () => {
    const byLetter = (a: string, b: string): number => a.localeCompare(b);
    expect(Object.keys(demoScore.voices).sort(byLetter)).toEqual([...VOICES].sort(byLetter));
    expect(scoreLength(demoScore)).toBe(16);
  });

  it('is in A major at a steady tempo', () => {
    expect(demoScore.keyFifths).toBe(3);
    expect(demoScore.tempo).toBe(100);
    expect(demoScore.beatsPerBar).toBe(4);
  });

  it('fills every bar of every voice exactly, rests included', () => {
    for (const notes of Object.values(demoScore.voices)) {
      const byBar = new Map<number, { start: number; end: number }[]>();
      for (const note of notes) {
        const span = byBar.get(note.bar) ?? [];
        span.push({ start: note.start, end: note.start + note.duration });
        byBar.set(note.bar, span);
      }
      for (const spans of byBar.values()) {
        spans.sort((a, b) => a.start - b.start);
        for (let i = 1; i < spans.length; i++) {
          expect(spans[i]?.start).toBe(spans[i - 1]?.end);
        }
      }
    }
  });
});
