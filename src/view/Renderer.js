import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const CAR_WIDTH = 2.6;
const CAR_HEIGHT = 3.0;
const RAIL_RADIUS = 0.3;
/**
 * Renderer = čistá funkce stavu → obraz (DD-01). Drží ThreeJS scénu a každý
 * frame jen čte sim ({@link Body} na {@link Track}); nikdy stav nemění.
 */
export class Renderer {
    constructor(canvas, track, train) {
        this.track = track;
        this.scene = new THREE.Scene();
        this.gl = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.gl.setPixelRatio(window.devicePixelRatio);
        this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1000);
        this.camera.position.set(60, 55, 60);
        this.controls = new OrbitControls(this.camera, canvas);
        this.controls.enableDamping = true;
        this.scene.background = new THREE.Color(0x87ceeb);
        this.scene.add(new THREE.HemisphereLight(0xffffff, 0x404030, 1.0));
        const sun = new THREE.DirectionalLight(0xffffff, 1.5);
        sun.position.set(50, 80, 30);
        this.scene.add(sun);
        this.buildGround();
        this.buildTrack();
        this.carMeshes = this.buildCars(train);
        this.locoMaterial = this.carMeshes[0].material;
        this.onResize();
        window.addEventListener('resize', () => this.onResize());
    }
    // čte sim stav a promítá ho do scény — žádný zápis do modelu.
    render(train) {
        train.bodies.forEach((body, i) => {
            const { position, tangent } = this.track.at(body.s);
            const mesh = this.carMeshes[i];
            mesh.position.copy(position);
            mesh.position.y += CAR_HEIGHT / 2 + RAIL_RADIUS;
            mesh.lookAt(mesh.position.clone().add(tangent)); // čelo (−Z) ve směru jízdy
        });
        // prokluz hnacích kol → lokomotiva zežloutne
        this.locoMaterial.color.setHex(train.slipping ? 0xe0c020 : 0x8b2b2b);
        this.controls.update();
        this.gl.render(this.scene, this.camera);
    }
    buildGround() {
        const geo = new THREE.PlaneGeometry(400, 400);
        geo.rotateX(-Math.PI / 2);
        const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x4a7c3a }));
        ground.position.y = -10; // pod nejnižším bodem trati
        this.scene.add(ground);
    }
    buildTrack() {
        const geo = new THREE.TubeGeometry(this.track.curve, 400, RAIL_RADIUS, 8, true);
        this.scene.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x55564f })));
    }
    // kvádr na vůz; lokomotiva (index 0) červená, vozy modré.
    buildCars(train) {
        return train.bodies.map((body, i) => {
            const geo = new THREE.BoxGeometry(CAR_WIDTH, CAR_HEIGHT, body.length);
            const color = i === 0 ? 0x8b2b2b : 0x2b5a8b;
            const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color }));
            this.scene.add(mesh);
            return mesh;
        });
    }
    onResize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.gl.setSize(w, h);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
    }
}
