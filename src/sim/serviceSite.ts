import type { RouteId, TrackLocation, TrackNetwork } from './TrackNetwork';

export const SERVICE_ROUTE: RouteId = 'branch';
export const SERVICE_SEG = 4;
export const SERVICE_U = 0.55;
export const SERVICE_RADIUS = 10;       // m po trase — loko musí zastavit u jeřábu, ne jen projet kolem
export const SERVICE_STOP_SPEED = 0.35; // m/s — „stojí" s malou tolerancí kvůli integrátoru a dojezdu
export const SERVICE_COAL_RATE = 35;    // kg/s — rychlé demo doplnění, ale pořád postupné
export const SERVICE_WATER_RATE = 180;  // kg/s — voda se doplňuje rychleji než uhlí, jako u vodního jeřábu
export const SERVICE_SAND_RATE = 12;     // kg/s — dosypání pískoven při stejné servisní zastávce

/** Poloha vodního jeřábu na odbočné trase. Sdílí ji sim i view, aby domek a pravidlo nelhaly. */
export function serviceLocation(network: TrackNetwork): TrackLocation | null {
  const segment = network.segments[SERVICE_SEG];
  if (!segment) return null;
  return { seg: SERVICE_SEG, s: segment.length * SERVICE_U, route: SERVICE_ROUTE };
}

/** Vzdálenost zadané polohy od servisního bodu po branch trase; null = poloha na route neleží. */
export function serviceDistance(network: TrackNetwork, loc: TrackLocation): number | null {
  if (!network.isSegmentOnRoute(loc.seg, SERVICE_ROUTE)) return null;
  const service = serviceLocation(network);
  if (!service) return null;

  const length = network.routeLength(SERVICE_ROUTE);
  let d = network.globalS(loc, SERVICE_ROUTE) - network.globalS(service, SERVICE_ROUTE);
  if (d > length / 2) d -= length;
  else if (d < -length / 2) d += length;
  return Math.abs(d);
}
