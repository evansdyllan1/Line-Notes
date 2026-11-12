"use strict";

import * as THREE from "three";
import { Sky } from "three/examples/jsm/Addons.js";
import { createNoise2D } from "simplex-noise";
import { GUI } from "three/examples/jsm/libs/lil-gui.module.min.js";

export const camDefault = {
  x: 0.84,
  y: 11.09,
  z: 15,
  lookX: 0.85,
  lookY: 11.09,
  lookZ: 0.15,
};

export const camZoomed = {
  x: -0.43,
  y: 16.17,
  z: 2.37,
  lookX: 1.35,
  lookY: 15.87,
  lookZ: -1.37,
};

// Renderer & Scene
export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.toneMappingExposure = 0.6;

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const viewer = document.getElementById("viewer");
viewer.appendChild(renderer.domElement);

export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(
  42,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);

camera.position.set(camDefault.x, camDefault.y, camDefault.z);

function resizeRenderer() {
  const w = viewer.clientWidth;
  const h = viewer.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

window.addEventListener("resize", resizeRenderer);
resizeRenderer();

window.addEventListener("orientationchange", resizeRenderer);

if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", resizeRenderer);
}

scene.add(new THREE.AmbientLight(0xc8b5ae, 0.65));

const sunLight = new THREE.DirectionalLight(0xffb96b, 3.5);
const sun = new THREE.Vector3();

sun.setFromSphericalCoords(
  1,
  THREE.MathUtils.degToRad(82),
  THREE.MathUtils.degToRad(120),
);

sunLight.position.copy(sun).multiplyScalar(50);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.left = -30;
sunLight.shadow.camera.right = 30;
sunLight.shadow.camera.top = 30;
sunLight.shadow.camera.bottom = -30;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 150;
sunLight.shadow.bias = -0.0001;
sunLight.shadow.normalBias = 0.02;
sunLight.target.position.set(0, 6, 0);

scene.add(sunLight);
scene.add(sunLight.target);

const sky = new Sky();
sky.material.fragmentShader = sky.material.fragmentShader.replace(
  "// Clouds",
  `
  float sunsetBlend = smoothstep(0.0, 0.65, direction.y);

  vec3 sunsetColor = mix(
    vec3(0.85, 0.58, 0.47),
    vec3(0.43, 0.42, 0.49),
    sunsetBlend
  );

  texColor = mix(texColor, sunsetColor, 0.85);

  // Clouds
  `
);

sky.material.needsUpdate = true;

sky.scale.setScalar(1000);
scene.add(sky);

const skyU = sky.material.uniforms;

const sunSettings = {
  "turbidity": 10,
  "rayleigh": 0.509,
  "mieCoefficient": 0.04,
  "mieDirectionalG": 0.926,
  "elevation": 54.6,
  "azimuth": 29.5,
  "exposure": 0.84,
  "sunIntensity": 5.9,
  "sunColor": "#eec6a0",
  "cloudCoverage": 0.36,
  "cloudDensity": 0.79,
  "cloudElevation": 1,
  "cloudSpeed": 0.15,
  "showSunDisc": true
};

function updateSun() {
  skyU["turbidity"].value = sunSettings.turbidity;
  skyU["rayleigh"].value = sunSettings.rayleigh;
  skyU["mieCoefficient"].value = sunSettings.mieCoefficient;
  skyU["mieDirectionalG"].value = sunSettings.mieDirectionalG;

  if (skyU["cloudCoverage"]) {
    skyU["cloudCoverage"].value = sunSettings.cloudCoverage;
    skyU["cloudDensity"].value = sunSettings.cloudDensity;
    skyU["cloudElevation"].value = sunSettings.cloudElevation;
  }

  if (skyU["showSunDisc"]) {
    skyU["showSunDisc"].value = sunSettings.showSunDisc;
  }

  const phi = THREE.MathUtils.degToRad(90 - sunSettings.elevation);
  const theta = THREE.MathUtils.degToRad(sunSettings.azimuth);

  sun.setFromSphericalCoords(1, phi, theta);

  skyU["sunPosition"].value.copy(sun);

  sunLight.position.copy(sun).multiplyScalar(10);
  sunLight.intensity = sunSettings.sunIntensity;
  sunLight.color.set(sunSettings.sunColor);

  renderer.toneMappingExposure = sunSettings.exposure;
}
/* 
const sunGUI = new GUI({ title: "SUN & ATMOSPHERE" });

sunGUI.add(sunSettings, "turbidity", 0, 20, 0.1).onChange(updateSun);
sunGUI.add(sunSettings, "rayleigh", 0, 4, 0.001).onChange(updateSun);
sunGUI.add(sunSettings, "mieCoefficient", 0, 0.1, 0.001).onChange(updateSun);
sunGUI.add(sunSettings, "mieDirectionalG", 0, 1, 0.001).onChange(updateSun);

const sunPositionGUI = sunGUI.addFolder("SUN POSITION");

sunPositionGUI.add(sunSettings, "elevation", 0, 90, 0.1).onChange(updateSun);
sunPositionGUI.add(sunSettings, "azimuth", -180, 180, 0.1).onChange(updateSun);

const sunLightingGUI = sunGUI.addFolder("SUN LIGHTING");

sunLightingGUI.add(sunSettings, "sunIntensity", 0, 10, 0.1).onChange(updateSun);
sunLightingGUI.addColor(sunSettings, "sunColor").onChange(updateSun);
sunLightingGUI.add(sunSettings, "exposure", 0, 2, 0.01).onChange(updateSun);

if (skyU["cloudCoverage"]) {
  const cloudGUI = sunGUI.addFolder("SUNSET CLOUDS");

  cloudGUI
    .add(sunSettings, "cloudCoverage", 0, 1, 0.01)
    .name("Coverage")
    .onChange(updateSun);

  cloudGUI
    .add(sunSettings, "cloudDensity", 0, 1, 0.01)
    .name("Density")
    .onChange(updateSun);

  cloudGUI
    .add(sunSettings, "cloudElevation", 0, 1, 0.01)
    .name("Elevation")
    .onChange(updateSun);

  cloudGUI.add(sunSettings, "cloudSpeed", 0, 2, 0.01).name("Drift Speed");
}

if (skyU["showSunDisc"]) {
  sunGUI
    .add(sunSettings, "showSunDisc")
    .name("SHOW SUN DISC")
    .onChange(updateSun);
}

sunSettings.copySettings = () => {
  console.log(
    JSON.stringify(
      {
        turbidity: sunSettings.turbidity,
        rayleigh: sunSettings.rayleigh,
        mieCoefficient: sunSettings.mieCoefficient,
        mieDirectionalG: sunSettings.mieDirectionalG,
        elevation: sunSettings.elevation,
        azimuth: sunSettings.azimuth,
        exposure: sunSettings.exposure,
        sunIntensity: sunSettings.sunIntensity,
        sunColor: sunSettings.sunColor,
        cloudCoverage: sunSettings.cloudCoverage,
        cloudDensity: sunSettings.cloudDensity,
        cloudElevation: sunSettings.cloudElevation,
        cloudSpeed: sunSettings.cloudSpeed,
        showSunDisc: sunSettings.showSunDisc,
      },
      null,
      2,
    ),
  );
};

sunGUI.add(sunSettings, "copySettings").name("LOG SUN SETTINGS"); */

updateSun();

let cloudTime = 0;
let lastCloudTime = null;

export function updateSky(time) {
  if (!skyU["time"]) return;

  if (lastCloudTime !== null) {
    cloudTime +=
      Math.min((time - lastCloudTime) / 1000, 0.1) * sunSettings.cloudSpeed;
  }

  lastCloudTime = time;
  skyU["time"].value = cloudTime;
}

// Ground (decrease in mobile development)
const noise2D = createNoise2D(() => 0.8);
const groundGeo = new THREE.PlaneGeometry(200, 200, 180, 180);
const verts = groundGeo.attributes.position;

for (let i = 0; i < verts.count; i++) {
  const x = verts.getX(i);
  const z = verts.getY(i);

  const h =
    noise2D(x * 0.025, z * 0.025) * 0.9 +
    noise2D(x * 0.07, z * 0.07) * 0.5 +
    noise2D(x * 0.14, z * 0.14) * 0.4;

  verts.setZ(i, h);
}

verts.needsUpdate = true;
groundGeo.computeVertexNormals();

scene.fog = new THREE.FogExp2(0xb9a7a3, 0.004);
scene.background = new THREE.Color(0xb9a7a3);

export function loadSceneAssets(loadingManager, gltfLoader) {
  const textureLoader = new THREE.TextureLoader(loadingManager);

  const repeat = (tex) => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(25, 25);
  };

  const sandColor = textureLoader.load(
    "models/textures/Ground079L_2K-PNG_Color.png",
  );

  [sandColor].forEach(repeat);

  const ground = new THREE.Mesh(
    groundGeo,
    new THREE.MeshStandardMaterial({
      map: sandColor,
      roughness: 6,
    }),
  );

  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 6;
  ground.receiveShadow = true;

  scene.add(ground);

  gltfLoader.load("models/mountains3.glb", (gltf) => {
    const m = gltf.scene;

    m.position.set(-0.8, -5.22, -34.06);
    m.scale.setScalar(8.84);
    m.rotation.y = -0.536;

    m.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    scene.add(m);
  });
}
