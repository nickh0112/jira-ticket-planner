/**
 * Path Generation System
 *
 * Creates natural-looking dirt paths with configurable width
 * using modified Bresenham's line algorithm.
 */

import { TerrainType } from './tileConstants.js';
import type { PRNG } from './prng.js';
import type { TerrainGrid } from './autotiler.js';

export type Point = { x: number; y: number };

export type PathConfig = {
  start: Point;
  end: Point;
  width: number;      // Base width of path (in tiles)
  wobble?: number;    // Amount of random variation (0-1)
};

/**
 * Bresenham's line algorithm - returns all points on line
 */
function bresenhamLine(x0: number, y0: number, x1: number, y1: number): Point[] {
  const points: Point[] = [];

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  let x = x0;
  let y = y0;

  while (true) {
    points.push({ x, y });

    if (x === x1 && y === y1) break;

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }

  return points;
}

/**
 * Expand a single point to a circle of given radius
 */
function expandPoint(center: Point, radius: number): Point[] {
  const points: Point[] = [];
  const r = Math.floor(radius);

  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      // Use circular distance check
      if (dx * dx + dy * dy <= r * r) {
        points.push({
          x: center.x + dx,
          y: center.y + dy,
        });
      }
    }
  }

  return points;
}

/**
 * Generate a single path between two points
 */
export function generatePath(
  terrain: TerrainGrid,
  config: PathConfig,
  rng: PRNG
): void {
  const { start, end, width, wobble = 0.1 } = config;

  // Get center line points
  const centerLine = bresenhamLine(
    Math.round(start.x),
    Math.round(start.y),
    Math.round(end.x),
    Math.round(end.y)
  );

  const height = terrain.length;
  const mapWidth = terrain[0].length;

  // Expand each center point to path width
  for (const point of centerLine) {
    // Add slight wobble to width
    const effectiveWidth = width * (1 + (rng.random() - 0.5) * wobble);
    const radius = effectiveWidth / 2;

    const pathPoints = expandPoint(point, radius);

    for (const p of pathPoints) {
      // Bounds check
      if (p.x >= 0 && p.x < mapWidth && p.y >= 0 && p.y < height) {
        terrain[p.y][p.x] = TerrainType.DIRT;
      }
    }
  }
}

/**
 * Generate a curved path using bezier-like interpolation
 */
export function generateCurvedPath(
  terrain: TerrainGrid,
  start: Point,
  end: Point,
  control: Point,
  width: number,
  rng: PRNG,
  segments: number = 20
): void {
  const points: Point[] = [];

  // Quadratic bezier interpolation
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const t1 = 1 - t;

    const x = t1 * t1 * start.x + 2 * t1 * t * control.x + t * t * end.x;
    const y = t1 * t1 * start.y + 2 * t1 * t * control.y + t * t * end.y;

    points.push({ x: Math.round(x), y: Math.round(y) });
  }

  // Connect consecutive points with straight paths
  for (let i = 0; i < points.length - 1; i++) {
    generatePath(terrain, {
      start: points[i],
      end: points[i + 1],
      width,
      wobble: 0.05,
    }, rng);
  }
}

/**
 * Generate a central hub (campfire area) as a circular dirt area
 */
export function generateHub(
  terrain: TerrainGrid,
  center: Point,
  radius: number
): void {
  const height = terrain.length;
  const width = terrain[0].length;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - center.x;
      const dy = y - center.y;
      if (dx * dx + dy * dy <= radius * radius) {
        terrain[y][x] = TerrainType.DIRT;
      }
    }
  }
}

/**
 * Generate all paths for basecamp layout
 */
export function generateBasecampPaths(
  terrain: TerrainGrid,
  rng: PRNG,
  mapWidth: number,
  mapHeight: number
): { center: Point; workAreas: Point[] } {
  // Central campfire position
  const center: Point = {
    x: Math.floor(mapWidth / 2),
    y: Math.floor(mapHeight / 2),
  };

  // Create central hub
  generateHub(terrain, center, 4);

  // Work area positions (corners and edges)
  const workAreas: Point[] = [
    { x: Math.floor(mapWidth * 0.2), y: Math.floor(mapHeight * 0.2) },   // NW - Smithy
    { x: Math.floor(mapWidth * 0.8), y: Math.floor(mapHeight * 0.2) },   // NE - Tavern
    { x: Math.floor(mapWidth * 0.2), y: Math.floor(mapHeight * 0.8) },   // SW - Barracks
    { x: Math.floor(mapWidth * 0.8), y: Math.floor(mapHeight * 0.8) },   // SE - Market
    { x: Math.floor(mapWidth * 0.5), y: Math.floor(mapHeight * 0.15) },  // N - Guild Hall
    { x: Math.floor(mapWidth * 0.5), y: Math.floor(mapHeight * 0.85) },  // S - Stables
  ];

  // Generate paths from center to each work area
  for (const area of workAreas) {
    // Calculate control point for slight curve
    const midX = (center.x + area.x) / 2;
    const midY = (center.y + area.y) / 2;

    // Add perpendicular offset for natural curve
    const dx = area.x - center.x;
    const dy = area.y - center.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const perpX = -dy / len * (rng.random() - 0.5) * 4;
    const perpY = dx / len * (rng.random() - 0.5) * 4;

    const control: Point = {
      x: midX + perpX,
      y: midY + perpY,
    };

    generateCurvedPath(terrain, center, area, control, 3, rng);

    // Create small hub at work area
    generateHub(terrain, area, 3);
  }

  // Add some connecting paths between adjacent work areas
  const connections: [number, number][] = [
    [0, 4], // NW to N
    [1, 4], // NE to N
    [2, 5], // SW to S
    [3, 5], // SE to S
  ];

  for (const [a, b] of connections) {
    generateCurvedPath(
      terrain,
      workAreas[a],
      workAreas[b],
      {
        x: (workAreas[a].x + workAreas[b].x) / 2 + (rng.random() - 0.5) * 3,
        y: (workAreas[a].y + workAreas[b].y) / 2 + (rng.random() - 0.5) * 3,
      },
      2,
      rng
    );
  }

  return { center, workAreas };
}
