import type CreativeEngine from '@cesdk/engine';
import type { DesignBlockId } from '@cesdk/engine';

import type { Point } from './geometry';

export interface BrushInputHandlers {
  /** Preview line style, read when a stroke starts. Width is in design units. */
  previewStyle: () => { color: string; width: number };
  /** Called when the pointer goes down on the canvas, before the stroke starts. */
  onStrokeStart: () => void;
  /** Called with the finished stroke, in CSS pixels relative to the engine canvas. */
  onStrokeEnd: (page: DesignBlockId, points: Point[]) => void;
}

/**
 * Takes pointer input on the engine canvas and draws a live preview of the
 * stroke. Listeners run in the capture phase and stop the events there, so the
 * engine does not select or move blocks while the user draws. The editor panels
 * lie outside the engine canvas and stay usable.
 *
 * @returns A function that removes the listeners and the preview.
 */
export function attachBrushInput(
  engine: CreativeEngine,
  handlers: BrushInputHandlers
): () => void {
  const engineCanvas = engine.element;
  const host = engineCanvas?.parentElement;
  if (engineCanvas == null || host == null) {
    throw new Error(
      'The annotation brush needs an engine with a canvas element.'
    );
  }

  // Sits right above the engine canvas and below the editor UI.
  const preview = document.createElement('canvas');
  Object.assign(preview.style, {
    position: 'absolute',
    pointerEvents: 'none'
  });
  engineCanvas.after(preview);
  const ctx = preview.getContext('2d')!;

  const previousCursor = engineCanvas.style.cursor;
  const previousTouchAction = engineCanvas.style.touchAction;
  engineCanvas.style.cursor = 'crosshair';
  // Without this, a touch or pen stroke scrolls or zooms the page instead.
  engineCanvas.style.touchAction = 'none';

  let pointerId: number | null = null;
  let page: DesignBlockId | null = null;
  let points: Point[] = [];
  let lineWidth = 1;
  let color = '';

  const toLocal = (event: PointerEvent): Point => {
    const rect = engineCanvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const redraw = () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, preview.width, preview.height);
    if (points.length < 2) return;
    const dpr = window.devicePixelRatio;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    points.forEach((p, i) =>
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)
    );
    ctx.stroke();
  };

  // The canvas size follows the editor layout, for example when a panel opens.
  const resize = () => {
    const rect = engineCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio;
    preview.width = Math.round(rect.width * dpr);
    preview.height = Math.round(rect.height * dpr);
    Object.assign(preview.style, {
      left: `${engineCanvas.offsetLeft}px`,
      top: `${engineCanvas.offsetTop}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`
    });
    redraw();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(engineCanvas);
  resize();

  const reset = () => {
    pointerId = null;
    page = null;
    points = [];
    redraw();
  };

  // During a stroke, every other pointer is stopped too: a second finger, a
  // palm or another button would otherwise select, drag or pan in the engine.
  const onDown = (event: PointerEvent) => {
    if (pointerId != null) {
      event.stopPropagation();
      event.preventDefault();
      return;
    }
    if (!event.isPrimary || event.button !== 0) return;
    if (!engineCanvas.contains(event.target as Node)) return;
    const start = toLocal(event);
    const target = pageAt(engine, start);
    if (target == null) return;
    event.stopPropagation();
    event.preventDefault();
    host.setPointerCapture(event.pointerId);
    handlers.onStrokeStart();

    const style = handlers.previewStyle();
    const [, , pageScreenWidth] = engine.block.getScreenSpaceBoundingBoxXYWH([
      target
    ]);
    lineWidth = (style.width * pageScreenWidth) / engine.block.getWidth(target);
    color = style.color;
    pointerId = event.pointerId;
    page = target;
    points = [start];
  };

  const onMove = (event: PointerEvent) => {
    if (pointerId == null) return;
    event.stopPropagation();
    if (event.pointerId !== pointerId) return;
    // A pen reports more positions than one event per frame carries.
    const events = event.getCoalescedEvents?.() ?? [];
    (events.length > 0 ? events : [event]).forEach((e) =>
      points.push(toLocal(e))
    );
    redraw();
  };

  const onUp = (event: PointerEvent) => {
    if (pointerId == null) return;
    event.stopPropagation();
    if (event.pointerId !== pointerId) return;
    const finished = { page: page!, points };
    reset();
    if (finished.points.length > 1) {
      handlers.onStrokeEnd(finished.page, finished.points);
    }
  };

  const onCancel = (event: PointerEvent) => {
    if (pointerId == null) return;
    event.stopPropagation();
    if (event.pointerId === pointerId) reset();
  };

  // The stroke is recorded in screen pixels and mapped to the page on release,
  // so the camera must not move in between.
  const onWheel = (event: WheelEvent) => {
    if (pointerId == null) return;
    event.preventDefault();
    event.stopPropagation();
  };

  // The engine reads touch input from touch events, not pointer events. A touch
  // sequence that starts during a stroke stays blocked until its last finger
  // lifts, because its touchend arrives after the stroke's pointerup.
  let blockingTouches = false;
  const onTouch = (event: TouchEvent) => {
    if (event.type === 'touchstart' && pointerId != null) {
      blockingTouches = true;
    }
    if (!blockingTouches) return;
    event.stopPropagation();
    if (event.type === 'touchmove') event.preventDefault();
    if (event.type !== 'touchstart' && event.touches.length === 0) {
      blockingTouches = false;
    }
  };
  const touchTypes = ['touchstart', 'touchmove', 'touchend', 'touchcancel'];

  host.addEventListener('pointerdown', onDown, true);
  host.addEventListener('pointermove', onMove, true);
  host.addEventListener('pointerup', onUp, true);
  host.addEventListener('pointercancel', onCancel, true);
  host.addEventListener('wheel', onWheel, { capture: true, passive: false });
  touchTypes.forEach((type) =>
    host.addEventListener(type, onTouch as EventListener, {
      capture: true,
      passive: false
    })
  );

  return () => {
    host.removeEventListener('pointerdown', onDown, true);
    host.removeEventListener('pointermove', onMove, true);
    host.removeEventListener('pointerup', onUp, true);
    host.removeEventListener('pointercancel', onCancel, true);
    host.removeEventListener('wheel', onWheel, { capture: true });
    touchTypes.forEach((type) =>
      host.removeEventListener(type, onTouch as EventListener, {
        capture: true
      })
    );
    resizeObserver.disconnect();
    engineCanvas.style.cursor = previousCursor;
    engineCanvas.style.touchAction = previousTouchAction;
    preview.remove();
  };
}

/**
 * The page under `point`, or the nearest page when the point is between pages.
 * Null when the scene has no page.
 */
function pageAt(engine: CreativeEngine, point: Point): DesignBlockId | null {
  let best: DesignBlockId | null = null;
  let bestDistance = Infinity;
  for (const page of engine.scene.getPages()) {
    const [x, y, w, h] = engine.block.getScreenSpaceBoundingBoxXYWH([page]);
    const dx = Math.max(x - point.x, 0, point.x - (x + w));
    const dy = Math.max(y - point.y, 0, point.y - (y + h));
    const distance = Math.hypot(dx, dy);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = page;
    }
  }
  return best;
}
