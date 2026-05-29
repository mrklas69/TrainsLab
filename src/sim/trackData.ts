import { Vector3 } from 'three';

/**
 * Kontrolní body zvlněné smyčky: ovál v rovině XZ s výškovým profilem ve Y.
 * Dva kopce a dvě údolí na kolo — aby gravitace podél trati měla co dělat.
 *
 * `amplitude` = výška kopců (m); laditelná za běhu (slider sklonu → Track.rebuild).
 * Max sklon ≈ 2·amplitude/radius → 1.2 dává ~5.7 % (3.3°), realistická horská trať,
 * kterou souprava 180 t s adhezí ~177 kN vyjede. amplitude 6 = 28 % sklon (490 kN) = nevyjet.
 */
export function makeLoopControlPoints(amplitude: number): Vector3[] {
  const points: Vector3[] = [];
  const radius = 40; // poloměr smyčky (m)
  const count = 12;  // počet kontrolních bodů
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    points.push(
      new Vector3(
        Math.cos(a) * radius,
        amplitude * Math.sin(a * 2), // 2 periody na kolo → 2 kopce, 2 údolí
        Math.sin(a) * radius,
      ),
    );
  }
  return points;
}
