import * as THREE from 'three';
import { color } from '../design/tokens';
import { seeded, type FieldState } from './field-plan';

/**
 * The particle field — low-poly facets and sparks, drawn with WebGL.
 *
 * This is the one module allowed to import `three`. It owns a renderer on a
 * canvas the caller supplies, and paints one frame of the field for a given
 * `FieldState`; it never reads a clock, never animates on its own, and never
 * decides what a scene is. The canvas exporter draws its canvas into the
 * frame between the picture and the copy; the DOM preview mounts it as a
 * layer in the same position. Both hand it the state `field-plan.ts` computes.
 *
 * Everything moves in the shaders as a function of `uTime`, so a frame is a
 * pure function of its inputs: rendering frame 240 twice gives the same
 * pixels, and rendering frames out of order gives the same film.
 *
 * The look is the brand's: the facet hatch in `app/globals.css` and the low-
 * poly jacket art, in the same two tones. Facets are outlines in the off-white
 * with a few filled in the lime; sparks are lime points that rise and twinkle.
 * There is no third colour and no blur — the palette rule holds here too.
 */

export interface FieldOptions {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  width: number;
  height: number;
}

export interface Field {
  /** Paints one frame. Synchronous; read the canvas straight after. */
  render(state: FieldState): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

/** Facets in the field. Enough to fill a frame, few enough to never crowd copy. */
const FACETS = 120;
/** Sparks in the field. */
const SPARKS = 900;

/** The camera sees this many world units top to bottom at the facets' depth. */
const VIEW_HEIGHT = 6;
/** Facets wrap vertically inside this span, so one can never drift off forever. */
const WRAP = VIEW_HEIGHT + 2;

const FACET_VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uEnergy;
  uniform float uBurst;
  uniform float uEnter;
  uniform float uAspect;

  attribute vec3 aCenter;
  attribute vec4 aSeed;   // x: spin, y: rise, z: phase 0–1, w: kind
  attribute vec3 aBary;
  attribute float aSize;

  varying vec3 vBary;
  varying float vKind;
  varying float vAlpha;

  void main() {
    float t = uTime;
    vec3 c = aCenter;
    float span = ${(WRAP / 2).toFixed(2)};

    // Rise and wrap; sway sideways; scatter outward for a beat after a cut.
    c.y = mod(c.y + t * aSeed.y * (0.3 + uEnergy * 0.7) + span, ${WRAP.toFixed(2)}) - span;
    c.x += sin(t * 0.3 + aSeed.z * 6.2831) * 0.3;
    c.xy += normalize(c.xy + vec2(0.001)) * uBurst * (0.4 + aSeed.z * 0.6);

    float angle = aSeed.z * 6.2831 + t * aSeed.x;
    mat2 spin = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
    float size = aSize * (0.8 + uEnergy * 0.6) * (1.0 + uBurst * 0.6) * uEnter;
    vec3 p = c + vec3(spin * position.xy * size, 0.0);

    // Quieter scenes show fewer facets: each has a threshold it fades under.
    float presence = smoothstep(uEnergy + 0.2, uEnergy - 0.25, aSeed.z);
    // Depth: far facets are fainter, which is what sells the parallax.
    float depth = smoothstep(-7.0, 0.5, c.z);

    vBary = aBary;
    vKind = aSeed.w;
    vAlpha = presence * mix(0.35, 1.0, depth) * uEnter;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const FACET_FRAGMENT = /* glsl */ `
  uniform vec3 uFg;
  uniform vec3 uAccent;

  varying vec3 vBary;
  varying float vKind;
  varying float vAlpha;

  void main() {
    // Distance to the nearest edge in barycentric space; the outline is where
    // it is small. fwidth keeps the line one or two pixels wide at any size.
    float d = min(vBary.x, min(vBary.y, vBary.z));
    float w = fwidth(d) * 1.6;
    float edge = 1.0 - smoothstep(0.0, w, d);

    if (vKind < 0.5) {
      // Outline in the off-white: the hatch texture, given depth.
      gl_FragColor = vec4(uFg, edge * vAlpha * 0.5);
    } else if (vKind < 1.5) {
      // Filled in the lime: the few that carry the brand.
      gl_FragColor = vec4(uAccent, vAlpha * 0.8);
    } else {
      // A dim filled facet with a brighter edge: the low-poly ground.
      gl_FragColor = vec4(uFg, vAlpha * (0.05 + edge * 0.18));
    }
  }
`;

const SPARK_VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uEnergy;
  uniform float uBurst;
  uniform float uEnter;
  uniform float uPixelHeight;

  attribute vec4 aSeed;   // x: rise, y: sway phase, z: twinkle rate, w: tone 0–1

  varying float vAlpha;
  varying float vTone;

  void main() {
    float t = uTime;
    vec3 p = position;
    float span = ${(WRAP / 2).toFixed(2)};

    p.y = mod(p.y + t * aSeed.x * (0.4 + uEnergy) + span, ${WRAP.toFixed(2)}) - span;
    p.x += sin(t * 0.6 + aSeed.y * 6.2831) * 0.15;
    p.xy += normalize(p.xy + vec2(0.001)) * uBurst * 0.8 * aSeed.w;

    float twinkle = 0.3 + 0.7 * pow(sin(t * aSeed.z + aSeed.y * 6.2831), 2.0);
    float presence = smoothstep(uEnergy + 0.35, uEnergy - 0.1, aSeed.y);
    vAlpha = twinkle * presence * uEnter;
    vTone = aSeed.w;

    vec4 view = modelViewMatrix * vec4(p, 1.0);
    // Sized in pixels of the output, so a spark is a spark at 720p and 1080p.
    gl_PointSize = (1.5 + aSeed.w * 3.0) * (uPixelHeight / 1080.0) * (1.0 + uBurst) * (8.0 / -view.z);
    gl_Position = projectionMatrix * view;
  }
`;

const SPARK_FRAGMENT = /* glsl */ `
  uniform vec3 uFg;
  uniform vec3 uAccent;

  varying float vAlpha;
  varying float vTone;

  void main() {
    vec2 q = gl_PointCoord - vec2(0.5);
    float r = length(q) * 2.0;
    if (r > 1.0) discard;
    float soft = 1.0 - smoothstep(0.4, 1.0, r);
    // Mostly lime; the brightest few in the off-white.
    vec3 tint = mix(uAccent, uFg, step(0.85, vTone));
    gl_FragColor = vec4(tint, soft * vAlpha * 0.9);
  }
`;

function facetGeometry(): THREE.BufferGeometry {
  const random = seeded(0x5745);
  const corners = new Float32Array(FACETS * 9);
  const centers = new Float32Array(FACETS * 9);
  const seeds = new Float32Array(FACETS * 12);
  const bary = new Float32Array(FACETS * 9);
  const sizes = new Float32Array(FACETS * 3);

  for (let i = 0; i < FACETS; i += 1) {
    // A triangle that is not equilateral: three corners on a circle at uneven
    // angles, which is what makes a field of them read as shards, not badges.
    const a0 = random() * Math.PI * 2;
    const a1 = a0 + 1.6 + random() * 1.2;
    const a2 = a1 + 1.6 + random() * 1.2;
    const cx = (random() - 0.5) * VIEW_HEIGHT * 2.2;
    const cy = (random() - 0.5) * WRAP;
    const cz = -6 + random() * 6.5;
    const spin = (random() - 0.5) * 0.5;
    const rise = 0.1 + random() * 0.35;
    const phase = random();
    // About one facet in nine is filled lime; a third are dim fills; the rest
    // are outlines. The lime ones are the brand mark, so they stay rare.
    const kind = random() < 0.11 ? 1 : random() < 0.4 ? 2 : 0;
    const size = 0.12 + random() * random() * 0.9;

    [a0, a1, a2].forEach((angle, corner) => {
      const v = i * 3 + corner;
      corners[v * 3] = Math.cos(angle);
      corners[v * 3 + 1] = Math.sin(angle);
      corners[v * 3 + 2] = 0;
      centers[v * 3] = cx;
      centers[v * 3 + 1] = cy;
      centers[v * 3 + 2] = cz;
      seeds[v * 4] = spin;
      seeds[v * 4 + 1] = rise;
      seeds[v * 4 + 2] = phase;
      seeds[v * 4 + 3] = kind;
      bary[v * 3 + corner] = 1;
      sizes[v] = size;
    });
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(corners, 3));
  geometry.setAttribute('aCenter', new THREE.BufferAttribute(centers, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  geometry.setAttribute('aBary', new THREE.BufferAttribute(bary, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  // Positions are computed in the shader, so the bounding sphere three would
  // derive from the corner offsets is wrong. Never cull the field.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  return geometry;
}

function sparkGeometry(): THREE.BufferGeometry {
  const random = seeded(0x5350);
  const positions = new Float32Array(SPARKS * 3);
  const seeds = new Float32Array(SPARKS * 4);

  for (let i = 0; i < SPARKS; i += 1) {
    positions[i * 3] = (random() - 0.5) * VIEW_HEIGHT * 2.4;
    positions[i * 3 + 1] = (random() - 0.5) * WRAP;
    positions[i * 3 + 2] = -7 + random() * 7;
    seeds[i * 4] = 0.15 + random() * 0.5;
    seeds[i * 4 + 1] = random();
    seeds[i * 4 + 2] = 0.8 + random() * 2.4;
    seeds[i * 4 + 3] = random();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  return geometry;
}

export function createField(options: FieldOptions): Field {
  const renderer = new THREE.WebGLRenderer({
    canvas: options.canvas,
    alpha: true,
    antialias: true,
    // The exporter reads the canvas after each render. Without this the
    // buffer may be cleared between the render and the read.
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 40);
  // The camera distance that makes VIEW_HEIGHT units fill the frame at z = 0.
  camera.position.z = VIEW_HEIGHT / 2 / Math.tan((camera.fov * Math.PI) / 360);

  const uniforms = {
    uTime: { value: 0 },
    uEnergy: { value: 0 },
    uBurst: { value: 0 },
    uEnter: { value: 0 },
    uAspect: { value: 1 },
    uPixelHeight: { value: options.height },
    uFg: { value: new THREE.Color(color.fg) },
    uAccent: { value: new THREE.Color(color.accent) },
  };

  const facets = new THREE.Mesh(
    facetGeometry(),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: FACET_VERTEX,
      fragmentShader: FACET_FRAGMENT,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    }),
  );
  facets.frustumCulled = false;

  const sparks = new THREE.Points(
    sparkGeometry(),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: SPARK_VERTEX,
      fragmentShader: SPARK_FRAGMENT,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  sparks.frustumCulled = false;

  scene.add(facets, sparks);

  const resize = (width: number, height: number) => {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    uniforms.uAspect.value = camera.aspect;
    uniforms.uPixelHeight.value = height;
  };
  resize(options.width, options.height);

  return {
    render(state) {
      uniforms.uTime.value = state.time;
      uniforms.uEnergy.value = state.energy;
      uniforms.uBurst.value = state.burst;
      uniforms.uEnter.value = state.enter;
      // A slow drift of the eye, so even a held card is not a still.
      camera.position.x = Math.sin(state.time * 0.11) * 0.25;
      camera.position.y = Math.cos(state.time * 0.09) * 0.15;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    },
    resize,
    dispose() {
      facets.geometry.dispose();
      facets.material.dispose();
      sparks.geometry.dispose();
      sparks.material.dispose();
      renderer.dispose();
    },
  };
}
