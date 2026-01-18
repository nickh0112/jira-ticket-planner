// Tilemap data structure
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

export interface BasecampMapData {
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
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

let mapData: BasecampMapData | null = null;
let loadPromise: Promise<BasecampMapData> | null = null;

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
      mapData = await response.json();
      return mapData!;
    } catch (error) {
      console.error('Failed to load basecamp map:', error);
      // Return default map data
      mapData = getDefaultMapData();
      return mapData;
    }
  })();

  return loadPromise;
}

/**
 * Get the loaded map data (synchronous, returns null if not loaded)
 */
export function getMapData(): BasecampMapData | null {
  return mapData;
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
 * Get world dimensions in pixels
 */
export function getWorldDimensions(): { width: number; height: number } {
  if (!mapData) {
    return { width: 1920, height: 1280 };
  }
  return {
    width: mapData.width * mapData.tileWidth,
    height: mapData.height * mapData.tileHeight,
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
