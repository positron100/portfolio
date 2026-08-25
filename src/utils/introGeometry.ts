/**
 * The avatar's own wireframe, as plain math.
 *
 * `DeveloperAvatarScene` renders `<icosahedronGeometry args={[1, 1]} />` with
 * a wireframe material. This module reproduces exactly that solid's vertices
 * and edges without importing `three`, so the opening sequence's 2D dot
 * field can be built from the *same* points the 3D avatar is made of — and
 * projected through the *same* camera. That is what lets the intro hand off
 * seamlessly: the dots don't merely resemble the avatar, they sit on its
 * vertices, and the lines between them are its edges, so the real avatar
 * fading in on top is the identical shape simply becoming solid.
 *
 * Keep `AVATAR_CAMERA` in sync with the `<Canvas camera>` prop — the scene
 * imports these same constants rather than repeating the numbers.
 */

export const AVATAR_CAMERA = { z: 4.2, fov: 40 };

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

function normalize(v: Vec3): Vec3 {
  const length = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

function midpoint(a: Vec3, b: Vec3): Vec3 {
  return normalize({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });
}

/** Rounded so the two faces sharing a vertex/edge resolve to one entry. */
function key(v: Vec3): string {
  return `${v.x.toFixed(5)}|${v.y.toFixed(5)}|${v.z.toFixed(5)}`;
}

/**
 * Icosahedron subdivided once and projected back onto the unit sphere —
 * three.js's `IcosahedronGeometry(1, 1)`. 42 unique vertices, 120 unique
 * edges.
 */
export function icosahedronWireframe(): { vertices: Vec3[]; edges: [number, number][] } {
  const t = (1 + Math.sqrt(5)) / 2;
  const base: Vec3[] = [
    { x: -1, y: t, z: 0 }, { x: 1, y: t, z: 0 }, { x: -1, y: -t, z: 0 }, { x: 1, y: -t, z: 0 },
    { x: 0, y: -1, z: t }, { x: 0, y: 1, z: t }, { x: 0, y: -1, z: -t }, { x: 0, y: 1, z: -t },
    { x: t, y: 0, z: -1 }, { x: t, y: 0, z: 1 }, { x: -t, y: 0, z: -1 }, { x: -t, y: 0, z: 1 },
  ].map(normalize);

  const baseFaces: [number, number, number][] = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];

  const vertices: Vec3[] = [];
  const indexByKey = new Map<string, number>();
  const edgeKeys = new Set<string>();
  const edges: [number, number][] = [];

  function indexOf(v: Vec3): number {
    const k = key(v);
    const existing = indexByKey.get(k);
    if (existing !== undefined) return existing;
    indexByKey.set(k, vertices.length);
    vertices.push(v);
    return vertices.length - 1;
  }

  function addEdge(a: number, b: number) {
    const k = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (edgeKeys.has(k)) return;
    edgeKeys.add(k);
    edges.push([a, b]);
  }

  for (const [ia, ib, ic] of baseFaces) {
    const a = base[ia];
    const b = base[ib];
    const c = base[ic];
    const ab = midpoint(a, b);
    const bc = midpoint(b, c);
    const ca = midpoint(c, a);

    // The four sub-triangles of one subdivided face.
    for (const tri of [
      [a, ab, ca],
      [ab, b, bc],
      [ca, bc, c],
      [ab, bc, ca],
    ] as Vec3[][]) {
      const [p, q, r] = tri.map(indexOf);
      addEdge(p, q);
      addEdge(q, r);
      addEdge(r, p);
    }
  }

  return { vertices, edges };
}

/**
 * Perspective-projects a unit-sphere vertex to a pixel offset from the
 * avatar's center, for a square canvas `size` px tall — matching what the
 * r3f camera does with the same fov/position.
 */
export function projectVertex(v: Vec3, size: number): { x: number; y: number; depth: number } {
  const focal = size / (2 * Math.tan((AVATAR_CAMERA.fov * Math.PI) / 360));
  const distance = AVATAR_CAMERA.z - v.z;
  return {
    // Screen y grows downward; the 3D scene's y grows upward.
    x: (v.x * focal) / distance,
    y: (-v.y * focal) / distance,
    depth: v.z,
  };
}
