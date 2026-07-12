/**
 * Čisté geometrické primitimy trati — bez závislosti na Three.js.
 * Fyzika čte zde a je agnostická k rendereru (DD-01).
 * Renderer (view) si dělá svou representaci (Curve3D → Three.Curve3).
 */

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface Curve3D {
  closed: boolean;
  getLength(): number;
  getPointAt(t: number): Point3D;  // [0,1] → Point3D
  getTangentAt(t: number): Point3D; // jednotkový vektor
}

/** Singleton pro Bernoulliho lemniskátu + mez křížení (most) — bez Three.js. */
export class LoopCurve implements Curve3D {
  readonly closed = true;
  private cachedLength: number | null = null;

  constructor(
    private readonly controlPoints: Point3D[],
    private readonly amplitude: number,
  ) {}

  getLength(): number {
    if (this.cachedLength === null) {
      // Numerická integrace arc-length — postačí 100 vzorků pro lemniskátu
      let length = 0;
      const samples = 100;
      let prevPoint = this.getPointAt(0);
      for (let i = 1; i <= samples; i++) {
        const t = i / samples;
        const point = this.getPointAt(t);
        const dx = point.x - prevPoint.x;
        const dy = point.y - prevPoint.y;
        const dz = point.z - prevPoint.z;
        length += Math.sqrt(dx * dx + dy * dy + dz * dz);
        prevPoint = point;
      }
      this.cachedLength = length;
    }
    return this.cachedLength;
  }

  getPointAt(t: number): Point3D {
    // t ∈ [0, 1] — normalizovaná arc-length
    // Zde použijeme jednoduchou centrální diferenci přes kontrolní body
    // (v reálné implementaci by se dělala CatmullRom, ale bez Three.js to dělám diskrétně)

    t = ((t % 1) + 1) % 1; // zabal do [0, 1)

    // Index v polích kontrolních bodů
    const n = this.controlPoints.length;
    const index = t * n;
    const i0 = Math.floor(index) % n;
    const i1 = (i0 + 1) % n;

    const alpha = index - Math.floor(index);
    const p0 = this.controlPoints[i0];
    const p1 = this.controlPoints[i1];

    // Lineární interpolace (v produkčním kódu by byla CatmullRom)
    const x = p0.x * (1 - alpha) + p1.x * alpha;
    const z = p0.z * (1 - alpha) + p1.z * alpha;
    const baseY = p0.y * (1 - alpha) + p1.y * alpha;

    // Přidej most — právě zde se spojuje s terrain.ts
    const bridgeY = this.bridgeLiftAt(t);
    const y = baseY + bridgeY;

    return { x, y, z };
  }

  getTangentAt(t: number): Point3D {
    const eps = 0.001;
    const p0 = this.getPointAt(t - eps);
    const p1 = this.getPointAt(t + eps);

    let dx = p1.x - p0.x;
    let dy = p1.y - p0.y;
    let dz = p1.z - p0.z;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (len > 1e-6) {
      dx /= len;
      dy /= len;
      dz /= len;
    }

    return { x: dx, y: dy, z: dz };
  }

  private bridgeLiftAt(t: number): number {
    const BRIDGE_HEIGHT = 8;
    const BRIDGE_WIDTH = 0.5;

    let d = t - 0.5; // π/2 v normalizaci [0,1]
    if (d > 0.5) d -= 1;
    if (d < -0.5) d += 1;

    return BRIDGE_HEIGHT * Math.exp(-(d * d) / (BRIDGE_WIDTH * BRIDGE_WIDTH));
  }
}
