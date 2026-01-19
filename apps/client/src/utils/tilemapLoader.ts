import { Assets, Texture, Rectangle } from 'pixi.js';

// Animated overlay configuration
export interface AnimatedOverlay {
  id: string;
  spriteSheet: string;
  position: { x: number; y: number };
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  fps: number;
  scale?: number;
  anchor?: { x: number; y: number };
}

// Work area data structure
export interface WorkArea {
  id: string;
  name: string;
  roleTypes: string[];
  position: { x: number; y: number };
  radius: number;
}

export interface BasecampPath {
  from: { x: number; y: number };
  to: { x: number; y: number };
}

// Map data structure (simplified for static background approach)
export interface BasecampMapData {
  version?: string;
  type?: string;
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  backgroundImage?: string;
  animatedOverlays?: AnimatedOverlay[];
  properties?: {
    scale?: number;
  };
  workAreas: WorkArea[];
  fence: {
    topLeft: { x: number; y: number };
    bottomRight: { x: number; y: number };
  };
  entrance: {
    position: { x: number; y: number };
    width: number;
  };
  paths: BasecampPath[];
}

// Loaded overlay animation frames
interface LoadedOverlay {
  id: string;
  frames: Texture[];
  fps: number;
}

let mapData: BasecampMapData | null = null;
let loadPromise: Promise<BasecampMapData> | null = null;
let backgroundTexture: Texture | null = null;
let backgroundLoaded = false;
let loadedOverlays: Map<string, LoadedOverlay> = new Map();

/**
 * Load the basecamp map data
 */
export async function loadBasecampMap(): Promise<BasecampMapData> {
  if (mapData) return mapData;

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    try {
      const response = await fetch('/assets/maps/basecamp.json');
      if (!response.ok) {
        throw new Error(`Failed to load map: ${response.status}`);
      }
      const jsonData = await response.json();

      // Normalize the data
      mapData = normalizeMapData(jsonData);

      return mapData!;
    } catch (error) {
      console.error('Failed to load basecamp map:', error);
      mapData = getDefaultMapData();
      return mapData;
    }
  })();

  return loadPromise;
}

/**
 * Normalize map data to ensure consistent properties
 */
function normalizeMapData(data: any): BasecampMapData {
  return {
    ...data,
    tileWidth: data.tileWidth || data.tilewidth || 32,
    tileHeight: data.tileHeight || data.tileheight || 32,
  };
}

/**
 * Load the static background image
 */
export async function loadBackground(): Promise<boolean> {
  if (backgroundLoaded) return true;
  if (!mapData?.backgroundImage) {
    console.warn('[tilemap] No background image specified in map data');
    return false;
  }

  try {
    console.log('[tilemap] Loading background:', mapData.backgroundImage);
    backgroundTexture = await Assets.load(mapData.backgroundImage);
    backgroundLoaded = true;
    console.log('[tilemap] Background loaded successfully');
    return true;
  } catch (error) {
    console.error('[tilemap] Failed to load background:', error);
    return false;
  }
}

/**
 * Check if background is loaded
 */
export function isBackgroundLoaded(): boolean {
  return backgroundLoaded;
}

/**
 * Get the background texture
 */
export function getBackgroundTexture(): Texture | null {
  return backgroundTexture;
}

/**
 * Load an animated overlay sprite sheet
 */
export async function loadAnimatedOverlay(overlay: AnimatedOverlay): Promise<boolean> {
  if (loadedOverlays.has(overlay.id)) return true;

  try {
    console.log('[tilemap] Loading animated overlay:', overlay.id);
    const texture = await Assets.load(overlay.spriteSheet);

    // Create frames from sprite sheet (horizontal strip)
    const frames: Texture[] = [];
    for (let i = 0; i < overlay.frameCount; i++) {
      const frameTexture = new Texture({
        source: texture.source,
        frame: new Rectangle(
          i * overlay.frameWidth,
          0,
          overlay.frameWidth,
          overlay.frameHeight
        ),
      });
      frames.push(frameTexture);
    }

    loadedOverlays.set(overlay.id, {
      id: overlay.id,
      frames,
      fps: overlay.fps,
    });

    console.log('[tilemap] Overlay loaded:', overlay.id, 'frames:', frames.length);
    return true;
  } catch (error) {
    console.error('[tilemap] Failed to load overlay:', overlay.id, error);
    return false;
  }
}

/**
 * Load all animated overlays from map data
 */
export async function loadAllOverlays(): Promise<boolean> {
  if (!mapData?.animatedOverlays?.length) return true;

  let allLoaded = true;
  for (const overlay of mapData.animatedOverlays) {
    const loaded = await loadAnimatedOverlay(overlay);
    if (!loaded) allLoaded = false;
  }
  return allLoaded;
}

/**
 * Get a frame from an animated overlay
 */
export function getOverlayFrame(overlayId: string, animationFrame: number): Texture | null {
  const overlay = loadedOverlays.get(overlayId);
  if (!overlay || overlay.frames.length === 0) return null;

  return overlay.frames[animationFrame % overlay.frames.length];
}

/**
 * Get the loaded map data (synchronous, returns null if not loaded)
 */
export function getMapData(): BasecampMapData | null {
  return mapData;
}

/**
 * Get the display scale
 */
export function getDisplayScale(): number {
  return mapData?.properties?.scale || 2;
}

/**
 * Find work area for a given role
 */
export function findWorkAreaForRole(role: string): WorkArea | null {
  if (!mapData) return null;

  const roleLower = role.toLowerCase();

  for (const area of mapData.workAreas) {
    for (const roleType of area.roleTypes) {
      if (roleLower.includes(roleType)) {
        return area;
      }
    }
  }

  // Default to campfire for unmatched roles
  return mapData.workAreas.find((a) => a.id === 'campfire') || null;
}

/**
 * Get the campfire area (idle area)
 */
export function getCampfireArea(): WorkArea | null {
  if (!mapData) return null;
  return mapData.workAreas.find((a) => a.id === 'campfire') || null;
}

/**
 * Get all work areas
 */
export function getWorkAreas(): WorkArea[] {
  return mapData?.workAreas || [];
}

/**
 * Get world dimensions in pixels (accounting for scale)
 */
export function getWorldDimensions(): { width: number; height: number } {
  if (!mapData) {
    return { width: 1920, height: 1280 };
  }
  const scale = getDisplayScale();
  return {
    width: mapData.width * mapData.tileWidth * scale,
    height: mapData.height * mapData.tileHeight * scale,
  };
}

/**
 * Default map data if loading fails
 */
function getDefaultMapData(): BasecampMapData {
  return {
    width: 60,
    height: 40,
    tileWidth: 32,
    tileHeight: 32,
    workAreas: [
      {
        id: 'backend-tent',
        name: 'Backend Tent',
        roleTypes: ['backend', 'api', 'devops'],
        position: { x: 320, y: 256 },
        radius: 96,
      },
      {
        id: 'frontend-tent',
        name: 'Frontend Tent',
        roleTypes: ['frontend', 'ui'],
        position: { x: 1280, y: 256 },
        radius: 96,
      },
      {
        id: 'fullstack-area',
        name: 'Fullstack Area',
        roleTypes: ['fullstack', 'full stack'],
        position: { x: 320, y: 640 },
        radius: 96,
      },
      {
        id: 'ai-workshop',
        name: 'AI Workshop',
        roleTypes: ['ai', 'ml', 'machine learning'],
        position: { x: 1280, y: 640 },
        radius: 96,
      },
      {
        id: 'campfire',
        name: 'Central Campfire',
        roleTypes: [],
        position: { x: 800, y: 512 },
        radius: 128,
      },
      {
        id: 'qa-grounds',
        name: 'QA Grounds',
        roleTypes: ['qa', 'test', 'quality', 'design'],
        position: { x: 320, y: 960 },
        radius: 96,
      },
      {
        id: 'supply-area',
        name: 'Supply Area',
        roleTypes: [],
        position: { x: 1280, y: 960 },
        radius: 96,
      },
    ],
    fence: {
      topLeft: { x: 96, y: 64 },
      bottomRight: { x: 1824, y: 1216 },
    },
    entrance: {
      position: { x: 960, y: 1216 },
      width: 192,
    },
    paths: [
      { from: { x: 800, y: 512 }, to: { x: 320, y: 256 } },
      { from: { x: 800, y: 512 }, to: { x: 1280, y: 256 } },
      { from: { x: 800, y: 512 }, to: { x: 320, y: 640 } },
      { from: { x: 800, y: 512 }, to: { x: 1280, y: 640 } },
      { from: { x: 800, y: 512 }, to: { x: 320, y: 960 } },
      { from: { x: 800, y: 512 }, to: { x: 1280, y: 960 } },
      { from: { x: 800, y: 512 }, to: { x: 960, y: 1216 } },
    ],
  };
}
