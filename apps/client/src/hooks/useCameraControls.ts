import { useEffect, useRef, useCallback } from 'react';

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
  isDragging: boolean;
}

export interface UseCameraControlsOptions {
  containerRef: React.RefObject<HTMLDivElement>;
  worldWidth: number;
  worldHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  camera: CameraState;
  onCameraChange: (camera: Partial<CameraState>) => void;
  enabled?: boolean;
}

const PAN_SPEED = 8;
const EDGE_SCROLL_THRESHOLD = 50;
const EDGE_SCROLL_SPEED = 6;

export function useCameraControls({
  containerRef,
  worldWidth,
  worldHeight,
  viewportWidth,
  viewportHeight,
  camera,
  onCameraChange,
  enabled = true,
}: UseCameraControlsOptions): void {
  const keysPressed = useRef<Set<string>>(new Set());
  const lastMousePos = useRef<{ x: number; y: number } | null>(null);
  const isMiddleMouseDown = useRef(false);

  // Clamp camera position to world bounds
  const clampCamera = useCallback(
    (x: number, y: number): { x: number; y: number } => {
      const maxX = Math.max(0, worldWidth - viewportWidth / camera.zoom);
      const maxY = Math.max(0, worldHeight - viewportHeight / camera.zoom);
      return {
        x: Math.max(0, Math.min(maxX, x)),
        y: Math.max(0, Math.min(maxY, y)),
      };
    },
    [worldWidth, worldHeight, viewportWidth, viewportHeight, camera.zoom]
  );

  // Handle WASD key panning
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        keysPressed.current.add(key);
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysPressed.current.delete(key);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [enabled]);

  // Animation loop for keyboard panning
  useEffect(() => {
    if (!enabled) return;

    let animationFrameId: number;

    const updateCamera = () => {
      let dx = 0;
      let dy = 0;

      if (keysPressed.current.has('w') || keysPressed.current.has('arrowup')) dy -= PAN_SPEED;
      if (keysPressed.current.has('s') || keysPressed.current.has('arrowdown')) dy += PAN_SPEED;
      if (keysPressed.current.has('a') || keysPressed.current.has('arrowleft')) dx -= PAN_SPEED;
      if (keysPressed.current.has('d') || keysPressed.current.has('arrowright')) dx += PAN_SPEED;

      if (dx !== 0 || dy !== 0) {
        const clamped = clampCamera(camera.x + dx, camera.y + dy);
        onCameraChange({ x: clamped.x, y: clamped.y });
      }

      animationFrameId = requestAnimationFrame(updateCamera);
    };

    animationFrameId = requestAnimationFrame(updateCamera);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [enabled, camera.x, camera.y, clampCamera, onCameraChange]);

  // Handle middle-mouse drag panning
  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 1) {
        // Middle mouse button
        e.preventDefault();
        isMiddleMouseDown.current = true;
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        onCameraChange({ isDragging: true });
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isMiddleMouseDown.current && lastMousePos.current) {
        const dx = lastMousePos.current.x - e.clientX;
        const dy = lastMousePos.current.y - e.clientY;
        lastMousePos.current = { x: e.clientX, y: e.clientY };

        const clamped = clampCamera(camera.x + dx / camera.zoom, camera.y + dy / camera.zoom);
        onCameraChange({ x: clamped.x, y: clamped.y });
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 1) {
        isMiddleMouseDown.current = false;
        lastMousePos.current = null;
        onCameraChange({ isDragging: false });
      }
    };

    // Prevent context menu on middle-click
    const handleContextMenu = (e: MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault();
      }
    };

    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('contextmenu', handleContextMenu);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [enabled, containerRef, camera.x, camera.y, camera.zoom, clampCamera, onCameraChange]);

  // Handle edge scrolling
  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;
    let edgeScrollInterval: number | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Check if mouse is within container bounds
      if (mouseX < 0 || mouseX > rect.width || mouseY < 0 || mouseY > rect.height) {
        if (edgeScrollInterval) {
          clearInterval(edgeScrollInterval);
          edgeScrollInterval = null;
        }
        return;
      }

      let dx = 0;
      let dy = 0;

      // Left edge
      if (mouseX < EDGE_SCROLL_THRESHOLD) {
        dx = -EDGE_SCROLL_SPEED * (1 - mouseX / EDGE_SCROLL_THRESHOLD);
      }
      // Right edge
      else if (mouseX > rect.width - EDGE_SCROLL_THRESHOLD) {
        dx = EDGE_SCROLL_SPEED * (1 - (rect.width - mouseX) / EDGE_SCROLL_THRESHOLD);
      }

      // Top edge
      if (mouseY < EDGE_SCROLL_THRESHOLD) {
        dy = -EDGE_SCROLL_SPEED * (1 - mouseY / EDGE_SCROLL_THRESHOLD);
      }
      // Bottom edge
      else if (mouseY > rect.height - EDGE_SCROLL_THRESHOLD) {
        dy = EDGE_SCROLL_SPEED * (1 - (rect.height - mouseY) / EDGE_SCROLL_THRESHOLD);
      }

      if (dx !== 0 || dy !== 0) {
        if (!edgeScrollInterval) {
          edgeScrollInterval = window.setInterval(() => {
            const clamped = clampCamera(camera.x + dx, camera.y + dy);
            onCameraChange({ x: clamped.x, y: clamped.y });
          }, 16);
        }
      } else if (edgeScrollInterval) {
        clearInterval(edgeScrollInterval);
        edgeScrollInterval = null;
      }
    };

    const handleMouseLeave = () => {
      if (edgeScrollInterval) {
        clearInterval(edgeScrollInterval);
        edgeScrollInterval = null;
      }
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
      if (edgeScrollInterval) {
        clearInterval(edgeScrollInterval);
      }
    };
  }, [enabled, containerRef, camera.x, camera.y, clampCamera, onCameraChange]);

  // Handle scroll wheel zoom (optional)
  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newZoom = Math.max(0.5, Math.min(2, camera.zoom + delta));
      onCameraChange({ zoom: newZoom });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [enabled, containerRef, camera.zoom, onCameraChange]);
}

/**
 * Pan camera to center on a specific point
 */
export function panToPoint(
  targetX: number,
  targetY: number,
  viewportWidth: number,
  viewportHeight: number,
  zoom: number
): { x: number; y: number } {
  return {
    x: targetX - viewportWidth / (2 * zoom),
    y: targetY - viewportHeight / (2 * zoom),
  };
}
