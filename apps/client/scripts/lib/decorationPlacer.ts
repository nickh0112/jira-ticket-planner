/**
 * Decoration Placement System
 *
 * Places rocks, flowers, and other decorations with intentional logic:
 * - Path edges get rocks and small flowers
 * - Open grass areas get sparse decorations
 * - Work area borders get light vegetation rings
 */

import { DECORATIONS, TerrainType } from './tileConstants.js';
import type { PRNG } from './prng.js';
import type { TerrainGrid } from './autotiler.js';
import type { Point } from './pathGenerator.js';

export type DecorationConfig = {
  workAreas: Point[];
  center: Point;
  pathEdgeChance: number;      // Chance to place decoration on path edge (0-1)
  sparseGrassChance: number;   // Chance for random decoration in open grass
  workAreaRingRadius: number;  // Radius for work area decoration ring
};

/**
 * Check if a tile is on the edge of a path (dirt adjacent to grass)
 */
function isPathEdge(terrain: TerrainGrid, x: number, y: number): boolean {
  const height = terrain.length;
  const width = terrain[0].length;

  // Must be grass
  if (terrain[y][x] !== TerrainType.GRASS) {
    return false;
  }

  // Check 4-connected neighbors for dirt
  const neighbors = [
    [0, -1], // N
    [1, 0],  // E
    [0, 1],  // S
    [-1, 0], // W
  ];

  for (const [dx, dy] of neighbors) {
    const nx = x + dx;
    const ny = y + dy;

    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
      if (terrain[ny][nx] === TerrainType.DIRT) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if position is in the ring around a work area
 */
function isInWorkAreaRing(
  x: number,
  y: number,
  workAreas: Point[],
  innerRadius: number,
  outerRadius: number
): boolean {
  for (const area of workAreas) {
    const dx = x - area.x;
    const dy = y - area.y;
    const distSq = dx * dx + dy * dy;

    if (distSq >= innerRadius * innerRadius && distSq <= outerRadius * outerRadius) {
      return true;
    }
  }
  return false;
}

/**
 * Place decorations throughout the map
 */
export function placeDecorations(
  terrain: TerrainGrid,
  vegetation: number[][],
  config: DecorationConfig,
  rng: PRNG
): number[][] {
  const { workAreas, center, pathEdgeChance, sparseGrassChance, workAreaRingRadius } = config;

  const height = terrain.length;
  const width = terrain[0].length;

  // Initialize decoration layer
  const decorations: number[][] = [];
  for (let y = 0; y < height; y++) {
    decorations[y] = new Array(width).fill(0);
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Skip if already has vegetation
      if (vegetation[y][x] !== 0) continue;

      // Skip if not grass
      if (terrain[y][x] !== TerrainType.GRASS) continue;

      // Skip center area
      const dx = x - center.x;
      const dy = y - center.y;
      if (dx * dx + dy * dy < 36) continue; // 6 tile radius

      // Priority 1: Path edges
      if (isPathEdge(terrain, x, y)) {
        if (rng.chance(pathEdgeChance)) {
          // Prefer rocks near paths, occasional flowers
          if (rng.chance(0.6)) {
            decorations[y][x] = rng.pick(DECORATIONS.ROCKS);
          } else {
            decorations[y][x] = rng.pick(DECORATIONS.FLOWERS);
          }
        }
        continue;
      }

      // Priority 2: Work area rings
      if (isInWorkAreaRing(x, y, workAreas, 4, workAreaRingRadius)) {
        if (rng.chance(0.12)) {
          // Mix of small bushes and flowers
          if (rng.chance(0.4)) {
            decorations[y][x] = rng.pick(DECORATIONS.BUSHES);
          } else {
            decorations[y][x] = rng.pick(DECORATIONS.FLOWERS);
          }
        }
        continue;
      }

      // Priority 3: Sparse grass decorations
      if (rng.chance(sparseGrassChance)) {
        // Mostly grass tufts with occasional flowers
        if (rng.chance(0.7)) {
          decorations[y][x] = rng.pick(DECORATIONS.GRASS_TUFTS);
        } else {
          decorations[y][x] = rng.pick(DECORATIONS.FLOWERS);
        }
      }
    }
  }

  return decorations;
}

/**
 * Create intentional flower patches
 */
export function createFlowerPatches(
  terrain: TerrainGrid,
  decorations: number[][],
  rng: PRNG,
  numPatches: number = 5
): void {
  const height = terrain.length;
  const width = terrain[0].length;

  for (let i = 0; i < numPatches; i++) {
    // Random patch center
    const cx = rng.randInt(Math.floor(width * 0.2), Math.floor(width * 0.8));
    const cy = rng.randInt(Math.floor(height * 0.2), Math.floor(height * 0.8));

    // Skip if on path
    if (terrain[cy][cx] !== TerrainType.GRASS) continue;

    const patchRadius = rng.randInt(2, 4);
    const flowerType = rng.pick(DECORATIONS.FLOWERS);

    for (let dy = -patchRadius; dy <= patchRadius; dy++) {
      for (let dx = -patchRadius; dx <= patchRadius; dx++) {
        const px = cx + dx;
        const py = cy + dy;

        if (px < 0 || px >= width || py < 0 || py >= height) continue;
        if (terrain[py][px] !== TerrainType.GRASS) continue;
        if (decorations[py][px] !== 0) continue;

        const dist = Math.sqrt(dx * dx + dy * dy);
        const chance = 0.5 * (1 - dist / patchRadius);

        if (rng.chance(chance)) {
          // Use same flower type for patch cohesion
          decorations[py][px] = flowerType;
        }
      }
    }
  }
}
