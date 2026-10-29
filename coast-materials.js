/* coast-materials.js · Agua y arena estilizadas (GPU) · KLO-49 */
import * as THREE from './lib/three.module.js';
import { SHORE_WORLD_Z, coastPalette } from './coast-palette.js?v=28.16.1-vfx3d';

export { SHORE_WORLD_Z };

export function getCoastGeometryProfile() {
  const coarse =
    typeof navigator !== 'undefined' &&
    (/Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent) ||
      ((navigator.maxTouchPoints || 0) > 1 && typeof window !== 'undefined' && window.innerWidth < 920));
  return {
    coarse,
    sandSegments: coarse ? [24, 16] : [48, 32],
    waterSegments: coarse ? [26, 13] : [52, 26],
    pixelRatioCap: coarse ? 1.5 : 2
  };
}

const WATER_VERT = /* glsl */ `
uniform float uTime;
uniform float uWind;
varying vec3 vWorldPos;
varying vec3 vNormalW;
varying vec2 vUv;

void main() {
  vUv = uv;
  vec3 pos = position;
  float t = uTime;
  float w = uWind;
  pos.y += sin(pos.x * 0.35 + t * 1.8 * w) * 0.16;
  pos.y += cos(pos.z * 0.28 + t * 1.4 * w) * 0.11;
  pos.y += sin(pos.x * 0.12 + pos.z * 0.15 + t * 2.05 * w) * 0.07 * w;

  vec4 wp = modelMatrix * vec4(pos, 1.0);
  vWorldPos = wp.xyz;

  float dx = cos(pos.x * 0.35 + t * 1.8 * w) * 0.35 * 0.16 * w;
  float dz = -sin(pos.z * 0.28 + t * 1.4 * w) * 0.28 * 0.11;
  vec3 n = normalize(vec3(-dx, 1.0, -dz));
  vNormalW = normalize(mat3(modelMatrix) * n);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const WATER_FRAG = /* glsl */ `
uniform float uTime;
uniform float uWind;
uniform float uNightness;
uniform float uSunSpec;
uniform float uShoreZ;
uniform vec3 uShallow;
uniform vec3 uDeep;
uniform vec3 uSunDir;

varying vec3 vWorldPos;
varying vec3 vNormalW;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

void main() {
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  vec3 n = normalize(vNormalW + vec3(noise(vWorldPos.xz * 0.35 + uTime * 0.15) - 0.5, 0.0, noise(vWorldPos.xz * 0.28 - uTime * 0.12) - 0.5) * 0.08);

  float depthT = smoothstep(-32.0, -5.5, vWorldPos.z);
  vec3 waterCol = mix(uDeep, uShallow, depthT);

  float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 2.8);
  waterCol = mix(waterCol, vec3(0.55, 0.82, 0.92), fresnel * (0.35 + uNightness * 0.2));

  float shoreDist = abs(vWorldPos.z - uShoreZ);
  float foamBase = 1.0 - smoothstep(0.0, 2.8, shoreDist);
  float foamNoise = noise(vec2(vWorldPos.x * 0.08 + uTime * 0.9 * uWind, vWorldPos.z * 0.2 + uTime * 0.6));
  float foam = foamBase * (0.55 + 0.45 * foamNoise) * (1.0 - uNightness * 0.35);
  foam *= 0.85 + 0.15 * sin(uTime * 1.8 * uWind + vWorldPos.x * 0.2);

  if (uSunSpec > 0.02) {
    vec3 halfV = normalize(viewDir + uSunDir);
    float spec = pow(max(dot(n, halfV), 0.0), 48.0) * uSunSpec;
    waterCol += vec3(1.0, 0.78, 0.45) * spec * 0.9;
    float streak = exp(-abs(vWorldPos.x * 0.04) * 0.35) * uSunSpec * 0.25;
    waterCol += vec3(1.0, 0.82, 0.55) * streak * smoothstep(-8.0, -2.0, vWorldPos.z);
  }

  waterCol = mix(waterCol, vec3(1.0), foam);
  float alpha = 0.82 + fresnel * 0.12;
  gl_FragColor = vec4(waterCol, alpha);
}
`;

export function createWaterMaterial() {
  const shallow = new THREE.Color(0x2ec2c4);
  const deep = new THREE.Color(0x1f8fb0);
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uWind: { value: 1 },
      uNightness: { value: 0 },
      uSunSpec: { value: 0 },
      uShoreZ: { value: SHORE_WORLD_Z },
      uShallow: { value: shallow },
      uDeep: { value: deep },
      uSunDir: { value: new THREE.Vector3(0.4, 0.65, 0.55).normalize() }
    },
    vertexShader: WATER_VERT,
    fragmentShader: WATER_FRAG,
    transparent: true,
    depthWrite: true
  });
}

export function createSandMaterial() {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xedd8a6,
    roughness: 0.92,
    metalness: 0.02
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uShoreDistScale = { value: 1 };
    shader.uniforms.uSandDry = { value: new THREE.Color(0xedd8a6) };
    shader.uniforms.uSandWet = { value: new THREE.Color(0x0f8b8d) };
    shader.uniforms.uNightness = { value: 0 };

    shader.vertexShader = `
attribute float shoreDist;
varying float vShoreDist;
varying vec2 vSandXZ;
${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
vShoreDist = shoreDist;
vSandXZ = (modelMatrix * vec4(transformed, 1.0)).xz;`
    );

    shader.fragmentShader = `
uniform float uTime;
uniform float uShoreDistScale;
uniform vec3 uSandDry;
uniform vec3 uSandWet;
uniform float uNightness;
varying float vShoreDist;
varying vec2 vSandXZ;

float sandHash(vec2 p) {
  return fract(sin(dot(p, vec2(41.7, 289.1))) * 45758.5453);
}

${shader.fragmentShader}`.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
float wet = 1.0 - smoothstep(-7.0, 2.5, vShoreDist);
wet *= 1.0 - uNightness * 0.25;
vec3 grain = vec3(sandHash(vSandXZ * 120.0) * 0.04 - 0.02);
vec3 dryCol = uSandDry + grain;
vec3 wetCol = uSandWet + grain * 0.5;
float caust = wet * (0.08 + 0.06 * sin(vSandXZ.x * 6.0 + uTime * 1.3) * sin(vSandXZ.y * 5.0 - uTime * 1.1));
wetCol += vec3(0.15, 0.35, 0.32) * caust;
diffuseColor.rgb = mix(dryCol, wetCol, wet);`
    );

    mat.userData.coastUniforms = {
      uTime: shader.uniforms.uTime,
      uNightness: shader.uniforms.uNightness,
      uSandDry: shader.uniforms.uSandDry,
      uSandWet: shader.uniforms.uSandWet
    };
  };

  mat.customProgramCacheKey = () => 'coastSand_v1';
  return mat;
}

/** Escribe atributo shoreDist (worldZ - SHORE_WORLD_Z) tras displazar arena */
export function applySandShoreAttribute(sandGeo, meshWorldZ = 0) {
  const pos = sandGeo.attributes.position;
  const shoreDist = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const worldZ = meshWorldZ + pos.getZ(i);
    shoreDist[i] = worldZ - SHORE_WORLD_Z;
  }
  sandGeo.setAttribute('shoreDist', new THREE.BufferAttribute(shoreDist, 1));
}

export function buildCoastMeshes(scene, profile = getCoastGeometryProfile()) {
  const [sw, sh] = profile.sandSegments;
  const [ww, wh] = profile.waterSegments;

  const sandGeo = new THREE.PlaneGeometry(80, 50, sw, sh);
  sandGeo.rotateX(-Math.PI / 2);
  const pos = sandGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    let y = (z + 10) * 0.045;
    y += Math.sin(x * 0.12) * Math.cos(z * 0.1) * 0.35;
    pos.setY(i, y);
  }
  sandGeo.computeVertexNormals();
  applySandShoreAttribute(sandGeo, 0);

  const sandMat = createSandMaterial();
  const sandMesh = new THREE.Mesh(sandGeo, sandMat);
  sandMesh.receiveShadow = true;
  sandMesh.position.set(0, -0.2, 0);
  scene.add(sandMesh);

  const waterGeo = new THREE.PlaneGeometry(80, 36, ww, wh);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = createWaterMaterial();
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.set(0, -0.05, -16);
  waterMesh.receiveShadow = false;
  scene.add(waterMesh);

  return { sandMesh, waterMesh, sandMat, waterMat, profile };
}

export function updateCoastMaterials(waterMat, sandMat, { time, h, windFactor, sunLight }) {
  if (!waterMat || !sandMat) return;
  const nt = Math.max(0, Math.min(0.75, (h - 19.8) / 2));
  const pal = coastPalette(h, nt, windFactor);

  waterMat.uniforms.uTime.value = time;
  waterMat.uniforms.uWind.value = pal.wind;
  waterMat.uniforms.uNightness.value = nt;
  waterMat.uniforms.uSunSpec.value = pal.sunSpec;
  waterMat.uniforms.uShallow.value.setRGB(pal.shallow.r, pal.shallow.g, pal.shallow.b);
  waterMat.uniforms.uDeep.value.setRGB(pal.deep.r, pal.deep.g, pal.deep.b);

  if (sunLight) {
    const sd = sunLight.position.clone().normalize();
    waterMat.uniforms.uSunDir.value.copy(sd);
  }

  const su = sandMat.userData.coastUniforms;
  if (su) {
    su.uTime.value = time;
    su.uNightness.value = nt;
    su.uSandDry.value.setRGB(pal.sandDry.r, pal.sandDry.g, pal.sandDry.b);
    su.uSandWet.value.setRGB(pal.sandWet.r, pal.sandWet.g, pal.sandWet.b);
  }
}
