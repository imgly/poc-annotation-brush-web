/** A point in screen pixels or page design units, depending on the caller. */
export interface Point {
  x: number;
  y: number;
}

/** SVG path data in a local frame whose top-left corner is the origin. */
export interface PathGeometry {
  /** SVG path data, for `shape/vector_path/path`. */
  path: string;
  /** Position of the local frame on the page, in design units. */
  x: number;
  y: number;
  /** Size of the local frame, in design units. At least 1 on each axis. */
  width: number;
  height: number;
}

export interface StrokePathOptions {
  /** Joins the end point back to the start point with `Z`. */
  closePath: boolean;
  /** Fits a smooth curve through the stroke instead of keeping the raw polyline. */
  smooth: boolean;
  /** Smoothing strength from 1 to 10. Only used when `smooth` is on. */
  smoothing: number;
}

// Screen pixels. With smoothing off, only points this close to the line are dropped.
const RAW_TOLERANCE = 0.5;

/**
 * Turns pointer positions into SVG path data on a page.
 *
 * @param screenPoints - Pointer positions in CSS pixels, in drawing order.
 * @param toPage - Maps a screen position to page design units.
 * @param options - Path closing and smoothing.
 * @returns The path in a local frame, and where that frame sits on the page.
 */
export function buildStrokePath(
  screenPoints: Point[],
  toPage: (point: Point) => Point,
  options: StrokePathOptions
): PathGeometry {
  const { closePath, smooth, smoothing } = options;
  // Smoothing and simplification run in screen pixels, so a stroke drawn at a
  // high zoom keeps the same amount of detail as one drawn zoomed out.
  const input = smooth
    ? movingAverage(screenPoints, 2 * smoothing - 1, closePath)
    : screenPoints;
  const tolerance = smooth ? smoothing : RAW_TOLERANCE;
  const pagePoints = simplify(input, tolerance).map(toPage);

  const xs = pagePoints.map((p) => p.x);
  const ys = pagePoints.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  // A perfectly straight stroke has no extent on one axis.
  const width = Math.max(1, Math.max(...xs) - x);
  const height = Math.max(1, Math.max(...ys) - y);
  const local = pagePoints.map((p) => ({ x: p.x - x, y: p.y - y }));
  const path = smooth
    ? toSmoothPath(local, closePath)
    : toPolylinePath(local, closePath);
  return { path, x, y, width, height };
}

/**
 * Averages each point with `radius` neighbours on each side. An open stroke
 * keeps its end points, so the line still starts and ends where it was drawn.
 */
export function movingAverage(
  points: Point[],
  radius: number,
  closed: boolean
): Point[] {
  const n = points.length;
  return points.map((p, i) => {
    if (!closed && (i === 0 || i === n - 1)) return p;
    const r = closed
      ? Math.min(radius, Math.floor((n - 1) / 2))
      : Math.min(radius, i, n - 1 - i);
    let x = 0;
    let y = 0;
    for (let k = -r; k <= r; k++) {
      const q = points[(i + k + n) % n];
      x += q.x;
      y += q.y;
    }
    return { x: x / (2 * r + 1), y: y / (2 * r + 1) };
  });
}

/**
 * Ramer–Douglas–Peucker simplification: drops points closer than `tolerance`
 * to the line between the points that are kept.
 */
export function simplify(points: Point[], tolerance: number): Point[] {
  if (points.length < 3) return points;
  const first = points[0];
  const last = points[points.length - 1];
  let maxDistance = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = distanceToSegment(points[i], first, last);
    if (d > maxDistance) {
      maxDistance = d;
      index = i;
    }
  }
  if (maxDistance <= tolerance) return [first, last];
  const left = simplify(points.slice(0, index + 1), tolerance);
  const right = simplify(points.slice(index), tolerance);
  return [...left.slice(0, -1), ...right];
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq)
  );
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

const fmt = (n: number) => n.toFixed(2);

/** Straight segments through the points. */
export function toPolylinePath(points: Point[], closed: boolean): string {
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${fmt(p.x)},${fmt(p.y)}`)
    .join(' ');
  return closed ? `${d} Z` : d;
}

/**
 * Catmull-Rom spline through the points, written as cubic Bézier segments.
 * A closed spline wraps its neighbours around, so the join has no corner.
 */
export function toSmoothPath(points: Point[], closed: boolean): string {
  const n = points.length;
  const at = (i: number) =>
    closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))];
  const segments = closed ? n : n - 1;
  let d = `M ${fmt(points[0].x)},${fmt(points[0].y)}`;
  for (let i = 0; i < segments; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${fmt(c1.x)},${fmt(c1.y)} ${fmt(c2.x)},${fmt(c2.y)} ${fmt(
      p2.x
    )},${fmt(p2.y)}`;
  }
  return closed ? `${d} Z` : d;
}
