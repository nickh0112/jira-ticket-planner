import { useRef, useEffect, useState, useCallback } from 'react';
import { Application, Graphics, Text, TextStyle, Container, Sprite } from 'pixi.js';
import type { TeamMember, Epic, CampaignRegion, WorkArea } from '@jira-planner/shared';
import type { UnitState } from '../../store/worldStore';
import { useWorldStore } from '../../store/worldStore';
import { useStore } from '../../store/useStore';
import {
  loadCharacterSprites,
  getSpriteTypeForRole,
  getSpriteTexture,
  getSpriteTypeColor,
  loadBasecampAssets,
} from '../../utils/spriteLoader';
import { loadBackground, loadAllOverlays, getDisplayScale } from '../../utils/tilemapLoader';
import { renderBasecamp } from './TilemapRenderer';
import { useCameraControls } from '../../hooks/useCameraControls';
import type { BasecampMapData } from '../../utils/tilemapLoader';

interface WorldCanvasProps {
  regions?: CampaignRegion[];
  units: Record<string, UnitState>;
  teamMembers: TeamMember[];
  epics: Epic[];
  selectedUnitId: string | null;
  onSelectUnit: (id: string | null) => void;
  basecampMapData: BasecampMapData | null;
  workAreas: WorkArea[];
}

// Colors for the RTS theme
const COLORS = {
  background: 0x2b2821,
  unitIdle: 0x4a90d9,
  unitWorking: 0x4ad94a,
  unitWalking: 0xd9d94a,
  unitSelected: 0xffd700,
  unitLevelUp: 0xff6b6b,
  text: 0xf5f0e6,
  textDark: 0x2b2821,
  gold: 0xffd700,
};

export function WorldCanvas({
  units,
  teamMembers,
  epics,
  selectedUnitId,
  onSelectUnit,
  basecampMapData,
  workAreas,
}: WorldCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 800 });
  const [spritesLoaded, setSpritesLoaded] = useState(false);
  const [basecampLoaded, setBasecampLoaded] = useState(false);
  const [backgroundLoaded, setBackgroundLoaded] = useState(false);
  const [animationFrame, setAnimationFrame] = useState(0);

  const {
    moveUnit,
    updateUnitPosition,
    xpFloats,
    memberCampaignAssignments,
    updateCampaignAssignments,
    camera,
    updateCamera,
    config,
    startIdleWandering,
    stopIdleWandering,
  } = useWorldStore();
  const { tickets } = useStore();

  // World dimensions from map data or config (accounting for display scale)
  const displayScale = getDisplayScale();
  const worldWidth = basecampMapData
    ? basecampMapData.width * basecampMapData.tileWidth * displayScale
    : config?.width || 1920;
  const worldHeight = basecampMapData
    ? basecampMapData.height * basecampMapData.tileHeight * displayScale
    : config?.height || 1280;

  // Camera controls
  useCameraControls({
    containerRef: containerRef as React.RefObject<HTMLDivElement>,
    worldWidth,
    worldHeight,
    viewportWidth: canvasSize.width,
    viewportHeight: canvasSize.height,
    camera,
    onCameraChange: updateCamera,
    enabled: isReady,
  });

  // Update campaign assignments when tickets change
  useEffect(() => {
    updateCampaignAssignments(tickets, teamMembers);
  }, [tickets, teamMembers, updateCampaignAssignments]);

  // Load sprites and tilesets
  useEffect(() => {
    loadCharacterSprites().then((loaded) => {
      setSpritesLoaded(loaded);
    });
    loadBasecampAssets().then((loaded) => {
      setBasecampLoaded(loaded);
    });
  }, []);

  // Load background and overlays after map data is available
  useEffect(() => {
    if (basecampMapData) {
      Promise.all([loadBackground(), loadAllOverlays()]).then(([bgLoaded]) => {
        setBackgroundLoaded(bgLoaded);
      });
    }
  }, [basecampMapData]);

  // Animation frame ticker for walking units and campfire
  useEffect(() => {
    if (!isReady) return;

    const interval = setInterval(() => {
      setAnimationFrame((prev) => (prev + 1) % 4);
    }, 200); // 5 FPS animation

    return () => clearInterval(interval);
  }, [isReady]);

  // Start idle wandering when canvas is ready
  useEffect(() => {
    if (!isReady) return;

    startIdleWandering();

    return () => {
      stopIdleWandering();
    };
  }, [isReady, startIdleWandering, stopIdleWandering]);

  // Handle container resize
  const handleResize = useCallback(() => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const newWidth = Math.floor(rect.width);
    const newHeight = Math.floor(rect.height);

    // Guard against zero dimensions (can happen before layout is calculated)
    if (newWidth <= 0 || newHeight <= 0) return;

    setCanvasSize({ width: newWidth, height: newHeight });

    if (appRef.current) {
      appRef.current.renderer.resize(newWidth, newHeight);
    }
  }, []);

  // Initialize PixiJS
  useEffect(() => {
    if (!containerRef.current) return;

    let isMounted = true;

    const initApp = async () => {
      const app = new Application();
      await app.init({
        width: canvasSize.width,
        height: canvasSize.height,
        backgroundColor: COLORS.background,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      // Check if component is still mounted after async init
      if (!isMounted || !containerRef.current) {
        app.destroy(true, { children: true });
        return;
      }

      containerRef.current.appendChild(app.canvas);
      appRef.current = app;

      // Wait for valid container dimensions before marking ready
      // This ensures the first render has correct viewport calculations
      const waitForLayout = () => {
        if (!isMounted) return;
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect && rect.width > 0 && rect.height > 0) {
          const newWidth = Math.floor(rect.width);
          const newHeight = Math.floor(rect.height);
          setCanvasSize({ width: newWidth, height: newHeight });
          app.renderer.resize(newWidth, newHeight);
          setIsReady(true);
        } else {
          requestAnimationFrame(waitForLayout);
        }
      };
      requestAnimationFrame(waitForLayout);
    };

    initApp();

    return () => {
      isMounted = false;
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
        setIsReady(false);
      }
    };
  }, []);

  // Set up ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    resizeObserver.observe(containerRef.current);
    handleResize(); // Initial resize

    return () => {
      resizeObserver.disconnect();
    };
  }, [handleResize]);

  // Render the world
  useEffect(() => {
    if (!appRef.current || !isReady) return;

    const app = appRef.current;
    app.stage.removeChildren();

    // Create main world container that will be offset by camera
    const worldContainer = new Container();
    worldContainer.x = -camera.x * camera.zoom;
    worldContainer.y = -camera.y * camera.zoom;
    worldContainer.scale.set(camera.zoom);
    app.stage.addChild(worldContainer);

    // Create containers for layering
    const basecampContainer = new Container();
    const unitsContainer = new Container();
    const uiContainer = new Container();

    worldContainer.addChild(basecampContainer);
    worldContainer.addChild(unitsContainer);
    worldContainer.addChild(uiContainer);

    // Render basecamp tilemap if data is available
    if (basecampMapData) {
      const tilemapContainer = renderBasecamp(
        {
          mapData: basecampMapData,
          animationFrame,
          cameraX: camera.x,
          cameraY: camera.y,
          viewportWidth: canvasSize.width / camera.zoom,
          viewportHeight: canvasSize.height / camera.zoom,
        },
        basecampLoaded
      );
      basecampContainer.addChild(tilemapContainer);
    } else {
      // Fallback: simple background when map data isn't available
      const bg = new Graphics();
      bg.rect(0, 0, worldWidth, worldHeight);
      bg.fill(0x4a6741); // Green grass color fallback
      basecampContainer.addChild(bg);
    }

    // Draw units
    Object.values(units).forEach((unit) => {
      const member = teamMembers.find((m) => m.id === unit.memberId);
      if (!member) return;

      // Check if unit is visible in viewport
      const screenX = (unit.x - camera.x) * camera.zoom;
      const screenY = (unit.y - camera.y) * camera.zoom;
      if (
        screenX < -100 ||
        screenX > canvasSize.width + 100 ||
        screenY < -100 ||
        screenY > canvasSize.height + 100
      ) {
        return; // Skip units outside viewport
      }

      const isSelected = unit.memberId === selectedUnitId;
      const spriteType = getSpriteTypeForRole(member.role);

      // Unit container
      const unitContainer = new Container();
      unitContainer.x = unit.x;
      unitContainer.y = unit.y;
      unitContainer.interactive = true;
      unitContainer.cursor = 'pointer';

      // Click handler
      unitContainer.on('click', (e) => {
        e.stopPropagation();
        onSelectUnit(isSelected ? null : unit.memberId);
      });

      // Determine animation frame based on unit state
      let frameType: 'idle' | 'walk1' | 'walk2' = 'idle';
      if (unit.activityState === 'walking' && unit.targetX !== null && unit.targetY !== null) {
        const walkFrames: ('idle' | 'walk1' | 'idle' | 'walk2')[] = ['idle', 'walk1', 'idle', 'walk2'];
        frameType = walkFrames[animationFrame % 4] as 'idle' | 'walk1' | 'walk2';
      }

      // Try to use sprite, fallback to circle
      const spriteTexture = spritesLoaded ? getSpriteTexture(spriteType, frameType) : null;

      if (spriteTexture) {
        const sprite = new Sprite(spriteTexture);
        sprite.anchor.set(0.5);
        sprite.scale.set(1.5);
        unitContainer.addChild(sprite);

        if (isSelected) {
          const selectionRing = new Graphics();
          selectionRing.circle(0, 0, 28);
          selectionRing.stroke({ width: 3, color: COLORS.unitSelected });
          unitContainer.addChild(selectionRing);
        }
      } else {
        // Fallback: colored circle
        const unitBody = new Graphics();
        const bodyColor = getUnitColor(unit.activityState);
        unitBody.circle(0, 0, 16);
        unitBody.fill(bodyColor);

        if (isSelected) {
          unitBody.circle(0, 0, 20);
          unitBody.stroke({ width: 3, color: COLORS.unitSelected });
        }

        unitContainer.addChild(unitBody);

        const roleIndicator = new Graphics();
        const roleColor = getSpriteTypeColor(spriteType);
        roleIndicator.circle(0, 0, 8);
        roleIndicator.fill(roleColor);
        unitContainer.addChild(roleIndicator);
      }

      // Name label
      const nameLabel = new Text({
        text: member.name.split(' ')[0],
        style: new TextStyle({
          fontFamily: 'VT323, monospace',
          fontSize: 14,
          fill: COLORS.text,
          fontWeight: 'bold',
          dropShadow: {
            color: 0x000000,
            blur: 2,
            distance: 1,
          },
        }),
      });
      nameLabel.anchor.set(0.5, 0);
      nameLabel.y = spritesLoaded ? 28 : 22;
      unitContainer.addChild(nameLabel);

      // Activity indicator
      if (unit.activityState !== 'idle') {
        const activityIcon = getActivityIcon(unit.activityState);
        const activityLabel = new Text({
          text: activityIcon,
          style: new TextStyle({
            fontSize: 16,
          }),
        });
        activityLabel.anchor.set(0.5, 0.5);
        activityLabel.y = spritesLoaded ? -32 : -25;
        unitContainer.addChild(activityLabel);
      }

      // Show epic label if unit is working
      const unitAssignments = memberCampaignAssignments[unit.memberId];
      if (unitAssignments && unitAssignments.length > 0 && unit.activityState === 'working') {
        const activeAssignment = unitAssignments.find((a) => a.hasActiveWork);
        if (activeAssignment) {
          const epic = epics.find((e) => e.id === activeAssignment.epicId);
          if (epic) {
            // Epic label background
            const labelBg = new Graphics();
            const labelWidth = Math.min(epic.name.length * 6 + 16, 120);
            labelBg.roundRect(-labelWidth / 2, -55, labelWidth, 18, 4);
            labelBg.fill({ color: 0x2b2821, alpha: 0.9 });
            labelBg.stroke({ width: 1, color: COLORS.gold, alpha: 0.5 });
            unitContainer.addChild(labelBg);

            const epicLabel = new Text({
              text: epic.name.length > 15 ? epic.name.substring(0, 15) + '...' : epic.name,
              style: new TextStyle({
                fontFamily: 'Press Start 2P, monospace',
                fontSize: 6,
                fill: COLORS.gold,
              }),
            });
            epicLabel.anchor.set(0.5, 0.5);
            epicLabel.y = -46;
            unitContainer.addChild(epicLabel);
          }
        }
      }

      // Ticket count badge
      if (unitAssignments && unitAssignments.length > 0) {
        const totalTickets = unitAssignments.reduce((sum, a) => sum + a.ticketCount, 0);
        const badge = new Graphics();
        badge.circle(20, -20, 10);
        badge.fill(COLORS.gold);
        unitContainer.addChild(badge);

        const badgeText = new Text({
          text: totalTickets.toString(),
          style: new TextStyle({
            fontFamily: 'Press Start 2P, monospace',
            fontSize: 8,
            fill: COLORS.textDark,
          }),
        });
        badgeText.anchor.set(0.5);
        badgeText.x = 20;
        badgeText.y = -20;
        unitContainer.addChild(badgeText);
      }

      unitsContainer.addChild(unitContainer);
    });

    // Draw XP floats
    xpFloats.forEach((float) => {
      const floatText = new Text({
        text: `+${float.amount} XP`,
        style: new TextStyle({
          fontFamily: 'Press Start 2P, monospace',
          fontSize: 12,
          fill: COLORS.gold,
          stroke: { color: COLORS.textDark, width: 2 },
        }),
      });
      floatText.anchor.set(0.5, 0.5);
      floatText.x = float.x;
      floatText.y = float.y - (Date.now() - float.createdAt) / 50;
      floatText.alpha = Math.max(0, 1 - (Date.now() - float.createdAt) / 2000);
      uiContainer.addChild(floatText);
    });

    // Click handler for background (to deselect and move units)
    const clickHandler = new Graphics();
    clickHandler.rect(0, 0, worldWidth, worldHeight);
    clickHandler.fill({ color: 0x000000, alpha: 0 });
    clickHandler.interactive = true;
    clickHandler.cursor = 'default';

    clickHandler.on('click', (e) => {
      const localPos = e.getLocalPosition(worldContainer);
      if (selectedUnitId) {
        moveUnit(selectedUnitId, localPos.x, localPos.y);
      } else {
        onSelectUnit(null);
      }
    });

    // Insert click handler below units
    worldContainer.addChildAt(clickHandler, 1);

    // Camera control hint (fixed position, not affected by camera)
    const hintContainer = new Container();
    app.stage.addChild(hintContainer);

    const hintBg = new Graphics();
    hintBg.roundRect(8, canvasSize.height - 30, 280, 22, 4);
    hintBg.fill({ color: 0x2b2821, alpha: 0.8 });
    hintContainer.addChild(hintBg);

    const hintText = new Text({
      text: 'WASD/Arrows: Pan | Mouse Wheel: Zoom | Middle-click: Drag',
      style: new TextStyle({
        fontFamily: 'VT323, monospace',
        fontSize: 12,
        fill: 0xf5f0e6,
      }),
    });
    hintText.x = 14;
    hintText.y = canvasSize.height - 26;
    hintText.alpha = 0.7;
    hintContainer.addChild(hintText);
  }, [
    isReady,
    basecampMapData,
    units,
    teamMembers,
    epics,
    selectedUnitId,
    onSelectUnit,
    moveUnit,
    xpFloats,
    spritesLoaded,
    basecampLoaded,
    backgroundLoaded,
    animationFrame,
    memberCampaignAssignments,
    camera,
    canvasSize,
    worldWidth,
    worldHeight,
    workAreas,
    displayScale,
  ]);

  // Animation loop for unit movement
  useEffect(() => {
    if (!isReady) return;

    const animate = () => {
      Object.values(units).forEach((unit) => {
        if (unit.targetX !== null && unit.targetY !== null) {
          const dx = unit.targetX - unit.x;
          const dy = unit.targetY - unit.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > 5) {
            const speed = 3;
            const newX = unit.x + (dx / dist) * speed;
            const newY = unit.y + (dy / dist) * speed;
            updateUnitPosition(unit.memberId, newX, newY);
          } else {
            updateUnitPosition(unit.memberId, unit.targetX, unit.targetY);
          }
        }
      });
    };

    const interval = setInterval(animate, 16);
    return () => clearInterval(interval);
  }, [isReady, units, updateUnitPosition]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ cursor: camera.isDragging ? 'grabbing' : 'default' }}
    />
  );
}

function getUnitColor(state: UnitState['activityState']): number {
  switch (state) {
    case 'idle':
      return COLORS.unitIdle;
    case 'working':
      return COLORS.unitWorking;
    case 'walking':
      return COLORS.unitWalking;
    case 'completing':
      return COLORS.unitSelected;
    case 'leveling_up':
      return COLORS.unitLevelUp;
    default:
      return COLORS.unitIdle;
  }
}

function getActivityIcon(state: UnitState['activityState']): string {
  switch (state) {
    case 'walking':
      return '';
    case 'working':
      return '';
    case 'completing':
      return '';
    case 'leveling_up':
      return '';
    default:
      return '';
  }
}
