import { Assets, Texture, Rectangle } from 'pixi.js';

// Sprite atlas data type
interface SpriteAtlas {
  meta: {
    image: string;
    size: { w: number; h: number };
    scale: string;
  };
  frames: Record<string, {
    frame: { x: number; y: number; w: number; h: number };
    sourceSize: { w: number; h: number };
  }>;
  roleMapping: Record<string, string>;
}

// Sprite type for units
export type SpriteType = 'knight' | 'wizard' | 'paladin' | 'ranger' | 'golem';

// Animation frame names
export type AnimationFrame = 'idle' | 'walk1' | 'walk2';

// Loaded sprite data
let spriteAtlas: SpriteAtlas | null = null;
let baseTexture: Texture | null = null;
let textureCache: Map<string, Texture> = new Map();
let loadPromise: Promise<void> | null = null;
let loadFailed = false;

// Basecamp assets
let tentTexture: Texture | null = null;
let campfireTextures: Texture[] = [];
let basecampAssetsLoaded = false;

/**
 * Load the character spritesheet and atlas
 */
export async function loadCharacterSprites(): Promise<boolean> {
  if (loadFailed) return false;
  if (spriteAtlas && baseTexture) return true;

  if (loadPromise) {
    await loadPromise;
    return !loadFailed;
  }

  loadPromise = (async () => {
    try {
      // Load the atlas JSON
      const atlasResponse = await fetch('/assets/sprites/characters.json');
      if (!atlasResponse.ok) {
        throw new Error(`Failed to load atlas: ${atlasResponse.status}`);
      }
      spriteAtlas = await atlasResponse.json();

      // Load the spritesheet texture
      baseTexture = await Assets.load('/assets/sprites/characters.png');

      // Pre-create textures for all frames
      if (spriteAtlas && baseTexture) {
        for (const [frameName, frameData] of Object.entries(spriteAtlas.frames)) {
          const { x, y, w, h } = frameData.frame;
          const texture = new Texture({
            source: baseTexture.source,
            frame: new Rectangle(x, y, w, h),
          });
          textureCache.set(frameName, texture);
        }
      }
    } catch (error) {
      console.warn('Failed to load character sprites, will use fallback circles:', error);
      loadFailed = true;
    }
  })();

  await loadPromise;
  return !loadFailed;
}

/**
 * Get the sprite type for a given role
 */
export function getSpriteTypeForRole(role: string): SpriteType {
  if (!spriteAtlas) return 'knight';

  const roleLower = role.toLowerCase();

  for (const [keyword, spriteType] of Object.entries(spriteAtlas.roleMapping)) {
    if (keyword !== 'default' && roleLower.includes(keyword)) {
      return spriteType as SpriteType;
    }
  }

  return 'knight';
}

/**
 * Get a texture for a specific sprite type and animation frame
 */
export function getSpriteTexture(spriteType: SpriteType, frame: AnimationFrame = 'idle'): Texture | null {
  const frameName = `${spriteType}_${frame}`;
  return textureCache.get(frameName) || null;
}

/**
 * Check if sprites are loaded and available
 */
export function areSpritesLoaded(): boolean {
  return !loadFailed && spriteAtlas !== null && baseTexture !== null;
}

/**
 * Get color for a sprite type (used as tint or fallback)
 */
export function getSpriteTypeColor(spriteType: SpriteType): number {
  switch (spriteType) {
    case 'wizard':
      return 0x9B59B6; // Purple for Frontend/UI
    case 'knight':
      return 0x3498DB; // Blue for Backend/DevOps
    case 'paladin':
      return 0x1ABC9C; // Teal for Fullstack
    case 'ranger':
      return 0x27AE60; // Green for QA/Design
    case 'golem':
      return 0x7F8C8D; // Gray for AI/ML
    default:
      return 0x95A5A6;
  }
}

/**
 * Get animation frames for a walking animation
 */
export function getWalkingFrames(spriteType: SpriteType): Texture[] {
  const frames: Texture[] = [];
  const idle = getSpriteTexture(spriteType, 'idle');
  const walk1 = getSpriteTexture(spriteType, 'walk1');
  const walk2 = getSpriteTexture(spriteType, 'walk2');

  if (idle) frames.push(idle);
  if (walk1) frames.push(walk1);
  if (idle) frames.push(idle);
  if (walk2) frames.push(walk2);

  return frames;
}

/**
 * Load basecamp assets (tent and campfire)
 */
export async function loadBasecampAssets(): Promise<boolean> {
  if (basecampAssetsLoaded) return true;

  try {
    // Load tent texture
    tentTexture = await Assets.load('/assets/sprites/tent.png');

    // Load campfire spritesheet and create animation frames
    const campfireSheet = await Assets.load('/assets/sprites/campfire.png');
    // Campfire is 128x32, so 4 frames of 32x32
    for (let i = 0; i < 4; i++) {
      const texture = new Texture({
        source: campfireSheet.source,
        frame: new Rectangle(i * 32, 0, 32, 32),
      });
      campfireTextures.push(texture);
    }

    basecampAssetsLoaded = true;
    return true;
  } catch (error) {
    console.warn('Failed to load basecamp assets:', error);
    return false;
  }
}

/**
 * Get the tent texture
 */
export function getTentTexture(): Texture | null {
  return tentTexture;
}

/**
 * Get campfire animation frames
 */
export function getCampfireFrames(): Texture[] {
  return campfireTextures;
}

/**
 * Check if basecamp assets are loaded
 */
export function areBasecampAssetsLoaded(): boolean {
  return basecampAssetsLoaded;
}
