import { Graphics, Container, Text, TextStyle, Sprite } from 'pixi.js';
import type { BasecampMapData, WorkArea } from '../../utils/tilemapLoader';
import { getTentTexture, getCampfireFrames } from '../../utils/spriteLoader';

// Color palette for medieval basecamp
const COLORS = {
  grass: 0x4a6741,
  grassDark: 0x3d5636,
  grassLight: 0x5a7751,
  dirt: 0x8b7355,
  dirtDark: 0x7a6248,
  path: 0xa08060,
  pathBorder: 0x6b5040,
  fence: 0x654321,
  fencePost: 0x4a3218,
  tent: 0x8b4513,
  tentDark: 0x654321,
  banner: 0xc41e3a,
  gold: 0xffd700,
  shadow: 0x1a1612,
};

// Work area colors
const AREA_COLORS: Record<string, number> = {
  'backend-tent': 0x3498db,
  'frontend-tent': 0x9b59b6,
  'fullstack-area': 0x1abc9c,
  'ai-workshop': 0x7f8c8d,
  'qa-grounds': 0x27ae60,
  'supply-area': 0xe67e22,
  'campfire': 0xff6b00,
};

export interface TilemapRendererOptions {
  mapData: BasecampMapData;
  animationFrame: number;
  cameraX: number;
  cameraY: number;
  viewportWidth: number;
  viewportHeight: number;
}

/**
 * Render the ground layer with grass tiles and variation
 */
export function renderGroundLayer(
  container: Container,
  mapData: BasecampMapData,
  cameraX: number,
  cameraY: number,
  viewportWidth: number,
  viewportHeight: number
): void {
  const tileW = mapData.tileWidth;
  const tileH = mapData.tileHeight;
  const worldWidth = mapData.width * tileW;
  const worldHeight = mapData.height * tileH;

  // Calculate visible tile range with buffer
  const startCol = Math.max(0, Math.floor(cameraX / tileW) - 1);
  const endCol = Math.min(mapData.width, Math.ceil((cameraX + viewportWidth) / tileW) + 1);
  const startRow = Math.max(0, Math.floor(cameraY / tileH) - 1);
  const endRow = Math.min(mapData.height, Math.ceil((cameraY + viewportHeight) / tileH) + 1);

  const ground = new Graphics();

  // Draw base grass
  ground.rect(0, 0, worldWidth, worldHeight);
  ground.fill(COLORS.grass);

  // Add grass variation pattern
  for (let row = startRow; row < endRow; row++) {
    for (let col = startCol; col < endCol; col++) {
      const x = col * tileW;
      const y = row * tileH;

      // Pseudo-random variation based on position
      const hash = (col * 13 + row * 7) % 10;

      if (hash < 2) {
        // Dark grass patch
        ground.rect(x + 4, y + 4, tileW - 8, tileH - 8);
        ground.fill({ color: COLORS.grassDark, alpha: 0.3 });
      } else if (hash < 4) {
        // Light grass patch
        ground.rect(x + 2, y + 2, tileW - 4, tileH - 4);
        ground.fill({ color: COLORS.grassLight, alpha: 0.2 });
      }

      // Occasional grass tufts
      if (hash === 5) {
        ground.moveTo(x + 8, y + tileH - 4);
        ground.lineTo(x + 10, y + tileH - 12);
        ground.lineTo(x + 12, y + tileH - 4);
        ground.fill({ color: COLORS.grassDark, alpha: 0.4 });
      }
    }
  }

  container.addChild(ground);
}

/**
 * Render dirt paths connecting work areas
 */
export function renderPaths(
  container: Container,
  mapData: BasecampMapData
): void {
  const paths = new Graphics();
  const pathWidth = 48;

  for (const path of mapData.paths) {
    // Draw path with border effect
    paths.moveTo(path.from.x, path.from.y);
    paths.lineTo(path.to.x, path.to.y);
    paths.stroke({ width: pathWidth + 4, color: COLORS.pathBorder, alpha: 0.6 });

    paths.moveTo(path.from.x, path.from.y);
    paths.lineTo(path.to.x, path.to.y);
    paths.stroke({ width: pathWidth, color: COLORS.path, alpha: 0.8 });

    // Add some dirt texture on path
    const dx = path.to.x - path.from.x;
    const dy = path.to.y - path.from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.floor(dist / 40);

    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const px = path.from.x + dx * t;
      const py = path.from.y + dy * t;
      const offset = ((i * 7) % 10) - 5;

      paths.circle(px + offset, py + offset, 4 + (i % 3));
      paths.fill({ color: COLORS.dirtDark, alpha: 0.3 });
    }
  }

  container.addChild(paths);
}

/**
 * Render the fence around the basecamp
 */
export function renderFence(
  container: Container,
  mapData: BasecampMapData
): void {
  const fence = new Graphics();
  const { topLeft, bottomRight } = mapData.fence;
  const { position: entrance, width: entranceWidth } = mapData.entrance;

  const postSpacing = 48;
  const postWidth = 8;
  const postHeight = 24;
  const railHeight = 4;

  // Top fence
  drawFenceSegment(fence, topLeft.x, topLeft.y, bottomRight.x, topLeft.y, postSpacing, postWidth, postHeight, railHeight);

  // Bottom fence (with entrance gap)
  const entranceLeft = entrance.x - entranceWidth / 2;
  const entranceRight = entrance.x + entranceWidth / 2;
  drawFenceSegment(fence, topLeft.x, bottomRight.y, entranceLeft, bottomRight.y, postSpacing, postWidth, postHeight, railHeight);
  drawFenceSegment(fence, entranceRight, bottomRight.y, bottomRight.x, bottomRight.y, postSpacing, postWidth, postHeight, railHeight);

  // Left fence
  drawFenceSegment(fence, topLeft.x, topLeft.y, topLeft.x, bottomRight.y, postSpacing, postWidth, postHeight, railHeight, true);

  // Right fence
  drawFenceSegment(fence, bottomRight.x, topLeft.y, bottomRight.x, bottomRight.y, postSpacing, postWidth, postHeight, railHeight, true);

  // Entrance posts (larger)
  fence.rect(entranceLeft - 8, bottomRight.y - 32, 16, 40);
  fence.fill(COLORS.fencePost);
  fence.rect(entranceRight - 8, bottomRight.y - 32, 16, 40);
  fence.fill(COLORS.fencePost);

  container.addChild(fence);
}

function drawFenceSegment(
  graphics: Graphics,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  spacing: number,
  postWidth: number,
  postHeight: number,
  railHeight: number,
  vertical: boolean = false
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const posts = Math.floor(dist / spacing);

  for (let i = 0; i <= posts; i++) {
    const t = posts > 0 ? i / posts : 0;
    const px = x1 + dx * t;
    const py = y1 + dy * t;

    // Post shadow
    graphics.rect(px - postWidth / 2 + 2, py - postHeight + 2, postWidth, postHeight);
    graphics.fill({ color: COLORS.shadow, alpha: 0.3 });

    // Post
    graphics.rect(px - postWidth / 2, py - postHeight, postWidth, postHeight);
    graphics.fill(COLORS.fencePost);
  }

  // Rails
  if (dist > spacing) {
    if (vertical) {
      graphics.rect(x1 - postWidth / 2 - 2, y1 + spacing / 2, postWidth + 4, dist - spacing);
      graphics.fill(COLORS.fence);
    } else {
      graphics.rect(x1 + spacing / 2, y1 - postHeight / 2, dist - spacing, railHeight);
      graphics.fill(COLORS.fence);
      graphics.rect(x1 + spacing / 2, y1 - postHeight + 4, dist - spacing, railHeight);
      graphics.fill(COLORS.fence);
    }
  }
}

/**
 * Render work area markers and structures
 */
export function renderWorkAreas(
  container: Container,
  mapData: BasecampMapData,
  animationFrame: number,
  basecampAssetsLoaded: boolean
): void {
  const areas = new Container();

  for (const area of mapData.workAreas) {
    const areaContainer = new Container();
    areaContainer.x = area.position.x;
    areaContainer.y = area.position.y;

    // Ground patch for work area
    const groundPatch = new Graphics();
    groundPatch.circle(0, 0, area.radius);
    groundPatch.fill({ color: COLORS.dirt, alpha: 0.4 });
    areaContainer.addChild(groundPatch);

    // Render based on area type
    if (area.id === 'campfire') {
      renderCampfire(areaContainer, animationFrame, basecampAssetsLoaded);
    } else if (area.id === 'supply-area') {
      renderSupplyArea(areaContainer);
    } else {
      renderTent(areaContainer, area, basecampAssetsLoaded);
    }

    // Area label
    const label = new Text({
      text: area.name,
      style: new TextStyle({
        fontFamily: 'Press Start 2P, monospace',
        fontSize: 10,
        fill: COLORS.gold,
        dropShadow: {
          color: 0x000000,
          blur: 4,
          distance: 2,
        },
      }),
    });
    label.anchor.set(0.5, 0);
    label.y = area.radius - 20;
    areaContainer.addChild(label);

    areas.addChild(areaContainer);
  }

  container.addChild(areas);
}

function renderCampfire(
  container: Container,
  animationFrame: number,
  basecampAssetsLoaded: boolean
): void {
  // Fire pit base
  const pit = new Graphics();
  pit.circle(0, 0, 32);
  pit.fill(0x3a3a3a);
  pit.stroke({ width: 4, color: 0x5a5a5a });
  container.addChild(pit);

  // Logs
  const logs = new Graphics();
  logs.rect(-24, -6, 48, 12);
  logs.fill(0x654321);
  logs.rect(-6, -24, 12, 48);
  logs.fill(0x8b4513);
  container.addChild(logs);

  // Campfire sprite or fallback
  const campfireFrames = getCampfireFrames();
  if (basecampAssetsLoaded && campfireFrames.length > 0) {
    const campfire = new Sprite(campfireFrames[animationFrame % campfireFrames.length]);
    campfire.anchor.set(0.5);
    campfire.scale.set(2);
    container.addChild(campfire);
  } else {
    // Fallback animated flames
    const flames = new Graphics();
    const flameOffset = (animationFrame % 2) * 4;

    // Outer flame
    flames.moveTo(-20, 0);
    flames.quadraticCurveTo(-10, -30 - flameOffset, 0, -45 - flameOffset);
    flames.quadraticCurveTo(10, -30 - flameOffset, 20, 0);
    flames.closePath();
    flames.fill(0xff4500);

    // Inner flame
    flames.moveTo(-10, 0);
    flames.quadraticCurveTo(-5, -20 - flameOffset, 0, -30 - flameOffset);
    flames.quadraticCurveTo(5, -20 - flameOffset, 10, 0);
    flames.closePath();
    flames.fill(0xffd700);

    container.addChild(flames);
  }

  // Fire glow
  const glow = new Graphics();
  glow.circle(0, 0, 48);
  glow.fill({ color: 0xff6b00, alpha: 0.15 + (animationFrame % 2) * 0.05 });
  container.addChildAt(glow, 0);

  // Sitting logs around fire
  const sittingLogs = new Graphics();
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const x = Math.cos(angle) * 60;
    const y = Math.sin(angle) * 60;
    sittingLogs.ellipse(x, y, 20, 10);
    sittingLogs.fill(0x654321);
  }
  container.addChild(sittingLogs);
}

function renderTent(
  container: Container,
  area: WorkArea,
  basecampAssetsLoaded: boolean
): void {
  const tentTexture = getTentTexture();

  if (basecampAssetsLoaded && tentTexture) {
    const tent = new Sprite(tentTexture);
    tent.anchor.set(0.5);
    tent.scale.set(0.8);
    tent.y = -20;
    container.addChild(tent);
  } else {
    // Fallback tent
    const tent = new Graphics();

    // Shadow
    tent.ellipse(0, 20, 50, 15);
    tent.fill({ color: COLORS.shadow, alpha: 0.4 });

    // Tent body
    tent.moveTo(-50, 20);
    tent.lineTo(0, -50);
    tent.lineTo(50, 20);
    tent.closePath();
    tent.fill(COLORS.tent);
    tent.stroke({ width: 2, color: COLORS.tentDark });

    // Entrance
    tent.moveTo(-15, 20);
    tent.lineTo(0, -10);
    tent.lineTo(15, 20);
    tent.fill(0x2b1810);

    // Tent pole
    tent.moveTo(0, -50);
    tent.lineTo(0, -60);
    tent.stroke({ width: 3, color: COLORS.fencePost });

    container.addChild(tent);
  }

  // Banner/flag based on area color
  const color = AREA_COLORS[area.id] || COLORS.banner;
  const banner = new Graphics();

  // Pole
  banner.rect(45, -60, 4, 70);
  banner.fill(COLORS.fencePost);

  // Flag
  banner.moveTo(49, -60);
  banner.lineTo(80, -50);
  banner.lineTo(49, -40);
  banner.closePath();
  banner.fill(color);

  container.addChild(banner);
}

function renderSupplyArea(container: Container): void {
  // Crates and barrels
  const supplies = new Graphics();

  // Barrel 1
  supplies.ellipse(-30, 0, 20, 12);
  supplies.fill(0x8b4513);
  supplies.rect(-50, -30, 40, 30);
  supplies.fill(0x654321);
  supplies.ellipse(-30, -30, 20, 12);
  supplies.fill(0x8b4513);

  // Barrel 2
  supplies.ellipse(30, 10, 18, 10);
  supplies.fill(0x8b4513);
  supplies.rect(12, -15, 36, 25);
  supplies.fill(0x654321);
  supplies.ellipse(30, -15, 18, 10);
  supplies.fill(0x8b4513);

  // Crate
  supplies.rect(-15, -40, 30, 30);
  supplies.fill(0xa0825a);
  supplies.stroke({ width: 2, color: 0x654321 });

  // Crate cross pattern
  supplies.moveTo(-15, -25);
  supplies.lineTo(15, -25);
  supplies.stroke({ width: 2, color: 0x654321 });
  supplies.moveTo(0, -40);
  supplies.lineTo(0, -10);
  supplies.stroke({ width: 2, color: 0x654321 });

  container.addChild(supplies);
}

/**
 * Render decorative elements (rocks, bushes, flowers)
 */
export function renderDecorations(
  container: Container,
  mapData: BasecampMapData,
  _cameraX: number,
  _cameraY: number,
  _viewportWidth: number,
  _viewportHeight: number
): void {
  const decorations = new Graphics();
  const tileW = mapData.tileWidth;
  const tileH = mapData.tileHeight;

  // Scatter decorations based on pseudo-random positions
  for (let row = 0; row < mapData.height; row++) {
    for (let col = 0; col < mapData.width; col++) {
      const x = col * tileW + tileW / 2;
      const y = row * tileH + tileH / 2;

      // Check if position is on a path or in a work area
      const onPath = isOnPath(x, y, mapData);
      const inWorkArea = isInWorkArea(x, y, mapData);

      if (onPath || inWorkArea) continue;

      // Pseudo-random hash for this tile
      const hash = (col * 17 + row * 31) % 100;

      if (hash < 3) {
        // Rock
        decorations.ellipse(x, y + 4, 12 + (hash % 5), 8 + (hash % 3));
        decorations.fill(0x808080);
        decorations.ellipse(x - 2, y, 10 + (hash % 5), 6 + (hash % 3));
        decorations.fill(0x9a9a9a);
      } else if (hash < 7) {
        // Bush
        decorations.circle(x - 5, y, 8);
        decorations.fill(0x2d5a27);
        decorations.circle(x + 5, y - 3, 7);
        decorations.fill(0x3a6b32);
        decorations.circle(x, y - 6, 6);
        decorations.fill(0x4a7a42);
      } else if (hash < 10) {
        // Flowers
        const flowerColor = [0xff6b6b, 0xffeb3b, 0x4fc3f7, 0xba68c8][hash % 4];
        decorations.circle(x, y, 3);
        decorations.fill(flowerColor);
        decorations.circle(x - 4, y + 2, 2);
        decorations.fill(flowerColor);
        decorations.circle(x + 3, y + 3, 2);
        decorations.fill(flowerColor);
      }
    }
  }

  container.addChild(decorations);
}

function isOnPath(x: number, y: number, mapData: BasecampMapData): boolean {
  const pathWidth = 32;

  for (const path of mapData.paths) {
    const dx = path.to.x - path.from.x;
    const dy = path.to.y - path.from.y;
    const len = Math.sqrt(dx * dx + dy * dy);

    if (len === 0) continue;

    // Project point onto line
    const t = Math.max(0, Math.min(1, ((x - path.from.x) * dx + (y - path.from.y) * dy) / (len * len)));
    const projX = path.from.x + t * dx;
    const projY = path.from.y + t * dy;

    const dist = Math.sqrt((x - projX) ** 2 + (y - projY) ** 2);
    if (dist < pathWidth) return true;
  }

  return false;
}

function isInWorkArea(x: number, y: number, mapData: BasecampMapData): boolean {
  for (const area of mapData.workAreas) {
    const dist = Math.sqrt((x - area.position.x) ** 2 + (y - area.position.y) ** 2);
    if (dist < area.radius + 20) return true;
  }
  return false;
}

/**
 * Create and render the complete basecamp scene
 */
export function renderBasecamp(
  options: TilemapRendererOptions,
  basecampAssetsLoaded: boolean
): Container {
  const { mapData, animationFrame, cameraX, cameraY, viewportWidth, viewportHeight } = options;

  const basecampContainer = new Container();

  // Layer 1: Ground
  renderGroundLayer(basecampContainer, mapData, cameraX, cameraY, viewportWidth, viewportHeight);

  // Layer 2: Paths
  renderPaths(basecampContainer, mapData);

  // Layer 3: Decorations (lower)
  renderDecorations(basecampContainer, mapData, cameraX, cameraY, viewportWidth, viewportHeight);

  // Layer 4: Fence
  renderFence(basecampContainer, mapData);

  // Layer 5: Work areas and structures
  renderWorkAreas(basecampContainer, mapData, animationFrame, basecampAssetsLoaded);

  return basecampContainer;
}
