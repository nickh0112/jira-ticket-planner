/**
 * Seeded Pseudo-Random Number Generator
 * Uses mulberry32 algorithm for fast, high-quality randomness
 */

export type PRNG = {
  /** Returns a random float in [0, 1) */
  random: () => number;
  /** Returns a random integer in [min, max] inclusive */
  randInt: (min: number, max: number) => number;
  /** Returns a random float in [min, max) */
  randFloat: (min: number, max: number) => number;
  /** Returns true with given probability (0-1) */
  chance: (probability: number) => boolean;
  /** Picks a random element from array */
  pick: <T>(arr: readonly T[]) => T;
  /** Shuffles array in place and returns it */
  shuffle: <T>(arr: T[]) => T[];
  /** Returns array of n random picks (with replacement) */
  pickN: <T>(arr: readonly T[], n: number) => T[];
  /** Returns random point within radius of center */
  randomInCircle: (cx: number, cy: number, radius: number) => { x: number; y: number };
  /** Returns random point within rectangle */
  randomInRect: (x: number, y: number, width: number, height: number) => { x: number; y: number };
};

/**
 * Creates a seeded PRNG using mulberry32 algorithm
 */
export function createPRNG(seed: number): PRNG {
  let state = seed >>> 0; // Ensure unsigned 32-bit

  // Mulberry32 algorithm
  function random(): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function randInt(min: number, max: number): number {
    return Math.floor(random() * (max - min + 1)) + min;
  }

  function randFloat(min: number, max: number): number {
    return random() * (max - min) + min;
  }

  function chance(probability: number): boolean {
    return random() < probability;
  }

  function pick<T>(arr: readonly T[]): T {
    return arr[randInt(0, arr.length - 1)];
  }

  function shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = randInt(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function pickN<T>(arr: readonly T[], n: number): T[] {
    const result: T[] = [];
    for (let i = 0; i < n; i++) {
      result.push(pick(arr));
    }
    return result;
  }

  function randomInCircle(cx: number, cy: number, radius: number): { x: number; y: number } {
    // Use rejection sampling for uniform distribution
    let x: number, y: number, distSq: number;
    const radiusSq = radius * radius;

    do {
      x = randFloat(-radius, radius);
      y = randFloat(-radius, radius);
      distSq = x * x + y * y;
    } while (distSq > radiusSq);

    return { x: cx + x, y: cy + y };
  }

  function randomInRect(x: number, y: number, width: number, height: number): { x: number; y: number } {
    return {
      x: randFloat(x, x + width),
      y: randFloat(y, y + height),
    };
  }

  return {
    random,
    randInt,
    randFloat,
    chance,
    pick,
    shuffle,
    pickN,
    randomInCircle,
    randomInRect,
  };
}

/**
 * Hash a string to a number (for seed generation)
 */
export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return hash >>> 0; // Ensure unsigned
}
