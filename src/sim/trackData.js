import { Vector3 } from 'three';
/**
 * Kontrolní body zvlněné smyčky: ovál v rovině XZ s výškovým profilem ve Y.
 * Dva kopce a dvě údolí na kolo — aby gravitace podél trati měla co dělat.
 */
export function makeLoopControlPoints() {
    const points = [];
    const radius = 40; // poloměr smyčky (m)
    const count = 12; // počet kontrolních bodů
    // výška kopců (m). Max sklon ≈ 2·amplitude/radius → 1.2 dává ~5.7 % (3.3°),
    // realistická horská trať, kterou souprava 180 t s adhezí ~177 kN vyjede.
    // amplitude 6 dávala 28 % sklon (490 kN potřeba) — nevyjet.
    const amplitude = 1.2;
    for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        points.push(new Vector3(Math.cos(a) * radius, amplitude * Math.sin(a * 2), // 2 periody na kolo → 2 kopce, 2 údolí
        Math.sin(a) * radius));
    }
    return points;
}
