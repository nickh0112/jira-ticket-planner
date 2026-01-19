import { Assets, Texture, Rectangle } from 'pixi.js';

// LPC sprite format constants
const FRAME_WIDTH = 64;
const FRAME_HEIGHT = 64;

// Direction types and mapping
export type Direction = 'up' | 'down' | 'left' | 'right';
export type AnimationType = 'walk' | 'idle';

// Row mapping for LPC sprites (up=0, left=1, down=2, right=3)
const DIRECTION_ROW: Record<Direction, number> = {
  up: 0,
  left: 1,
  down: 2,
  right: 3,
};

// Walking animation uses frames 1-8 for a smooth 8-frame cycle
// Frame 0 is the standing pose, frames 1-8 are the walk cycle
const WALK_FRAME_START = 1;
const WALK_FRAME_COUNT = 8;

// Idle animation - idle.png has 13 frames but only frame 0 is the standing pose
// Other frames may be different poses (casting, etc.) - use only frame 0 for now
const IDLE_FRAME_COUNT = 1;

// Cache for loaded textures
let walkTexture: Texture | null = null;
let idleTexture: Texture | null = null;
const textureCache: Map<string, Texture> = new Map();
let loadPromise: Promise<boolean> | null = null;
let loadFailed = false;

/**
 * Load LPC mage sprite sheets
 */
export async function loadLPCSprites(): Promise<boolean> {
  if (loadFailed) return false;
  if (walkTexture && idleTexture) return true;

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    try {
      // Load walk and idle spritesheets
      walkTexture = await Assets.load('/assets/sprites/lpc/mage/standard/walk.png');
      idleTexture = await Assets.load('/assets/sprites/lpc/mage/standard/idle.png');

      // Pre-generate texture frames for walk animation
      if (walkTexture) {
        for (const direction of Object.keys(DIRECTION_ROW) as Direction[]) {
          const row = DIRECTION_ROW[direction];
          for (let frame = 0; frame < WALK_FRAME_COUNT; frame++) {
            const col = WALK_FRAME_START + frame;
            const key = `walk_${direction}_${frame}`;
            const texture = new Texture({
              source: walkTexture.source,
              frame: new Rectangle(
                col * FRAME_WIDTH,
                row * FRAME_HEIGHT,
                FRAME_WIDTH,
                FRAME_HEIGHT
              ),
            });
            textureCache.set(key, texture);
          }
        }
      }

      // Pre-generate texture frames for idle animation (multiple frames for breathing effect)
      if (idleTexture) {
        for (const direction of Object.keys(DIRECTION_ROW) as Direction[]) {
          const row = DIRECTION_ROW[direction];
          for (let frame = 0; frame < IDLE_FRAME_COUNT; frame++) {
            const key = `idle_${direction}_${frame}`;
            const texture = new Texture({
              source: idleTexture.source,
              frame: new Rectangle(
                frame * FRAME_WIDTH,
                row * FRAME_HEIGHT,
                FRAME_WIDTH,
                FRAME_HEIGHT
              ),
            });
            textureCache.set(key, texture);
          }
        }
      }

      return true;
    } catch (error) {
      console.warn('Failed to load LPC sprites, will use fallback:', error);
      loadFailed = true;
      return false;
    }
  })();

  return loadPromise;
}

/**
 * Get a texture for a specific direction, animation type, and frame
 */
export function getLPCTexture(
  direction: Direction,
  animation: AnimationType,
  frame: number = 0
): Texture | null {
  if (animation === 'idle') {
    // Idle animation - wrap frame number to valid range
    const wrappedFrame = frame % IDLE_FRAME_COUNT;
    return textureCache.get(`idle_${direction}_${wrappedFrame}`) || null;
  }

  // Walk animation - wrap frame number to valid range
  const wrappedFrame = frame % WALK_FRAME_COUNT;
  return textureCache.get(`walk_${direction}_${wrappedFrame}`) || null;
}

/**
 * Get all walk frames for a direction (for animated sprites)
 */
export function getWalkFrames(direction: Direction): Texture[] {
  const frames: Texture[] = [];
  for (let i = 0; i < WALK_FRAME_COUNT; i++) {
    const texture = textureCache.get(`walk_${direction}_${i}`);
    if (texture) {
      frames.push(texture);
    }
  }
  return frames;
}

/**
 * Get the idle texture for a direction and frame
 */
export function getIdleTexture(direction: Direction, frame: number = 0): Texture | null {
  const wrappedFrame = frame % IDLE_FRAME_COUNT;
  return textureCache.get(`idle_${direction}_${wrappedFrame}`) || null;
}

/**
 * Check if LPC sprites are loaded
 */
export function areLPCSpritesLoaded(): boolean {
  return !loadFailed && walkTexture !== null && idleTexture !== null;
}

/**
 * Calculate direction from movement vector
 */
export function getDirectionFromMovement(dx: number, dy: number): Direction {
  // If no movement, default to down
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
    return 'down';
  }

  // Determine primary direction based on larger movement component
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  } else {
    return dy > 0 ? 'down' : 'up';
  }
}

/**
 * Get the number of walk animation frames
 */
export function getWalkFrameCount(): number {
  return WALK_FRAME_COUNT;
}

/**
 * Get the number of idle animation frames
 */
export function getIdleFrameCount(): number {
  return IDLE_FRAME_COUNT;
}
