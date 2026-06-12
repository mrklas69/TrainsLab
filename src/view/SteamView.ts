import * as THREE from 'three';
import type { CarVisual } from './carModels';

const MAX_PARTICLES = 320;
const WHITE_STEAM = new THREE.Color(0xf4f6f5);
const LIGHT_SMOKE = new THREE.Color(0xb8b8b2);
const DARK_SMOKE = new THREE.Color(0x262522);
const UP = new THREE.Vector3(0, 1, 0);

// Vítr je ryze view jev: ovlivňuje jen world-space částice, ne dynamiku vlaku (DD-01).
export interface WindParams {
  strength: number;             // m/s — 0 = bezvětří
  directionVariability: number; // stupně — max. změna směru při jednom přeladění
  changeInterval: number;       // s — průměrná doba mezi náhodnými změnami
}

export const DEFAULT_WIND: WindParams = {
  strength: 4,
  directionVariability: 70,
  changeInterval: 8,
};

interface Particle {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  velocity: THREE.Vector3;
  age: number;
  life: number;
  startSize: number;
  endSize: number;
  startOpacity: number;
  drag: number;
  buoyancy: number;
  turbulence: number;
  windResponse: number;
  seed: number;
}

export interface SteamState {
  power: number;
  pressure: number;
  speed: number;
  throttleOpen: boolean;
  exhaustFired: boolean;
  fireLit: boolean;
}

// Měkká kruhová textura s nepravidelným okrajem. Vzniká lokálně, bez bitmap assetu;
// billboard pak nemá polygonální siluetu ani lowpoly facety.
function makeParticleTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D není dostupný pro texturu páry.');

  const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 60);
  gradient.addColorStop(0, 'rgba(255,255,255,0.96)');
  gradient.addColorStop(0.32, 'rgba(255,255,255,0.72)');
  gradient.addColorStop(0.68, 'rgba(255,255,255,0.25)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  return new THREE.CanvasTexture(canvas);
}

/**
 * Realistický kouř a pára jako měkké billboard částice ve world-space.
 *
 * Komín produkuje spaliny unášené za lokomotivou; válcové kohouty při rozjezdu
 * vypouštějí kondenzovanou páru dolů a do stran; rozvod pod výkonem jemně netěsní;
 * píšťala dostává krátký explicitní pulz. Sim o částicích neví (DD-01).
 */
export class SteamView {
  private readonly particles: Particle[] = [];
  private readonly texture = makeParticleTexture();
  private chimneyTimer = 0;
  private drainTimer = 0;
  private valveTimer = 0;
  private whistleTimer = 0;
  private whistleTime = 0;
  private time = 0;
  private windChangeTimer = 0;
  private windDirection = Math.random() * Math.PI * 2;
  private windStrengthFactor = 0.75;
  private readonly wind = new THREE.Vector3();
  private readonly targetWind = new THREE.Vector3();
  private readonly position = new THREE.Vector3();
  private readonly quaternion = new THREE.Quaternion();
  private readonly direction = new THREE.Vector3();

  constructor(scene: THREE.Scene, private readonly windParams: WindParams) {
    this.chooseWindTarget();
    this.wind.copy(this.targetWind);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const material = new THREE.SpriteMaterial({
        map: this.texture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        color: WHITE_STEAM,
      });
      const sprite = new THREE.Sprite(material);
      sprite.visible = false;
      sprite.renderOrder = 3;
      scene.add(sprite);
      this.particles.push({
        sprite,
        material,
        velocity: new THREE.Vector3(),
        age: 0,
        life: 1,
        startSize: 1,
        endSize: 2,
        startOpacity: 0.5,
        drag: 1,
        buoyancy: 1,
        turbulence: 0.5,
        windResponse: 0.5,
        seed: Math.random() * 1000,
      });
    }
  }

  triggerWhistle(duration = 1.1): void {
    this.whistleTime = Math.max(this.whistleTime, duration);
  }

  update(dt: number, visual: CarVisual, state: SteamState): void {
    this.time += dt;
    this.updateWind(dt);
    this.whistleTime = Math.max(0, this.whistleTime - dt);
    const emitters = visual.steamEmitters;
    if (!emitters) return;

    visual.group.getWorldQuaternion(this.quaternion);

    // Komín: souvislý proud spalin + několik hustších částic v okamžiku výfuku.
    // Směr vzhůru se mísí s vlečkou proti pohybu lokomotivy.
    if (state.fireLit) {
      const rate = state.throttleOpen ? 10 + state.power * 18 : 3;
      this.chimneyTimer += dt * rate;
      while (this.chimneyTimer >= 1) {
        this.chimneyTimer -= 1;
        this.emitChimney(emitters.chimney, state, false);
      }
      if (state.exhaustFired) {
        const burst = 3 + Math.round(state.power * 4);
        for (let i = 0; i < burst; i++) this.emitChimney(emitters.chimney, state, true);
      }
    }

    // Odvodňovací kohouty: nejvíc kondenzátu při otevřeném regulátoru a nízké rychlosti.
    const drainLevel = state.throttleOpen && state.pressure > 0
      ? state.pressure * Math.max(0, 1 - Math.abs(state.speed) / 4.5)
      : 0;
    this.drainTimer += dt * drainLevel * 42;
    while (this.drainTimer >= 1) {
      this.drainTimer -= 1;
      for (const emitter of emitters.cylinderDrains) this.emitCylinderSteam(emitter);
    }

    // Ucpávky a rozvod: slabé nepravidelné prosakování jen při práci válců.
    const valveLevel = state.power * Math.min(Math.abs(state.speed) / 2 + 0.2, 1);
    this.valveTimer += dt * valveLevel * 8;
    while (this.valveTimer >= 1) {
      this.valveTimer -= 1;
      const emitter = emitters.valveGear[Math.random() < 0.5 ? 0 : 1];
      this.emitValveSteam(emitter);
    }

    if (this.whistleTime > 0 && state.pressure > 0) {
      this.whistleTimer += dt * 45;
      while (this.whistleTimer >= 1) {
        this.whistleTimer -= 1;
        this.emitWhistle(emitters.whistle);
      }
    } else {
      this.whistleTimer = 0;
    }

    this.updateParticles(dt);
  }

  private emitChimney(emitter: THREE.Object3D, state: SteamState, burst: boolean): void {
    emitter.getWorldPosition(this.position);
    const darkness = Math.min(0.18 + state.power * 0.82, 1);
    const color = LIGHT_SMOKE.clone().lerp(DARK_SMOKE, darkness);
    const backward = Math.sign(state.speed) * Math.min(Math.abs(state.speed) * 0.22, 3.5);
    this.direction.set(0, 2.2 + state.power * 1.5, backward).applyQuaternion(this.quaternion);
    this.emit(this.position, this.direction, {
      color,
      size: burst ? 0.65 + state.power * 0.45 : 0.45 + state.power * 0.35,
      endSize: burst ? 4.2 : 3.2,
      opacity: burst ? 0.34 + state.power * 0.2 : 0.22 + state.power * 0.15,
      life: 3.8 + Math.random() * 1.7,
      spread: burst ? 1.0 : 0.55,
      drag: 0.38,
      buoyancy: 0.8,
      turbulence: 0.75,
      windResponse: 0.32,
    });
  }

  private emitCylinderSteam(emitter: THREE.Object3D): void {
    emitter.getWorldPosition(this.position);
    emitter.getWorldQuaternion(this.quaternion);
    // Marker x určuje stranu; lokální vektor míří ven a dolů.
    const side = emitter.position.x < 0 ? -1 : 1;
    this.direction.set(side * 4.8, -2.2, -0.7).applyQuaternion(this.quaternion);
    this.emit(this.position, this.direction, {
      color: WHITE_STEAM,
      size: 0.28,
      endSize: 2.4,
      opacity: 0.62,
      life: 1.15 + Math.random() * 0.45,
      spread: 1.5,
      drag: 1.35,
      buoyancy: 1.8,
      turbulence: 1.1,
      windResponse: 0.85,
    });
  }

  private emitValveSteam(emitter: THREE.Object3D): void {
    emitter.getWorldPosition(this.position);
    emitter.getWorldQuaternion(this.quaternion);
    const side = emitter.position.x < 0 ? -1 : 1;
    this.direction.set(side * 1.8, 0.5, 0).applyQuaternion(this.quaternion);
    this.emit(this.position, this.direction, {
      color: WHITE_STEAM,
      size: 0.2,
      endSize: 1.25,
      opacity: 0.34,
      life: 0.75 + Math.random() * 0.45,
      spread: 0.7,
      drag: 1.8,
      buoyancy: 1.4,
      turbulence: 0.8,
      windResponse: 0.9,
    });
  }

  private emitWhistle(emitter: THREE.Object3D): void {
    emitter.getWorldPosition(this.position);
    emitter.getWorldQuaternion(this.quaternion);
    this.direction.copy(UP).multiplyScalar(5.5).applyQuaternion(this.quaternion);
    this.emit(this.position, this.direction, {
      color: WHITE_STEAM,
      size: 0.22,
      endSize: 1.7,
      opacity: 0.52,
      life: 0.9 + Math.random() * 0.3,
      spread: 0.8,
      drag: 1.1,
      buoyancy: 2.1,
      turbulence: 0.7,
      windResponse: 0.75,
    });
  }

  private emit(
    position: THREE.Vector3,
    velocity: THREE.Vector3,
    config: {
      color: THREE.Color;
      size: number;
      endSize: number;
      opacity: number;
      life: number;
      spread: number;
      drag: number;
      buoyancy: number;
      turbulence: number;
      windResponse: number;
    },
  ): void {
    const particle = this.particles.find((candidate) => !candidate.sprite.visible);
    if (!particle) return;

    particle.sprite.position.copy(position);
    particle.sprite.position.x += (Math.random() - 0.5) * config.size * 0.45;
    particle.sprite.position.z += (Math.random() - 0.5) * config.size * 0.45;
    particle.velocity.copy(velocity);
    particle.velocity.x += (Math.random() - 0.5) * config.spread;
    particle.velocity.y += (Math.random() - 0.5) * config.spread * 0.45;
    particle.velocity.z += (Math.random() - 0.5) * config.spread;
    particle.age = 0;
    particle.life = config.life;
    particle.startSize = config.size;
    particle.endSize = config.endSize;
    particle.startOpacity = config.opacity;
    particle.drag = config.drag;
    particle.buoyancy = config.buoyancy;
    particle.turbulence = config.turbulence;
    particle.windResponse = config.windResponse;
    particle.seed = Math.random() * 1000;
    particle.material.color.copy(config.color);
    particle.material.opacity = config.opacity;
    particle.sprite.scale.setScalar(config.size);
    particle.sprite.visible = true;
  }

  private updateParticles(dt: number): void {
    for (const particle of this.particles) {
      if (!particle.sprite.visible) continue;
      particle.age += dt;
      if (particle.age >= particle.life) {
        particle.sprite.visible = false;
        continue;
      }

      const t = particle.age / particle.life;
      const damping = Math.exp(-particle.drag * dt);
      particle.velocity.multiplyScalar(damping);
      particle.velocity.y += particle.buoyancy * dt;
      // Pára reaguje na vítr rychleji než hutnější kouř. Vodorovná rychlost se
      // přibližuje rychlosti vzduchu; svislou dál řídí výstupní impuls a vztlak.
      const windAlpha = 1 - Math.exp(-particle.windResponse * dt);
      particle.velocity.x = THREE.MathUtils.lerp(particle.velocity.x, this.wind.x, windAlpha);
      particle.velocity.z = THREE.MathUtils.lerp(particle.velocity.z, this.wind.z, windAlpha);
      const swirl = this.time * 2.1 + particle.seed;
      particle.velocity.x += Math.sin(swirl * 1.7) * particle.turbulence * dt;
      particle.velocity.z += Math.cos(swirl * 1.3) * particle.turbulence * dt;
      particle.sprite.position.addScaledVector(particle.velocity, dt);

      const eased = 1 - (1 - t) * (1 - t);
      const size = THREE.MathUtils.lerp(particle.startSize, particle.endSize, eased);
      particle.sprite.scale.setScalar(size);
      // Pára rychle kondenzuje a pak řídne; smooth fade odstraní ostrý vznik i zánik.
      const fadeIn = Math.min(t / 0.08, 1);
      const fadeOut = (1 - t) * (1 - t);
      particle.material.opacity = particle.startOpacity * fadeIn * fadeOut;
    }
  }

  private updateWind(dt: number): void {
    this.windChangeTimer -= dt;
    if (this.windChangeTimer <= 0) this.chooseWindTarget();

    // Síla 0 dává explicitní bezvětří. Změna je plynulá a nezávislá na FPS.
    const speed = this.windParams.strength * this.windStrengthFactor;
    this.targetWind.set(
      Math.cos(this.windDirection) * speed,
      0,
      Math.sin(this.windDirection) * speed,
    );
    const responseTime = Math.max(0.5, this.windParams.changeInterval * 0.25);
    const alpha = 1 - Math.exp(-dt / responseTime);
    this.wind.lerp(this.targetWind, alpha);
  }

  private chooseWindTarget(): void {
    const maxTurn = THREE.MathUtils.degToRad(this.windParams.directionVariability);
    this.windDirection += (Math.random() * 2 - 1) * maxTurn;
    this.windStrengthFactor = 0.55 + Math.random() * 0.45;
    const intervalJitter = 0.75 + Math.random() * 0.5;
    this.windChangeTimer = Math.max(0.5, this.windParams.changeInterval * intervalJitter);
  }
}
