import { Vector3 } from 'three';

/**
 * Kontrolní body ležaté osmičky (Bernoulliho lemniskáta) v rovině XZ s mostem ve Y.
 *
 * Osmička dělá dvě věci jedním tahem:
 *  - **esíčko** — laloky jsou zatáčky (r ≈ 33 m), střed je inflexe (r → ∞);
 *    souprava zatáčí doleva, projede rovinkou ve středu, pak doprava. Proměnný poloměr
 *    dává příčné dynamice (odstředivka v²/r) co počítat — na lalocích hrozí převrácení.
 *  - **most** — trať se v půdorysu kříží ve středu osmičky. `Y = amplitude·sin(t)` posadí
 *    jeden průchod středem nahoru (most, t=π/2), druhý dolů (podjezd, t=3π/2).
 *
 * Tím se domény čistě oddělí (izomorfně s grade/radius ze S7): most leží na inflexi
 * (velký r, malá odstředivka) → tam jen podélná dynamika (stoupání k mostu natáhne
 * soupravu, klesání pod most zhustí = slack action). Ostré laloky leží v rovině (Y=0)
 * → tam jen příčná dynamika (riziko převrácení).
 *
 * `amplitude` = výška mostu nad/pod střednicí (m); clearance mostu = 2·amplitude.
 * Laditelná za běhu (slider sklonu → Track.rebuild).
 */
export function makeLoopControlPoints(amplitude: number): Vector3[] {
  const points: Vector3[] = [];
  const A = 150; // šířka osmičky (poloviční rozpětí v X, m) — větší = mírnější oblouky
  const B = 150; // výška laloků (rozpětí v Z, m)
  const count = 24;
  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2;
    const denom = 1 + Math.sin(t) * Math.sin(t); // Bernoulli — kulaté laloky místo špičatých (Gerono)
    points.push(
      new Vector3(
        (A * Math.cos(t)) / denom,
        amplitude * Math.sin(t), // most (t=π/2) nahoře, podjezd (t=3π/2) dole
        (B * Math.sin(t) * Math.cos(t)) / denom,
      ),
    );
  }
  return points;
}
