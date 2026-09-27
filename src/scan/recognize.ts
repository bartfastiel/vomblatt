// Placeholder for real recognition (deskewing, staff detection, notehead-to-pitch, …), built separately in this
// same folder. Until that lands, every photo resolves to the demo score so the player has something to show.
import { demoScore } from '../score/demo';
import type { Score } from '../score/score';

export const recognize = async (photo: Blob): Promise<Score> => {
  await Promise.resolve(photo); // stands in for the real, async decoding step this stub will be replaced by
  return demoScore;
};
