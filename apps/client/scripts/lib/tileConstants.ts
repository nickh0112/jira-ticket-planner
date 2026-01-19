/**
 * Tile GID constants for roguelike.png tileset
 *
 * Tileset: 57 columns, 16x16 tiles, 1px spacing
 * GID formula: GID = row * 57 + col + 1
 */

const COLS = 57;

// Helper to calculate GID from row/col
export const gid = (row: number, col: number): number => row * COLS + col + 1;

// ============================================
// GRASS TILES (green solid grass)
// ============================================
export const GRASS = {
  // Center grass tiles (for variety)
  CENTER: [gid(1, 5), gid(1, 6), gid(1, 7), gid(1, 8)], // 63, 64, 65, 66
  // Grass with small details
  DETAIL: [gid(2, 0), gid(2, 1), gid(2, 2)], // 115, 116, 117
} as const;

// ============================================
// DIRT/PATH TILES (brown/tan solid)
// ============================================
export const DIRT = {
  // Solid dirt center tiles - Row 5 has clean brown tiles
  CENTER: [gid(5, 0), gid(5, 1), gid(5, 2)], // 286, 287, 288
  // Alternate dirt (lighter tan)
  LIGHT: [gid(4, 0), gid(4, 1), gid(4, 2)], // 229, 230, 231
} as const;

// ============================================
// GRASS-DIRT AUTOTILE TRANSITIONS
// ============================================
// 8-bit blob autotiling: Each neighbor contributes a bit
// Bit positions: N=1, NE=2, E=4, SE=8, S=16, SW=32, W=64, NW=128
//
// The transition tiles in the tileset follow a standard pattern
// located in rows 0-3, cols 0-5
export const TRANSITIONS = {
  // Top row transitions (grass on top, dirt below)
  GRASS_N: gid(0, 4),     // Grass to north
  GRASS_NE: gid(0, 5),    // Grass to north-east
  GRASS_E: gid(1, 5),     // Grass to east
  GRASS_SE: gid(2, 5),    // Grass to south-east
  GRASS_S: gid(2, 4),     // Grass to south
  GRASS_SW: gid(2, 3),    // Grass to south-west
  GRASS_W: gid(1, 3),     // Grass to west
  GRASS_NW: gid(0, 3),    // Grass to north-west

  // Corner pieces (inside corners where dirt meets grass)
  INNER_NE: gid(1, 0),    // Inner corner NE
  INNER_SE: gid(2, 0),    // Inner corner SE
  INNER_SW: gid(2, 1),    // Inner corner SW
  INNER_NW: gid(1, 1),    // Inner corner NW

  // Outer corners
  OUTER_NE: gid(0, 6),
  OUTER_SE: gid(3, 6),
  OUTER_SW: gid(3, 3),
  OUTER_NW: gid(0, 3),
} as const;

// Simplified 47-tile blob lookup table
// Maps 8-bit neighbor mask to tile type
// This is a simplified version - full implementation would have 256 entries
export const BLOB_TILES: Record<number, number> = createBlobLookup();

function createBlobLookup(): Record<number, number> {
  const lookup: Record<number, number> = {};

  // For each possible 8-bit combination, map to appropriate tile
  // We simplify by using key transition patterns

  // Default: if surrounded by same terrain, use center
  for (let i = 0; i < 256; i++) {
    // Start with center dirt (we're autotiling dirt edges)
    lookup[i] = DIRT.CENTER[0];
  }

  // The actual blob autotile mapping would be more complex
  // For now, we use a simplified edge-based approach
  return lookup;
}

// ============================================
// TREES & VEGETATION
// ============================================
export const TREES = {
  // Deciduous trees (round green tops)
  DECIDUOUS_SMALL: gid(2, 6),   // 121 - Small bush/tree
  DECIDUOUS_MED: gid(2, 7),     // 122 - Medium tree
  DECIDUOUS_LARGE: gid(2, 8),   // 123 - Large tree

  // Pine/conifer trees (triangular)
  PINE_SMALL: gid(3, 6),        // 178 - Small pine
  PINE_MED: gid(3, 7),          // 179 - Medium pine
  PINE_LARGE: gid(3, 8),        // 180 - Large pine

  // All tree variants for random selection
  ALL: [gid(2, 6), gid(2, 7), gid(2, 8), gid(3, 6), gid(3, 7), gid(3, 8)],

  // Just deciduous (for variety groups)
  DECIDUOUS: [gid(2, 6), gid(2, 7), gid(2, 8)],
  PINE: [gid(3, 6), gid(3, 7), gid(3, 8)],
} as const;

// ============================================
// DECORATIONS
// ============================================
export const DECORATIONS = {
  // Flowers
  FLOWER_RED: gid(2, 9),        // 124
  FLOWER_YELLOW: gid(2, 10),    // 125
  FLOWER_BLUE: gid(3, 9),       // 181

  // Rocks
  ROCK_SMALL: gid(3, 10),       // 182
  ROCK_MED: gid(3, 11),         // 183
  ROCK_LARGE: gid(4, 10),       // 239

  // Bushes
  BUSH_SMALL: gid(2, 11),       // 126
  BUSH_MED: gid(3, 12),         // 184

  // Grass tufts
  GRASS_TUFT: gid(2, 12),       // 127
  GRASS_TALL: gid(2, 13),       // 128

  // Categorized for placement
  FLOWERS: [gid(2, 9), gid(2, 10), gid(3, 9)],
  ROCKS: [gid(3, 10), gid(3, 11), gid(4, 10)],
  BUSHES: [gid(2, 11), gid(3, 12)],
  GRASS_TUFTS: [gid(2, 12), gid(2, 13)],

  // Path edge decorations (rocks and small plants)
  PATH_EDGE: [gid(3, 10), gid(3, 11), gid(2, 9), gid(2, 10)],
} as const;

// ============================================
// WATER TILES (to avoid for paths!)
// ============================================
export const WATER = {
  // Row 0, cols 0-3 are CYAN WATER - DO NOT use for paths!
  CENTER: [gid(0, 0), gid(0, 1), gid(0, 2), gid(0, 3)], // 1, 2, 3, 4
} as const;

// ============================================
// TERRAIN TYPES
// ============================================
export enum TerrainType {
  GRASS = 0,
  DIRT = 1,
  WATER = 2,
}

// ============================================
// SIMPLIFIED AUTOTILE LOOKUP
// ============================================
// For grass-to-dirt transitions, we use a simplified approach:
// Instead of full 256-entry lookup, we categorize by edge pattern

export type EdgePattern = 'center' | 'edge_n' | 'edge_e' | 'edge_s' | 'edge_w' |
  'corner_ne' | 'corner_se' | 'corner_sw' | 'corner_nw' |
  'inner_ne' | 'inner_se' | 'inner_sw' | 'inner_nw' |
  'peninsula_n' | 'peninsula_e' | 'peninsula_s' | 'peninsula_w';

// Maps edge patterns to tile GIDs for dirt surrounded by grass
export const DIRT_EDGE_TILES: Record<EdgePattern, number> = {
  center: DIRT.CENTER[0],

  // Single edges (dirt exposed on one side)
  edge_n: gid(5, 4),      // North edge
  edge_e: gid(6, 5),      // East edge
  edge_s: gid(7, 4),      // South edge
  edge_w: gid(6, 3),      // West edge

  // Outer corners (dirt in corner)
  corner_ne: gid(5, 5),
  corner_se: gid(7, 5),
  corner_sw: gid(7, 3),
  corner_nw: gid(5, 3),

  // Inner corners (grass poking into dirt)
  inner_ne: gid(6, 0),
  inner_se: gid(7, 0),
  inner_sw: gid(7, 1),
  inner_nw: gid(6, 1),

  // Peninsula (dirt surrounded on 3 sides)
  peninsula_n: gid(5, 4),
  peninsula_e: gid(6, 5),
  peninsula_s: gid(7, 4),
  peninsula_w: gid(6, 3),
};
