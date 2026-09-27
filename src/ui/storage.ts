// Remembers the singer's last voice choice. Best-effort: private browsing / a full storage quota must not break
// the app, so every access is wrapped and a failure just means "nothing remembered".
import { VOICES } from '../score/score';
import type { Voice } from '../score/score';

const KEY = 'vomblatt.voice';

export const loadLastVoice = (): Voice | null => {
  try {
    const value = localStorage.getItem(KEY);
    return (VOICES as readonly string[]).includes(value ?? '') ? (value as Voice) : null;
  } catch {
    return null;
  }
};

export const saveLastVoice = (voice: Voice): void => {
  try {
    localStorage.setItem(KEY, voice);
  } catch {
    // storage unavailable or full – silently keep going without it
  }
};
