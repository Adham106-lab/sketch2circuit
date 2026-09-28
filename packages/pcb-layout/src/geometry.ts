/**
 * @license Apache-2.0
 * @s2c/pcb-layout — 2D computational geometry, polygon collisions, and transformations.
 */

import type { Point } from "@s2c/pcb-json";

export interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function manhattanDistance(a: Point, b: Point): number {
  return Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
}

/**
 * Transforms a point by rotation (in degrees) around origin, then translation (x, y).
 */
export function transformPoint(p: Point, tx: number, ty: number, rotationDeg = 0): Point {
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const rx = p.x * cos - p.y * sin;
  const ry = p.x * sin + p.y * cos;

  return {
    x: rx + tx,
    y: ry + ty,
  };
}

/**
 * Transforms an entire polygon by rotation and translation.
 */
export function transformPolygon(poly: Point[], tx: number, ty: number, rotationDeg = 0): Point[] {
  return poly.map((p) => transformPoint(p, tx, ty, rotationDeg));
}

/**
 * Computes axis-aligned bounding box of a point set.
 */
export function getBoundingBox(poly: Point[]): BoundingBox {
  if (poly.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const p of poly) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  return { minX, maxX, minY, maxY };
}

/**
 * Checks whether two bounding boxes overlap.
 */
export function boundingBoxesOverlap(a: BoundingBox, b: BoundingBox, margin = 0): boolean {
  if (a.maxX + margin < b.minX) return false;
  if (a.minX - margin > b.maxX) return false;
  if (a.maxY + margin < b.minY) return false;
  if (a.minY - margin > b.maxY) return false;
  return true;
}

/**
 * Tests whether a point lies inside a polygon using ray casting algorithm.
 */
export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  const n = polygon.length;
  if (n < 3) return false;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const pi = polygon[i] ?? { x: 0, y: 0 };
    const pj = polygon[j] ?? { x: 0, y: 0 };

    const intersect =
      pi.y > point.y !== pj.y > point.y &&
      point.x < ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y) + pi.x;

    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Tests whether two line segments (p1-p2) and (p3-p4) intersect.
 */
export function lineSegmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  function ccw(a: Point, b: Point, c: Point): boolean {
    return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
  }

  return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
}

/**
 * Tests whether two arbitrary 2D polygons collide / overlap.
 */
export function polygonsIntersect(polyA: Point[], polyB: Point[]): boolean {
  if (polyA.length < 3 || polyB.length < 3) return false;

  // 1. Fast bounding box rejection
  const bbA = getBoundingBox(polyA);
  const bbB = getBoundingBox(polyB);
  if (!boundingBoxesOverlap(bbA, bbB)) {
    return false;
  }

  // 2. Check edge-edge intersections
  const nA = polyA.length;
  const nB = polyB.length;
  for (let i = 0; i < nA; i++) {
    const a1 = polyA[i] ?? { x: 0, y: 0 };
    const a2 = polyA[(i + 1) % nA] ?? { x: 0, y: 0 };

    for (let j = 0; j < nB; j++) {
      const b1 = polyB[j] ?? { x: 0, y: 0 };
      const b2 = polyB[(j + 1) % nB] ?? { x: 0, y: 0 };

      if (lineSegmentsIntersect(a1, a2, b1, b2)) {
        return true;
      }
    }
  }

  // 3. Check if one polygon is strictly contained inside the other
  const firstA = polyA[0];
  if (firstA && pointInPolygon(firstA, polyB)) return true;

  const firstB = polyB[0];
  if (firstB && pointInPolygon(firstB, polyA)) return true;

  return false;
}

/**
 * Checks whether an inner polygon is completely contained within an outer polygon.
 */
export function isPolygonContained(inner: Point[], outer: Point[]): boolean {
  if (inner.length === 0 || outer.length < 3) return false;

  // 1. All vertices of inner must be inside outer
  for (const p of inner) {
    if (!pointInPolygon(p, outer)) {
      return false;
    }
  }

  // 2. No edges of inner may cross edges of outer
  const nIn = inner.length;
  const nOut = outer.length;
  for (let i = 0; i < nIn; i++) {
    const in1 = inner[i] ?? { x: 0, y: 0 };
    const in2 = inner[(i + 1) % nIn] ?? { x: 0, y: 0 };

    for (let j = 0; j < nOut; j++) {
      const out1 = outer[j] ?? { x: 0, y: 0 };
      const out2 = outer[(j + 1) % nOut] ?? { x: 0, y: 0 };

      if (lineSegmentsIntersect(in1, in2, out1, out2)) {
        return false;
      }
    }
  }

  return true;
}
