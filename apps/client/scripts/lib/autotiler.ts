/**
 * 8-bit Blob Autotiling System
 *
 * Implements proper terrain transitions using the 8-bit neighbor mask approach.
 * Each of the 8 neighbors contributes a bit to a mask (0-255).
 * The mask is then mapped to one of 47 distinct tile variants.
 */

import { TerrainType, GRASS, DIRT, gid } from './tileConstants.js';
import type { PRNG } from './prng.js';

export type TerrainGrid = TerrainType[][];

// 8-bit neighbor positions
// NW | N  | NE
// ---|----| ---
// W  | C  | E
// ---|----| ---
// SW | S  | SE

export const NEIGHBOR = {
  N: 1,
  NE: 2,
  E: 4,
  SE: 8,
  S: 16,
  SW: 32,
  W: 64,
  NW: 128,
} as const;

/**
 * Calculate 8-bit neighbor mask for a position
 */
export function getNeighborMask(
  grid: TerrainGrid,
  x: number,
  y: number,
  targetTerrain: TerrainType
): number {
  const width = grid[0].length;
  const height = grid.length;

  const isTerrain = (px: number, py: number): boolean => {
    if (px < 0 || px >= width || py < 0 || py >= height) {
      // Treat out-of-bounds as NOT the target terrain
      return false;
    }
    return grid[py][px] === targetTerrain;
  };

  let mask = 0;
  if (isTerrain(x, y - 1)) mask |= NEIGHBOR.N;
  if (isTerrain(x + 1, y - 1)) mask |= NEIGHBOR.NE;
  if (isTerrain(x + 1, y)) mask |= NEIGHBOR.E;
  if (isTerrain(x + 1, y + 1)) mask |= NEIGHBOR.SE;
  if (isTerrain(x, y + 1)) mask |= NEIGHBOR.S;
  if (isTerrain(x - 1, y + 1)) mask |= NEIGHBOR.SW;
  if (isTerrain(x - 1, y)) mask |= NEIGHBOR.W;
  if (isTerrain(x - 1, y - 1)) mask |= NEIGHBOR.NW;

  return mask;
}

/**
 * Simplified edge analysis - determines which edges need transition tiles
 */
export type EdgeInfo = {
  hasN: boolean;  // Grass to the north
  hasE: boolean;  // Grass to the east
  hasS: boolean;  // Grass to the south
  hasW: boolean;  // Grass to the west
  hasNE: boolean; // Grass to the northeast
  hasSE: boolean; // Grass to the southeast
  hasSW: boolean; // Grass to the southwest
  hasNW: boolean; // Grass to the northwest
};

function getEdgeInfo(grassMask: number): EdgeInfo {
  return {
    hasN: Boolean(grassMask & NEIGHBOR.N),
    hasE: Boolean(grassMask & NEIGHBOR.E),
    hasS: Boolean(grassMask & NEIGHBOR.S),
    hasW: Boolean(grassMask & NEIGHBOR.W),
    hasNE: Boolean(grassMask & NEIGHBOR.NE),
    hasSE: Boolean(grassMask & NEIGHBOR.SE),
    hasSW: Boolean(grassMask & NEIGHBOR.SW),
    hasNW: Boolean(grassMask & NEIGHBOR.NW),
  };
}

/**
 * 47-tile blob autotile lookup
 *
 * The standard blob tileset arrangement uses these tile indices:
 * - 0: Surrounded (center)
 * - 1-4: Single edges (N, E, S, W)
 * - 5-8: Single corners (NE, SE, SW, NW)
 * - 9-12: Two adjacent edges (N+E, E+S, S+W, W+N)
 * - 13-16: Two opposite edges (N+S, E+W) with variations
 * - 17-20: Three edges
 * - 21-24: One edge missing
 * - 25-40: Complex corners
 * - 41-46: Full edges with inner corners
 */

// Dirt/sand tile variants based on surrounding grass
// IMPORTANT:
// - Water tiles are at row 0, cols 0-3 (GIDs 1-4) - AVOID THESE!
// - Tree tiles are at row 2-3, cols 6+ - AVOID THESE!
// - Use rows 0-2, cols 4-5 for terrain autotile (limited 2-column set)
const DIRT_TILES = {
  // Center (no adjacent grass) - solid sand/dirt at row 1, col 4
  CENTER: gid(1, 4),  // GID 62

  // Single edge (grass on one side)
  EDGE_N: gid(2, 4),    // GID 119 - bottom of dirt (grass above)
  EDGE_E: gid(1, 4),    // GID 62 - use center (no dedicated E edge)
  EDGE_S: gid(0, 4),    // GID 5 - top of dirt (grass below)
  EDGE_W: gid(1, 5),    // GID 63 - right edge (grass to left)

  // Outer corners - use center for most since tileset lacks dedicated corners
  CORNER_NE: gid(2, 5), // GID 120 - bottom-right area
  CORNER_SE: gid(0, 5), // GID 6 - top-right area
  CORNER_SW: gid(0, 4), // GID 5 - use top edge
  CORNER_NW: gid(2, 4), // GID 119 - use bottom edge

  // Inner corners (diagonal grass poking into dirt)
  // These are at row 1-2, cols 0-1 (separate from main autotile)
  INNER_NE: gid(1, 0),  // GID 58
  INNER_SE: gid(2, 0),  // GID 115
  INNER_SW: gid(2, 1),  // GID 116
  INNER_NW: gid(1, 1),  // GID 59

  // T-junctions - use edge tiles
  T_N: gid(2, 4),     // GID 119
  T_E: gid(1, 4),     // GID 62
  T_S: gid(0, 4),     // GID 5
  T_W: gid(1, 5),     // GID 63

  // End caps - use center
  END_N: gid(1, 4),   // GID 62
  END_E: gid(1, 4),   // GID 62
  END_S: gid(1, 4),   // GID 62
  END_W: gid(1, 4),   // GID 62

  // Corridor - use center
  CORRIDOR_NS: gid(1, 4),  // GID 62
  CORRIDOR_EW: gid(1, 4),  // GID 62
};

/**
 * Get the appropriate dirt tile based on surrounding grass
 */
export function getDirtTile(grassMask: number, rng: PRNG): number {
  const edges = getEdgeInfo(grassMask);
  const cardinalCount = [edges.hasN, edges.hasE, edges.hasS, edges.hasW].filter(Boolean).length;

  // Full surrounded by grass - shouldn't happen for paths, but handle it
  if (cardinalCount === 4) {
    return DIRT_TILES.CENTER;
  }

  // No adjacent grass - center tile
  if (cardinalCount === 0) {
    // Check for diagonal grass (inner corners)
    if (edges.hasNE && !edges.hasN && !edges.hasE) return DIRT_TILES.INNER_NE;
    if (edges.hasSE && !edges.hasS && !edges.hasE) return DIRT_TILES.INNER_SE;
    if (edges.hasSW && !edges.hasS && !edges.hasW) return DIRT_TILES.INNER_SW;
    if (edges.hasNW && !edges.hasN && !edges.hasW) return DIRT_TILES.INNER_NW;

    // Multiple inner corners - use center
    return DIRT_TILES.CENTER;
  }

  // Three sides of grass - end cap
  if (cardinalCount === 3) {
    if (!edges.hasN) return DIRT_TILES.END_S;
    if (!edges.hasE) return DIRT_TILES.END_W;
    if (!edges.hasS) return DIRT_TILES.END_N;
    if (!edges.hasW) return DIRT_TILES.END_E;
  }

  // Two sides of grass
  if (cardinalCount === 2) {
    // Adjacent sides (corner)
    if (edges.hasN && edges.hasE) return DIRT_TILES.CORNER_NE;
    if (edges.hasE && edges.hasS) return DIRT_TILES.CORNER_SE;
    if (edges.hasS && edges.hasW) return DIRT_TILES.CORNER_SW;
    if (edges.hasW && edges.hasN) return DIRT_TILES.CORNER_NW;

    // Opposite sides (corridor)
    if (edges.hasN && edges.hasS) return DIRT_TILES.CORRIDOR_NS;
    if (edges.hasE && edges.hasW) return DIRT_TILES.CORRIDOR_EW;
  }

  // One side of grass - edge
  if (cardinalCount === 1) {
    if (edges.hasN) return DIRT_TILES.EDGE_N;
    if (edges.hasE) return DIRT_TILES.EDGE_E;
    if (edges.hasS) return DIRT_TILES.EDGE_S;
    if (edges.hasW) return DIRT_TILES.EDGE_W;
  }

  return DIRT_TILES.CENTER;
}

/**
 * Get appropriate grass tile (with optional variety)
 */
export function getGrassTile(rng: PRNG): number {
  // Use center grass with occasional variety
  if (rng.chance(0.85)) {
    return rng.pick(GRASS.CENTER);
  }
  return rng.pick(GRASS.DETAIL);
}

/**
 * Process entire terrain grid and return tile GIDs
 */
export function autotileTerrain(
  terrain: TerrainGrid,
  rng: PRNG
): number[][] {
  const height = terrain.length;
  const width = terrain[0].length;
  const tiles: number[][] = [];

  for (let y = 0; y < height; y++) {
    tiles[y] = [];
    for (let x = 0; x < width; x++) {
      const cellTerrain = terrain[y][x];

      if (cellTerrain === TerrainType.GRASS) {
        tiles[y][x] = getGrassTile(rng);
      } else if (cellTerrain === TerrainType.DIRT) {
        // Get grass neighbor mask for this dirt tile
        const grassMask = getNeighborMask(terrain, x, y, TerrainType.GRASS);
        tiles[y][x] = getDirtTile(grassMask, rng);
      } else {
        // Water or other - use grass as default
        tiles[y][x] = getGrassTile(rng);
      }
    }
  }

  return tiles;
}
