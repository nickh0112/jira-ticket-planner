#!/usr/bin/env npx ts-node
/**
 * Basecamp Map Generator
 *
 * Generates a professional-quality tilemap with:
 * - 8-bit blob autotiling for terrain transitions
 * - Natural path generation with proper dirt tiles
 * - Poisson disk sampled vegetation clustering
 * - Intentional decoration placement
 *
 * Usage: npm run generate:map
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { createPRNG, hashString } from './lib/prng.js';
import { TerrainType } from './lib/tileConstants.js';
import { autotileTerrain, type TerrainGrid } from './lib/autotiler.js';
import { generateBasecampPaths } from './lib/pathGenerator.js';
import { createTreeClusters, addBorderTrees } from './lib/vegetationPlacer.js';
import { placeDecorations, createFlowerPatches } from './lib/decorationPlacer.js';

// Map configuration
const MAP_CONFIG = {
  width: 60,
  height: 40,
  tileSize: 16,
  seed: 'basecamp-v1', // Change this to regenerate with different layout
};

// Tileset configuration
const TILESET_CONFIG = {
  name: 'roguelike',
  image: '/assets/tilesets/roguelike.png',
  imagewidth: 968,
  imageheight: 526,
  tilewidth: 16,
  tileheight: 16,
  spacing: 1,
  margin: 0,
  columns: 57,
  tilecount: 1767,
  firstgid: 1,
};

/**
 * Initialize terrain grid with grass
 */
function createTerrainGrid(width: number, height: number): TerrainGrid {
  const grid: TerrainGrid = [];
  for (let y = 0; y < height; y++) {
    grid[y] = new Array(width).fill(TerrainType.GRASS);
  }
  return grid;
}

/**
 * Flatten 2D tile array to 1D for Tiled format
 */
function flattenTiles(tiles: number[][]): number[] {
  const flat: number[] = [];
  for (const row of tiles) {
    flat.push(...row);
  }
  return flat;
}

/**
 * Generate the complete basecamp map
 */
function generateBasecamp(): void {
  console.log('🗺️  Generating basecamp map...');
  console.log(`   Size: ${MAP_CONFIG.width}x${MAP_CONFIG.height}`);
  console.log(`   Seed: "${MAP_CONFIG.seed}"`);

  // Create seeded PRNG
  const rng = createPRNG(hashString(MAP_CONFIG.seed));

  // Step 1: Initialize terrain grid
  console.log('   [1/6] Initializing terrain...');
  const terrain = createTerrainGrid(MAP_CONFIG.width, MAP_CONFIG.height);

  // Step 2: Generate paths
  console.log('   [2/6] Generating paths...');
  const { center, workAreas } = generateBasecampPaths(
    terrain,
    rng,
    MAP_CONFIG.width,
    MAP_CONFIG.height
  );

  // Step 3: Apply autotiling to terrain
  console.log('   [3/6] Applying autotiling...');
  const groundTiles = autotileTerrain(terrain, rng);

  // Step 4: Place vegetation clusters
  console.log('   [4/6] Placing vegetation...');
  const vegetation = createTreeClusters(terrain, {
    mapWidth: MAP_CONFIG.width,
    mapHeight: MAP_CONFIG.height,
    excludeAreas: workAreas,
    excludeRadius: 6,
    center,
    centerClearRadius: 8,
  }, rng);

  // Add border trees
  addBorderTrees(terrain, vegetation, rng, 2);

  // Step 5: Place decorations
  console.log('   [5/6] Placing decorations...');
  const decorations = placeDecorations(terrain, vegetation, {
    workAreas,
    center,
    pathEdgeChance: 0.15,
    sparseGrassChance: 0.02,
    workAreaRingRadius: 8,
  }, rng);

  // Add flower patches
  createFlowerPatches(terrain, decorations, rng, 6);

  // Step 6: Build Tiled JSON
  console.log('   [6/6] Building map file...');

  // Calculate world dimensions (tile coords to pixel coords with scale)
  const scale = 2; // Display scale (16px tiles rendered at 32px)
  const tilePixels = MAP_CONFIG.tileSize * scale;
  const worldWidth = MAP_CONFIG.width * tilePixels;
  const worldHeight = MAP_CONFIG.height * tilePixels;

  // Convert tile positions to world pixel positions
  const toWorldPos = (tileX: number, tileY: number) => ({
    x: tileX * tilePixels,
    y: tileY * tilePixels,
  });

  // Define work areas based on generated path endpoints
  const centerWorld = toWorldPos(center.x, center.y);
  const workAreasWorld = workAreas.map((area, i) => {
    const pos = toWorldPos(area.x, area.y);
    const areaConfigs = [
      { id: 'backend-tent', name: 'Backend Tent', roleTypes: ['backend', 'api', 'devops'] },
      { id: 'frontend-tent', name: 'Frontend Tent', roleTypes: ['frontend', 'ui'] },
      { id: 'fullstack-area', name: 'Fullstack Area', roleTypes: ['fullstack', 'full stack'] },
      { id: 'ai-workshop', name: 'AI Workshop', roleTypes: ['ai', 'ml', 'machine learning'] },
      { id: 'qa-grounds', name: 'QA Grounds', roleTypes: ['qa', 'test', 'quality', 'design'] },
      { id: 'supply-area', name: 'Supply Area', roleTypes: [] },
    ];
    const config = areaConfigs[i % areaConfigs.length];
    return {
      id: config.id,
      name: config.name,
      roleTypes: config.roleTypes,
      position: pos,
      radius: 96,
    };
  });

  // Add campfire at center
  workAreasWorld.push({
    id: 'campfire',
    name: 'Central Campfire',
    roleTypes: [],
    position: centerWorld,
    radius: 128,
  });

  // Generate paths from center to work areas (for fallback rendering)
  const pathsWorld = workAreas.map(area => ({
    from: centerWorld,
    to: toWorldPos(area.x, area.y),
  }));

  const mapData = {
    version: '1.10',
    type: 'map',
    orientation: 'orthogonal',
    renderorder: 'right-down',
    width: MAP_CONFIG.width,
    height: MAP_CONFIG.height,
    tilewidth: MAP_CONFIG.tileSize,
    tileheight: MAP_CONFIG.tileSize,
    tilesets: [TILESET_CONFIG],
    layers: [
      {
        name: 'ground',
        type: 'tilelayer',
        width: MAP_CONFIG.width,
        height: MAP_CONFIG.height,
        data: flattenTiles(groundTiles),
        opacity: 1,
        visible: true,
        x: 0,
        y: 0,
      },
      {
        name: 'vegetation',
        type: 'tilelayer',
        width: MAP_CONFIG.width,
        height: MAP_CONFIG.height,
        data: flattenTiles(vegetation),
        opacity: 1,
        visible: true,
        x: 0,
        y: 0,
      },
      {
        name: 'decorations',
        type: 'tilelayer',
        width: MAP_CONFIG.width,
        height: MAP_CONFIG.height,
        data: flattenTiles(decorations),
        opacity: 1,
        visible: true,
        x: 0,
        y: 0,
      },
    ],
    properties: {
      scale: scale,
      generator: 'generateBasecamp.ts',
      seed: MAP_CONFIG.seed,
      generatedAt: new Date().toISOString(),
    },
    // App-specific properties required by TilemapRenderer
    workAreas: workAreasWorld,
    fence: {
      topLeft: { x: tilePixels * 2, y: tilePixels * 2 },
      bottomRight: { x: worldWidth - tilePixels * 2, y: worldHeight - tilePixels * 2 },
    },
    entrance: {
      position: { x: worldWidth / 2, y: worldHeight - tilePixels * 2 },
      width: tilePixels * 6,
    },
    paths: pathsWorld,
  };

  // Write output file
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const outputPath = path.join(__dirname, '../public/assets/maps/basecamp.json');

  fs.writeFileSync(outputPath, JSON.stringify(mapData, null, 2));

  console.log(`\n✅ Map generated successfully!`);
  console.log(`   Output: ${outputPath}`);
  console.log(`   Ground tiles: ${groundTiles.flat().length}`);
  console.log(`   Vegetation tiles: ${vegetation.flat().filter(t => t > 0).length}`);
  console.log(`   Decoration tiles: ${decorations.flat().filter(t => t > 0).length}`);

  // Print summary stats
  let dirtCount = 0;
  let grassCount = 0;
  for (const row of terrain) {
    for (const cell of row) {
      if (cell === TerrainType.DIRT) dirtCount++;
      else if (cell === TerrainType.GRASS) grassCount++;
    }
  }
  console.log(`\n   Terrain breakdown:`);
  console.log(`   - Grass: ${grassCount} tiles (${((grassCount / (MAP_CONFIG.width * MAP_CONFIG.height)) * 100).toFixed(1)}%)`);
  console.log(`   - Dirt/Path: ${dirtCount} tiles (${((dirtCount / (MAP_CONFIG.width * MAP_CONFIG.height)) * 100).toFixed(1)}%)`);
}

// Run generator
generateBasecamp();
