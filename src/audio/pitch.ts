// MIDI note number to frequency in Hertz (equal temperament, A4 = 440 Hz).
export const mtof = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);
