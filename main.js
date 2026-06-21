import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { Sky } from "three/examples/jsm/Addons.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { createNoise2D } from "simplex-noise";
import { svModels } from "./sv-models.js";

import {
  introSheet,
  endSheet,
  introCamera,
  endCamera,
  applyTheatreCamera,
  playIntroSequence,
  playEndSequence,
  theatreProject,
} from "./theatre-camera.js";

// Camera
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

const itemDefaultPos = { x: 0, y: 0, z: 0 };
const defaultZoomPos = { x: 0, y: -2.7, z: 0 };
const defaultZoomScale = 1.4;

const transDist = 60;
const transDur = 1000;

const zoomClosestZ = 0.8;
const zoomFarthestZ = 15;
const zoomInThresholdZ = 1.5;
const zoomOutThresholdZ = 1.9;
const zoomReturnZ = 2;
const wheelZoomSpeed = 0.008;

const rotateSpeed = 0.006;
const autoRotate = 0.002;
const cameraSmooth = 0.04;
const itemSmooth = 0.05;
const wireSmooth = 0.07;
const wireColor = 0x5a4228;
const hScrollMax = 100;

// Sound
const soundButton = document.getElementById("sound-off");
const ambientSound = new Audio(
  `${import.meta.env.BASE_URL}sounds/ambiance.mp3`,
);
ambientSound.loop = true;
ambientSound.volume = 0.05;

const swipeSound = new Audio(`${import.meta.env.BASE_URL}sounds/swipe.mp3`);
swipeSound.volume = 0.3;

let soundOn = true;

function updateSoundButton() {
  if (!soundButton) return;
  soundButton.innerHTML = soundOn
    ? '<i class="fa-solid fa-volume-high"></i>'
    : '<i class="fa-solid fa-volume-xmark"></i>';
}

function playAmbient() {
  if (!soundOn) return;
  ambientSound.play().catch(() => {});
}

function playSwipeSound() {
  if (!soundOn) return;
  swipeSound.currentTime = 0;
  swipeSound.play().catch(() => {});
}

if (soundButton) {
  updateSoundButton();
  soundButton.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    soundOn = !soundOn;
    soundOn ? playAmbient() : ambientSound.pause();
    updateSoundButton();
  });
}

// Renderer & Scene
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.toneMappingExposure = 0.7;

const viewer = document.getElementById("viewer");
viewer.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
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

scene.add(new THREE.AmbientLight(0xffe0b0, 3));
const sunLight = new THREE.DirectionalLight(0xffc98a, 7);
const sun = new THREE.Vector3();
sun.setFromSphericalCoords(
  1,
  THREE.MathUtils.degToRad(82),
  THREE.MathUtils.degToRad(120),
);
sunLight.position.copy(sun).multiplyScalar(10);
scene.add(sunLight);

const sky = new Sky();
sky.scale.setScalar(1000);
scene.add(sky);
const skyU = sky.material.uniforms;
skyU["turbidity"].value = 18.3;
skyU["rayleigh"].value = 0.8;
skyU["mieCoefficient"].value = 0.043;
skyU["mieDirectionalG"].value = 0;
skyU["sunPosition"].value.copy(sun);

// Ground
const noise2D = createNoise2D(() => 0.8);
const groundGeo = new THREE.PlaneGeometry(150, 150, 120, 120);
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

// Loading
const progressBar = document.getElementById("progress-bar");
const loadingScreen = document.getElementById("loading-screen");
const introOverlay = document.getElementById("intro-overlay");
const introEnter = document.getElementById("intro-enter");
const loadingManager = new THREE.LoadingManager();

loadingManager.onStart = () => {
  if (progressBar) progressBar.style.width = "0%";
  if (loadingScreen) loadingScreen.style.display = "flex";
};

loadingManager.onProgress = (url, loaded, total) => {
  if (progressBar && total)
    progressBar.style.width = (loaded / total) * 100 + "%";
};

loadingManager.onLoad = async () => {
  if (!loadingScreen) return;
  loadingScreen.style.transition = "opacity 0.6s ease";
  loadingScreen.style.opacity = "0";

  await theatreProject.ready;
  introSheet.sequence.position = 0;

  applyTheatreCamera(introCamera.value, {
    camera,
    setTargets: (x, y, z) => {
      camTargetX = x;
      camTargetY = y;
      camTargetZ = z;
    },
    setLook: (x, y, z) => {
      lookTargetX = x;
      lookTargetY = y;
      lookTargetZ = z;
      currentLookX = x;
      currentLookY = y;
      currentLookZ = z;
    },
  });

  setTimeout(() => {
    loadingScreen.style.display = "none";
    if (introOverlay) {
      introOverlay.style.transition = "opacity 0.6s ease";
      introOverlay.style.opacity = "1";
    }
  }, 600);
};

// Loaders
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("/draco/");

const gltfLoader = new GLTFLoader(loadingManager);
gltfLoader.setDRACOLoader(dracoLoader);
gltfLoader.setMeshoptDecoder(MeshoptDecoder);

const textureLoader = new THREE.TextureLoader(loadingManager);

const repeat = (tex) => {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(25, 25);
};

const sandColor = textureLoader.load(
  "models/textures/Ground079L_2K-PNG_Color.png",
);
const sandNormal = textureLoader.load(
  "models/textures/Ground079L_2K-PNG_NormalGL.png",
);
const sandRoughness = textureLoader.load(
  "models/textures/Ground079L_2K-PNG_Roughness.png",
);
const sandAO = textureLoader.load(
  "models/textures/Ground079L_2K-PNG_AmbientOcclusion.png",
);
const sandDisplace = textureLoader.load(
  "models/textures/Ground079L_2K-PNG_Displacement.png",
);

[sandColor, sandNormal, sandRoughness, sandAO, sandDisplace].forEach(repeat);

const ground = new THREE.Mesh(
  groundGeo,
  new THREE.MeshStandardMaterial({
    map: sandColor,
    normalMap: sandNormal,
    roughnessMap: sandRoughness,
    aoMap: sandAO,
    displacementMap: sandDisplace,
    displacementScale: 1,
    roughness: 6,
  }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = 4;
scene.add(ground);

scene.fog = new THREE.FogExp2(0xcccccc, 0.012);
scene.background = new THREE.Color(0xcccccc);

gltfLoader.load("models/Moutains2.glb", (gltf) => {
  const m = gltf.scene;
  m.position.set(-0.8, -5.22, -34.06);
  m.scale.setScalar(9.84);
  m.rotation.y = -0.536;
  scene.add(m);
});

// State
const allModels = svModels;
const showcaseItems = [];

let currentItem = 0;
let transition = null;
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;
let hScroll = 0;
let scrollZ = 0;
let isZoomed = false;

let camTargetX = camDefault.x;
let camTargetY = camDefault.y;
let camTargetZ = camDefault.z;

let lookTargetX = camDefault.lookX;
let lookTargetY = camDefault.lookY;
let lookTargetZ = camDefault.lookZ;
let currentLookX = camDefault.lookX;
let currentLookY = camDefault.lookY;
let currentLookZ = camDefault.lookZ;

const seenItems = new Set();
let endScenePlayed = false;
let introWaiting = true;
let creditsOpen = false;
let theatreMode = "normal";

function controlsLocked() {
  return theatreMode !== "normal";
}

// DOM
const infoPanel = document.getElementById("info-panel");
const infoName = document.getElementById("info-name");
const infoPoetic = document.getElementById("info-poetic");
const infoContributor = document.getElementById("info-contributor");
const infoPlaceYear = document.getElementById("info-place-year");
const vignette = document.getElementById("vignette");
const topBar = document.getElementById("top-bar");
const bottomBar = document.getElementById("bottom-bar");
const cardNum = document.getElementById("card-number");
const returnBtn = document.getElementById("return-to-collection");
const creditsBtn = document.getElementById("credits-btn");
const creditsOverlay = document.getElementById("credits-overlay");

bottomBar.style.display = "none";
if (infoPanel) infoPanel.classList.add("hidden");
function setTargets(x, y, z) {
  camTargetX = x;
  camTargetY = y;
  camTargetZ = z;
}
function setLook(x, y, z) {
  lookTargetX = x;
  lookTargetY = y;
  lookTargetZ = z;
  currentLookX = x;
  currentLookY = y;
  currentLookZ = z;
}
const theatreCtx = { camera, setTargets, setLook };

introCamera.onValuesChange((v) => applyTheatreCamera(v, theatreCtx));

endCamera.onValuesChange((v) => {
  if (theatreMode !== "end") return;

  camTargetX = v.x;
  camTargetY = v.y;
  camTargetZ = v.z;

  lookTargetX = v.lookX;
  lookTargetY = v.lookY;
  lookTargetZ = v.lookZ;

  camera.fov = v.fov;
  camera.updateProjectionMatrix();
});

function setupWireframe(object) {
  object.traverse((child) => {
    if (!child.isMesh) return;
    const mat = child.material;
    (Array.isArray(mat) ? mat : [mat]).forEach((m) => {
      m.transparent = false;
      m.opacity = 1;
      m.depthWrite = true;
    });
    const wire = new THREE.LineSegments(
      new THREE.WireframeGeometry(child.geometry),
      new THREE.LineBasicMaterial({
        color: wireColor,
        transparent: true,
        opacity: 0,
      }),
    );
    wire.visible = false;
    wire.userData.isWireframeOverlay = true;
    wire.renderOrder = 10;
    child.add(wire);
    child.userData.wireMesh = wire;
  });
}

const wireStart = 0.2;
const wireEnd = 1;

function updateWireframe(group) {
  const target = group.userData.wireframeTarget || 0;
  group.userData.wireframeAmount +=
    (target - group.userData.wireframeAmount) * wireSmooth;

  const amount = group.userData.wireframeAmount;
  const fadeProgress = Math.max(
    0,
    (amount - wireStart) / (wireEnd - wireStart),
  );
  const texOpacity = Math.max(0, 1 - fadeProgress);

  group.traverse((child) => {
    if (!child.isMesh || child.userData.isWireframeOverlay) return;
    const active = amount > 0.01 || target > 0.01;
    (Array.isArray(child.material) ? child.material : [child.material]).forEach(
      (m) => {
        if (m.transparent !== active) {
          m.transparent = active;
          m.needsUpdate = true;
        }
        m.depthWrite = true;
        m.opacity = active ? texOpacity : 1;
      },
    );
    if (child.userData.wireMesh) {
      child.userData.wireMesh.visible = active;
      child.userData.wireMesh.material.opacity = amount;
    }
  });
}

// Item helpers
function getBrowsePos(item) {
  return {
    x: item.userData.browseX ?? itemDefaultPos.x,
    y: item.userData.browseY ?? itemDefaultPos.y,
    z: item.userData.browseZ ?? itemDefaultPos.z,
  };
}

function getZoomPos(item) {
  return {
    x: item.userData.zoomX ?? defaultZoomPos.x,
    y: item.userData.zoomY ?? defaultZoomPos.y,
    z: item.userData.zoomZ ?? defaultZoomPos.z,
  };
}

function setItemTargets(item, pos, wireframeTarget, scaleTarget) {
  item.userData.targetX = pos.x;
  item.userData.targetY = pos.y;
  item.userData.targetZ = pos.z;
  item.userData.wireframeTarget = wireframeTarget;
  item.userData.targetScale = scaleTarget;
}

function resetItem(item) {
  const pos = getBrowsePos(item);
  item.position.set(pos.x, pos.y, pos.z);
  setItemTargets(item, pos, 0, 1);
  item.userData.wireframeAmount = 0;
  item.userData.currentScale = 1;
  item.scale.setScalar(1);
  item.userData.targetRotationY = item.rotation.y;
}

function makeGroup(model, config) {
  setupWireframe(model);
  const group = new THREE.Group();
  group.userData.browseX = config.x ?? itemDefaultPos.x;
  group.userData.browseY = config.y ?? itemDefaultPos.y;
  group.userData.browseZ = config.z ?? itemDefaultPos.z;
  group.userData.zoomX = config.zoomX ?? defaultZoomPos.x;
  group.userData.zoomY = config.zoomY ?? defaultZoomPos.y;
  group.userData.zoomZ = config.zoomZ ?? defaultZoomPos.z;
  group.userData.zoomScale = config.zoomScale ?? defaultZoomScale;
  group.add(model);
  group.visible = false;
  resetItem(group);
  scene.add(group);
  return group;
}

// Camera helpers
function resetCamera() {
  isZoomed = false;
  scrollZ = 0;
  camTargetX = camDefault.x;
  camTargetY = camDefault.y;
  camTargetZ = camDefault.z;
  lookTargetX = camDefault.lookX;
  lookTargetY = camDefault.lookY;
  lookTargetZ = camDefault.lookZ;
  camera.fov = 42;
  camera.updateProjectionMatrix();
  if (vignette) vignette.style.opacity = "0";
}

function triggerZoom(item) {
  if (controlsLocked()) return;
  isZoomed = true;
  scrollZ = zoomInThresholdZ - camDefault.z;
  item.userData.targetRotationY = item.rotation.y;
  setItemTargets(item, getZoomPos(item), 1, item.userData.zoomScale);
  camTargetX = camZoomed.x;
  camTargetY = camZoomed.y;
  camTargetZ = camZoomed.z;
  lookTargetX = camZoomed.lookX;
  lookTargetY = camZoomed.lookY;
  lookTargetZ = camZoomed.lookZ;
  if (vignette) vignette.style.opacity = "1";
  if (creditsBtn) creditsBtn.classList.add("hidden");
}

function triggerUnzoom(item) {
  if (controlsLocked()) return;
  isZoomed = false;
  setItemTargets(item, getBrowsePos(item), 0, 1);
  camTargetX = camDefault.x;
  camTargetY = camDefault.y;
  camTargetZ = zoomReturnZ;
  lookTargetX = camDefault.lookX;
  lookTargetY = camDefault.lookY;
  lookTargetZ = camDefault.lookZ;
  scrollZ = zoomReturnZ - camDefault.z;
  if (vignette) vignette.style.opacity = "0";
  if (creditsBtn) creditsBtn.classList.remove("hidden");
}

// Item showcase
function showItem(index) {
  resetCamera();
  showcaseItems.forEach((item, slot) => {
    if (!item) return;
    item.visible = slot === index;
    resetItem(item);
    updateWireframe(item);
  });
  currentItem = index;
  seenItems.add(index);
  if (infoPanel) infoPanel.classList.add("hidden");
  const data = allModels[index];
  if (!data) return;
  if (infoName) infoName.textContent = data.name || "";
  if (infoPoetic) infoPoetic.textContent = data.poetic || "";
  if (cardNum) cardNum.textContent = data.cardNum || "2300";
  if (infoContributor) infoContributor.textContent = data.details?.[0] || "";
  if (infoPlaceYear) infoPlaceYear.textContent = data.details?.[1] || "";
}

let lastSwipeTime = 0;
const swipeCooldown = 900;

function goToItem(nextIndex, direction) {
  if (transition || nextIndex === currentItem || controlsLocked()) return;
  const allSeen = seenItems.size >= allModels.length;
  const wrappingAround = direction === 1 && nextIndex === 0;
  if (wrappingAround && allSeen && !endScenePlayed) {
    setTimeout(() => showJourneyComplete(), 1000);
    endScenePlayed = true;
  }
  const from = showcaseItems[currentItem];
  const to = showcaseItems[nextIndex];
  if (!from || !to) return;
  playSwipeSound();
  resetCamera();
  setItemTargets(from, getBrowsePos(from), 0, 1);
  resetItem(to);
  if (infoPanel) infoPanel.classList.add("hidden");
  const toPos = getBrowsePos(to);
  to.visible = true;
  to.position.set(toPos.x + transDist * direction, toPos.y, toPos.z);
  transition = {
    from,
    to,
    start: performance.now(),
    duration: transDur,
    nextItem: nextIndex,
    direction,
  };
}

// Input
renderer.domElement.addEventListener("pointerdown", (e) => {
  if (controlsLocked()) return;
  isDragging = true;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
});

window.addEventListener("pointerup", () => {
  isDragging = false;
});

window.addEventListener("pointermove", (e) => {
  if (!isDragging || transition || controlsLocked()) return;
  const dx = e.clientX - lastMouseX;
  const dy = e.clientY - lastMouseY;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
  const item = showcaseItems[currentItem];
  if (!item) return;
  item.rotation.y += dx * rotateSpeed;
  item.rotation.x += dy * rotateSpeed;
  item.userData.targetRotationY = item.rotation.y;
});

window.addEventListener("keydown", (e) => {
  if (controlsLocked()) return;
  if (e.key === "ArrowRight") {
    const next = (currentItem + 1) % allModels.length;
    if (showcaseItems[next]) goToItem(next, 1);
  }
  if (e.key === "ArrowLeft") {
    const prev = (currentItem - 1 + allModels.length) % allModels.length;
    if (showcaseItems[prev]) goToItem(prev, -1);
  }
});

window.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    if (controlsLocked() || creditsOpen) return;

    const switchDelta = e.shiftKey ? e.deltaY : e.deltaX;
    const isSwitchScroll =
      e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY);

    if (isSwitchScroll) {
      if (isZoomed || transition) return;
      const now = performance.now();
      if (now - lastSwipeTime < swipeCooldown) {
        hScroll = 0;
        return;
      }
      hScroll += switchDelta;
      if (Math.abs(hScroll) > hScrollMax) {
        const direction = hScroll > 0 ? 1 : -1;
        hScroll = 0;
        lastSwipeTime = now;
        const next =
          (currentItem + direction + allModels.length) % allModels.length;
        if (showcaseItems[next]) goToItem(next, direction);
      }
      return;
    }

    const item = showcaseItems[currentItem];
    if (!item || transition || controlsLocked()) return;

    scrollZ = THREE.MathUtils.clamp(
      scrollZ + e.deltaY * wheelZoomSpeed,
      zoomClosestZ - camDefault.z,
      zoomFarthestZ - camDefault.z,
    );
    const targetZ = camDefault.z + scrollZ;
    if (!isZoomed && targetZ <= zoomInThresholdZ) triggerZoom(item);
    else if (isZoomed && targetZ >= zoomOutThresholdZ) triggerUnzoom(item);
    else if (!isZoomed) camTargetZ = targetZ;
  },
  { passive: false },
);

const nextButton = document.getElementById("next-btn");
const backButton = document.getElementById("prev-btn");

if (nextButton) {
  nextButton.addEventListener("click", () => {
    if (controlsLocked()) return;
    const next = (currentItem + 1) % allModels.length;
    if (showcaseItems[next]) goToItem(next, 1);
  });
}

if (backButton) {
  backButton.addEventListener("click", () => {
    if (controlsLocked()) return;
    const prev = (currentItem - 1 + allModels.length) % allModels.length;
    if (showcaseItems[prev]) goToItem(prev, -1);
  });
}

if (creditsBtn) {
  creditsBtn.addEventListener("click", () => {
    if (introOverlay) introOverlay.classList.add("hidden");
    if (bottomBar) bottomBar.classList.add("hidden");
    if (controlsLocked()) return;
    playCreditsScene();
  });
}

const journeyComplete = document.getElementById("journey-complete");
const viewCreditsBtn = document.getElementById("view-credits");
const continueBrowsingBtn = document.getElementById("continue-browsing");
const journeyBackdrop = document.getElementById("journey-backdrop");

function showJourneyComplete() {
  if (!journeyComplete) return;
  journeyComplete.classList.remove("hidden");
  if (journeyBackdrop) journeyBackdrop.classList.add("active");
}

function hideJourneyComplete() {
  if (!journeyComplete) return;
  journeyComplete.classList.add("hidden");
  if (journeyBackdrop) journeyBackdrop.classList.remove("active");
}

if (viewCreditsBtn)
  viewCreditsBtn.addEventListener("click", () => {
    hideJourneyComplete();
    playEndScene();
  });
if (continueBrowsingBtn)
  continueBrowsingBtn.addEventListener("click", () => {
    hideJourneyComplete();
    endScenePlayed = true;
  });

async function playIntro() {
  if (controlsLocked()) return;
  theatreMode = "intro";
  if (infoPanel) infoPanel.classList.add("hidden");
  await playIntroSequence();
  theatreMode = "normal";
  resetCamera();
}

async function playEndScene() {
  if (controlsLocked()) return;
  resetCamera();
  theatreMode = "end";
  endScenePlayed = true;
  if (infoPanel) infoPanel.classList.add("hidden");
  showCredits();
  await playEndSequence();
  theatreMode = creditsOpen ? "credits" : "normal";
}

async function playCreditsScene() {
  if (controlsLocked()) return;

  creditsOpen = true;

  if (topBar)     topBar.classList.add("hidden");
  if (bottomBar)  bottomBar.style.display = "none";
  if (vignette)   vignette.style.opacity  = "0";
  if (creditsBtn) creditsBtn.classList.add("hidden");

  theatreMode = "end";

  if (infoPanel) infoPanel.classList.add("hidden");

  showCredits();
  await playEndSequence();

  if (creditsOpen) theatreMode = "credits";
}

let creditsReturnTimer = null;

function showCredits() {
  if (!creditsOverlay) return;
  creditsOpen = true;
  clearTimeout(creditsReturnTimer);
  creditsOverlay.classList.remove("hidden", "rolling", "finished");
  const creditsContent = creditsOverlay.querySelector(".credits-content");
  if (creditsContent) {
    creditsContent.style.animation = "none";
    void creditsContent.offsetHeight;
    creditsContent.style.animation = "";
  }
  void creditsOverlay.offsetWidth;
  creditsOverlay.classList.add("rolling");
  creditsReturnTimer = setTimeout(showReturnButton, 3000);
}

if (creditsOverlay) {
  creditsOverlay.addEventListener("animationend", (e) => {
    if (e.animationName !== "creditsRoll") return;
    if (!e.target.classList.contains("credits-content")) return;
    creditsOverlay.classList.add("finished");
    theatreMode = "credits";
  });
}

function showReturnButton() {
  if (returnBtn) returnBtn.classList.remove("hidden");
}

function returnToCollection() {
  clearTimeout(creditsReturnTimer);
  creditsOpen = false;
  theatreMode = "normal";
  endSheet.sequence.pause();
  endSheet.sequence.position = 0;
  if (creditsOverlay) {
    creditsOverlay.classList.add("hidden");
    creditsOverlay.classList.remove("rolling", "finished");
  }
  if (returnBtn) returnBtn.classList.add("hidden");
  if (topBar) topBar.classList.remove("hidden");
  if (bottomBar) {
    bottomBar.classList.remove("hidden");
    bottomBar.style.display = "flex";
  }
  if (creditsBtn) creditsBtn.classList.remove("hidden");
  if (vignette) vignette.style.opacity = "0";
  resetCamera();
}

if (returnBtn) returnBtn.addEventListener("click", returnToCollection);

if (introEnter) {
  introEnter.addEventListener("click", () => {
    playAmbient();
    introWaiting = false;
    bottomBar.style.display = "flex";

    const v = introCamera.value;
    camera.position.set(v.x, v.y, v.z);
    camTargetX = v.x;
    camTargetY = v.y;
    camTargetZ = v.z;
    currentLookX = v.lookX;
    currentLookY = v.lookY;
    currentLookZ = v.lookZ;
    lookTargetX = v.lookX;
    lookTargetY = v.lookY;
    lookTargetZ = v.lookZ;

    theatreMode = "normal";
    playIntro();

    introOverlay.classList.add("hidden");
    setTimeout(() => {
      introOverlay.style.display = "none";
    }, 300);
  });
}

// Load models
allModels.forEach((config, index) => {
  gltfLoader.load(config.path, (gltf) => {
    const model = gltf.scene;
    model.scale.setScalar(config.scale ?? 1);
    model.rotation.y = config.rotation ?? Math.PI / 4;
    model.position.set(0, 0, 0);
    const group = makeGroup(model, config);
    showcaseItems[index] = group;
    if (index === 0) showItem(0);
  });
});

// Animation loop
renderer.setAnimationLoop(() => {
  if (transition) {
    const progress = Math.min(
      (performance.now() - transition.start) / transition.duration,
      1,
    );
    const fromPos = getBrowsePos(transition.from);
    const toPos = getBrowsePos(transition.to);

    transition.from.position.x =
      fromPos.x - transDist * transition.direction * progress;
    transition.to.position.x =
      toPos.x + transDist * transition.direction * (1 - progress);
    transition.from.position.y = fromPos.y;
    transition.from.position.z = fromPos.z;
    transition.to.position.y = toPos.y;
    transition.to.position.z = toPos.z;

    if (progress === 1) {
      transition.from.visible = false;
      resetItem(transition.from);
      resetItem(transition.to);
      const next = transition.nextItem;
      transition = null;
      showItem(next);
    }
  }

  const item = showcaseItems[currentItem];
  if (item && !transition && !isDragging && !controlsLocked()) {
    item.userData.targetRotationY =
      (item.userData.targetRotationY ?? item.rotation.y) + autoRotate;
  }

  if (item) {
    item.position.x +=
      ((item.userData.targetX ?? 0) - item.position.x) * itemSmooth;
    item.position.y +=
      ((item.userData.targetY ?? 0) - item.position.y) * itemSmooth;
    item.position.z +=
      ((item.userData.targetZ ?? 0) - item.position.z) * itemSmooth;
    item.userData.currentScale +=
      (item.userData.targetScale - item.userData.currentScale) * itemSmooth;
    item.scale.setScalar(item.userData.currentScale);
    if (item.userData.targetRotationY !== undefined) {
      item.rotation.y +=
        (item.userData.targetRotationY - item.rotation.y) * itemSmooth;
    }
    updateWireframe(item);
  }

  if (!introWaiting) {
    camera.position.x += (camTargetX - camera.position.x) * cameraSmooth;
    camera.position.y += (camTargetY - camera.position.y) * cameraSmooth;
    camera.position.z += (camTargetZ - camera.position.z) * cameraSmooth;
    currentLookX += (lookTargetX - currentLookX) * cameraSmooth;
    currentLookY += (lookTargetY - currentLookY) * cameraSmooth;
    currentLookZ += (lookTargetZ - currentLookZ) * cameraSmooth;
    camera.lookAt(currentLookX, currentLookY, currentLookZ);
  }

  if (infoPanel) {
    infoPanel.classList.toggle("hidden", !isZoomed || controlsLocked());
  }

  renderer.render(scene, camera);
});
