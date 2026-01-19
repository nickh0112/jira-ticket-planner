import { Graphics, Container, Text, TextStyle, Sprite } from 'pixi.js';
import type { BasecampMapData, WorkArea } from '../../utils/tilemapLoader';
import { getDisplayScale, getBackgroundTexture, getOverlayFrame } from '../../utils/tilemapLoader';
import { getTentTexture, getCampfireFrames } from '../../utils/spriteLoader';

// Color palette for work area UI elements
const COLORS = {
  dirt: 0x8b7355,
  fencePost: 0x4a3218,
  tent: 0x8b4513,
  tentDark: 0x654321,
  banner: 0xc41e3a,
  gold: 0xffd700,
  shadow: 0x1a1612,
};

// Work area colors for banners
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
 * Render the static background image
 */
function renderBackground(container: Container, mapData: BasecampMapData): void {
  const bgTexture = getBackgroundTexture();

  if (bgTexture) {
    const background = new Sprite(bgTexture);
    // Scale background to fit the world dimensions
    const worldWidth = mapData.width * mapData.tileWidth;
    const worldHeight = mapData.height * mapData.tileHeight;
    background.width = worldWidth;
    background.height = worldHeight;
    container.addChild(background);
  } else {
    // Fallback: solid green background
    const scale = getDisplayScale();
    const worldWidth = mapData.width * mapData.tileWidth * scale;
    const worldHeight = mapData.height * mapData.tileHeight * scale;

    const fallback = new Graphics();
    fallback.rect(0, 0, worldWidth, worldHeight);
    fallback.fill(0x4a6741); // Grass green
    container.addChild(fallback);
  }
}

/**
 * Render animated overlays from the map config
 */
function renderAnimatedOverlays(
  container: Container,
  mapData: BasecampMapData,
  animationFrame: number
): void {
  const overlays = mapData.animatedOverlays || [];

  for (const overlay of overlays) {
    const texture = getOverlayFrame(overlay.id, animationFrame);

    if (texture) {
      const sprite = new Sprite(texture);
      sprite.x = overlay.position.x;
      sprite.y = overlay.position.y;
      sprite.anchor.set(overlay.anchor?.x ?? 0.5, overlay.anchor?.y ?? 0.5);
      sprite.scale.set(overlay.scale || 1);
      container.addChild(sprite);
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

    // Ground patch for work area (subtle indicator)
    const groundPatch = new Graphics();
    groundPatch.circle(0, 0, area.radius);
    groundPatch.fill({ color: COLORS.dirt, alpha: 0.2 });
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

    flames.moveTo(-20, 0);
    flames.quadraticCurveTo(-10, -30 - flameOffset, 0, -45 - flameOffset);
    flames.quadraticCurveTo(10, -30 - flameOffset, 20, 0);
    flames.closePath();
    flames.fill(0xff4500);

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
 * Create and render the complete basecamp scene
 * Simplified: Static background + animated overlays + work area structures
 */
export function renderBasecamp(
  options: TilemapRendererOptions,
  basecampAssetsLoaded: boolean
): Container {
  const { mapData, animationFrame } = options;

  const basecampContainer = new Container();

  // Layer 1: Static background image
  renderBackground(basecampContainer, mapData);

  // Layer 2: Animated overlays (campfire flames, water, etc.)
  // renderAnimatedOverlays(basecampContainer, mapData, animationFrame);

  // Layer 3: Work area structures (tents, supplies, labels)
  // Temporarily disabled - just showing background
  // renderWorkAreas(basecampContainer, mapData, animationFrame, basecampAssetsLoaded);

  return basecampContainer;
}
