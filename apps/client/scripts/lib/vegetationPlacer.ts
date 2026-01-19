/**
 * Vegetation Placement System
 *
 * Uses Poisson disk sampling for natural-looking tree clusters
 * and intentional placement around map edges.
 */

import { TREES, TerrainType } from './tileConstants.js';
import type { PRNG } from './prng.js';
import type { TerrainGrid } from './autotiler.js';
import type { Point } from './pathGenerator.js';

export type VegetationConfig = {
  mapWidth: number;
  mapHeight: number;
  excludeAreas: Point[];     // Work areas to keep clear
  excludeRadius: number;     // Radius around work areas to keep clear
  center: Point;             // Map center (campfire)
  centerClearRadius: number; // Keep center clear
};

/**
 * Poisson disk sampling using Bridson's algorithm
 * Creates evenly-spaced points with natural distribution
 */
export function poissonDiskSample(
  width: number,
  height: number,
  minDist: number,
  rng: PRNG,
  maxAttempts: number = 30
): Point[] {
  const cellSize = minDist / Math.SQRT2;
  const gridWidth = Math.ceil(width / cellSize);
  const gridHeight = Math.ceil(height / cellSize);

  // Grid to track which cells have points
  const grid: (Point | null)[][] = [];
  for (let y = 0; y < gridHeight; y++) {
    grid[y] = new Array(gridWidth).fill(null);
  }

  const points: Point[] = [];
  const active: Point[] = [];

  // Helper to get grid cell for a point
  const getCell = (p: Point): { gx: number; gy: number } => ({
    gx: Math.floor(p.x / cellSize),
    gy: Math.floor(p.y / cellSize),
  });

  // Check if point is valid (far enough from all neighbors)
  const isValid = (p: Point): boolean => {
    if (p.x < 0 || p.x >= width || p.y < 0 || p.y >= height) {
      return false;
    }

    const { gx, gy } = getCell(p);

    // Check surrounding cells
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = gx + dx;
        const ny = gy + dy;

        if (nx >= 0 && nx < gridWidth && ny >= 0 && ny < gridHeight) {
          const neighbor = grid[ny][nx];
          if (neighbor) {
            const dist = Math.sqrt(
              (p.x - neighbor.x) ** 2 + (p.y - neighbor.y) ** 2
            );
            if (dist < minDist) {
              return false;
            }
          }
        }
      }
    }

    return true;
  };

  // Add a point
  const addPoint = (p: Point): void => {
    const { gx, gy } = getCell(p);
    grid[gy][gx] = p;
    points.push(p);
    active.push(p);
  };

  // Start with a random point
  const startPoint: Point = {
    x: rng.randFloat(0, width),
    y: rng.randFloat(0, height),
  };
  addPoint(startPoint);

  // Process active list
  while (active.length > 0) {
    const idx = rng.randInt(0, active.length - 1);
    const point = active[idx];
    let found = false;

    for (let i = 0; i < maxAttempts; i++) {
      // Generate random point in annulus around active point
      const angle = rng.random() * Math.PI * 2;
      const dist = minDist + rng.random() * minDist;

      const newPoint: Point = {
        x: point.x + Math.cos(angle) * dist,
        y: point.y + Math.sin(angle) * dist,
      };

      if (isValid(newPoint)) {
        addPoint(newPoint);
        found = true;
        break;
      }
    }

    if (!found) {
      active.splice(idx, 1);
    }
  }

  return points;
}

/**
 * Create tree clusters in corners and edges of the map
 */
export function createTreeClusters(
  terrain: TerrainGrid,
  config: VegetationConfig,
  rng: PRNG
): number[][] {
  const { mapWidth, mapHeight, excludeAreas, excludeRadius, center, centerClearRadius } = config;

  // Initialize vegetation layer (0 = no tree)
  const vegetation: number[][] = [];
  for (let y = 0; y < mapHeight; y++) {
    vegetation[y] = new Array(mapWidth).fill(0);
  }

  // Helper to check if position is clear (not path, not too close to work areas)
  const isClearPosition = (x: number, y: number): boolean => {
    // Must be on grass
    if (terrain[y][x] !== TerrainType.GRASS) {
      return false;
    }

    // Check center exclusion
    const dx = x - center.x;
    const dy = y - center.y;
    if (dx * dx + dy * dy < centerClearRadius * centerClearRadius) {
      return false;
    }

    // Check work area exclusions
    for (const area of excludeAreas) {
      const ax = x - area.x;
      const ay = y - area.y;
      if (ax * ax + ay * ay < excludeRadius * excludeRadius) {
        return false;
      }
    }

    return true;
  };

  // Define cluster zones (corners and edges)
  const clusterZones: Array<{ x: number; y: number; width: number; height: number; density: number }> = [
    // Corners (denser)
    { x: 0, y: 0, width: mapWidth * 0.25, height: mapHeight * 0.25, density: 0.6 },
    { x: mapWidth * 0.75, y: 0, width: mapWidth * 0.25, height: mapHeight * 0.25, density: 0.6 },
    { x: 0, y: mapHeight * 0.75, width: mapWidth * 0.25, height: mapHeight * 0.25, density: 0.6 },
    { x: mapWidth * 0.75, y: mapHeight * 0.75, width: mapWidth * 0.25, height: mapHeight * 0.25, density: 0.6 },

    // Edges (medium density)
    { x: mapWidth * 0.25, y: 0, width: mapWidth * 0.5, height: mapHeight * 0.1, density: 0.4 },
    { x: mapWidth * 0.25, y: mapHeight * 0.9, width: mapWidth * 0.5, height: mapHeight * 0.1, density: 0.4 },
    { x: 0, y: mapHeight * 0.25, width: mapWidth * 0.1, height: mapHeight * 0.5, density: 0.4 },
    { x: mapWidth * 0.9, y: mapHeight * 0.25, width: mapWidth * 0.1, height: mapHeight * 0.5, density: 0.4 },
  ];

  // Use Poisson disk to place cluster centers
  const clusterCenters = poissonDiskSample(mapWidth, mapHeight, 8, rng);

  // For each potential cluster center, check if it's in a cluster zone
  for (const clusterCenter of clusterCenters) {
    const cx = Math.floor(clusterCenter.x);
    const cy = Math.floor(clusterCenter.y);

    if (cx < 0 || cx >= mapWidth || cy < 0 || cy >= mapHeight) continue;

    // Find which zone (if any) this point is in
    let inZone = false;
    let zoneDensity = 0;

    for (const zone of clusterZones) {
      if (
        clusterCenter.x >= zone.x &&
        clusterCenter.x < zone.x + zone.width &&
        clusterCenter.y >= zone.y &&
        clusterCenter.y < zone.y + zone.height
      ) {
        inZone = true;
        zoneDensity = zone.density;
        break;
      }
    }

    // Skip points not in cluster zones (or use very low density for scattered trees)
    if (!inZone) {
      // Occasional scattered tree
      if (rng.chance(0.05) && isClearPosition(cx, cy)) {
        vegetation[cy][cx] = rng.pick(TREES.ALL);
      }
      continue;
    }

    // Create cluster around this center
    const clusterRadius = rng.randInt(3, 6);
    const treeType = rng.chance(0.6) ? TREES.DECIDUOUS : TREES.PINE;

    for (let dy = -clusterRadius; dy <= clusterRadius; dy++) {
      for (let dx = -clusterRadius; dx <= clusterRadius; dx++) {
        const px = cx + dx;
        const py = cy + dy;

        if (px < 0 || px >= mapWidth || py < 0 || py >= mapHeight) continue;

        // Distance-based density falloff
        const dist = Math.sqrt(dx * dx + dy * dy);
        const normalizedDist = dist / clusterRadius;

        // Higher chance near center, lower at edges
        const placementChance = zoneDensity * (1 - normalizedDist * 0.7);

        if (rng.chance(placementChance) && isClearPosition(px, py)) {
          // Pick tree from the cluster type with occasional variation
          if (rng.chance(0.9)) {
            vegetation[py][px] = rng.pick(treeType);
          } else {
            vegetation[py][px] = rng.pick(TREES.ALL);
          }
        }
      }
    }
  }

  return vegetation;
}

/**
 * Add border trees to frame the map
 */
export function addBorderTrees(
  terrain: TerrainGrid,
  vegetation: number[][],
  rng: PRNG,
  borderWidth: number = 2
): void {
  const height = terrain.length;
  const width = terrain[0].length;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Check if on border
      const onBorder =
        x < borderWidth ||
        x >= width - borderWidth ||
        y < borderWidth ||
        y >= height - borderWidth;

      if (!onBorder) continue;

      // Only place on grass, don't overwrite existing vegetation
      if (terrain[y][x] !== TerrainType.GRASS) continue;
      if (vegetation[y][x] !== 0) continue;

      // High chance for border trees
      if (rng.chance(0.7)) {
        vegetation[y][x] = rng.pick(TREES.ALL);
      }
    }
  }
}
