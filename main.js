"use strict";

import * as THREE from "three";
import { initGui } from "./gui.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

import {
  renderer,
  scene,
  camera,
  camDefault,
  camZoomed,
  loadSceneAssets,
} from "./scene.js";

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

import {
  showcaseItems,
  allModels,
  currentItem,
  transition,
  modelLoading,
  getBrowsePos,
  getZoomPos,
  setItemTargets,
  goToItem,
  updateShowcaseTransition,
  updateShowcase,
  loadInitialItem,
  initShowcase,
  setEndScenePlayed,
} from "./repo.js";

let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;
let hScroll = 0;
let scrollZ = 0;
let isZoomed = false;
let introWaiting = true;
let creditsOpen = false;
let theatreMode = "normal";

let camTargetX = camDefault.x;
let camTargetY = camDefault.y;
let camTargetZ = camDefault.z;

let lookTargetX = camDefault.lookX;
let lookTargetY = camDefault.lookY;
let lookTargetZ = camDefault.lookZ;

let currentLookX = camDefault.lookX;
let currentLookY = camDefault.lookY;
let currentLookZ = camDefault.lookZ;

const ENABLE_GUI = true;
let updateGui = null;

function controlsLocked() {
  return theatreMode !== "normal" || modelLoading;
}

const infoPanel = document.getElementById("info-panel");
const vignette = document.getElementById("vignette");
const topBar = document.getElementById("top-bar");
const bottomBar = document.getElementById("bottom-bar");
const returnBtn = document.getElementById("return-to-collection");
const creditsBtn = document.getElementById("credits-btn");
const creditsOverlay = document.getElementById("credits-overlay");

bottomBar.style.display = "none";

if (infoPanel) infoPanel.classList.add("hidden");

const theatreCtx = {
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
};

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

// Camera
const zoomClosestZ = 0.8;
const zoomFarthestZ = 15;
const zoomInThresholdZ = 1.5;
const zoomOutThresholdZ = 1.9;
const zoomReturnZ = 2;
const wheelZoomSpeed = 0.008;

const rotateSpeed = 0.006;
const cameraSmooth = 0.04;
const hScrollMax = 100;

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

// Sound
const soundButton = document.getElementById("sound-off");

const ambientSound = new Audio(
  `${import.meta.env.BASE_URL}sounds/ambiance.mp3`,
);

ambientSound.loop = true;
ambientSound.volume = window.matchMedia("(pointer: coarse)").matches
  ? 0.00002
  : 0.00001;

const swipeSound = new Audio(`${import.meta.env.BASE_URL}sounds/swipe.mp3`);
swipeSound.volume = 0.02;

let soundOn = false;

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

function stopSound() {
  ambientSound.pause();
  swipeSound.pause();
}

window.addEventListener("pagehide", stopSound);

document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopSound();
});

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

  applyTheatreCamera(introCamera.value, theatreCtx);

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

// loads 3 models
const browseLoader = new GLTFLoader();
browseLoader.setDRACOLoader(dracoLoader);
browseLoader.setMeshoptDecoder(MeshoptDecoder);

initShowcase({
  loader: browseLoader,
  resetCamera,
  playSwipeSound,
  showJourneyComplete,
  controlsLocked,
});

loadSceneAssets(loadingManager, gltfLoader);

// Input
renderer.domElement.addEventListener("pointerdown", (e) => {
  if (controlsLocked()) return;

  activePointers.set(e.pointerId, {
    x: e.clientX,
    y: e.clientY,
  });

  if (activePointers.size === 1) {
    isDragging = true;

    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  }

  if (activePointers.size === 2) {
    isDragging = false;
    lastPinchDistance = getPinchDistance();
  }
});

function endPointer(e) {
  activePointers.delete(e.pointerId);

  if (activePointers.size < 2) {
    lastPinchDistance = null;
  }

  if (activePointers.size === 0) {
    isDragging = false;
  }
}

window.addEventListener("pointerup", endPointer);
window.addEventListener("pointercancel", endPointer);

window.addEventListener("pointermove", (e) => {
  if (!activePointers.has(e.pointerId)) return;

  activePointers.set(e.pointerId, {
    x: e.clientX,
    y: e.clientY,
  });

  if (transition || controlsLocked()) return;

  const item = showcaseItems[currentItem];
  if (!item) return;

  if (activePointers.size >= 2) {
    const distance = getPinchDistance();

    if (distance === null) return;

    if (lastPinchDistance !== null) {
      const delta = distance - lastPinchDistance;
      scrollZ = THREE.MathUtils.clamp(
        scrollZ - delta * pinchZoomSpeed,
        zoomClosestZ - camDefault.z,
        zoomFarthestZ - camDefault.z,
      );

      const targetZ = camDefault.z + scrollZ;

      if (!isZoomed && targetZ <= zoomInThresholdZ) {
        triggerZoom(item);
      } else if (isZoomed && targetZ >= zoomOutThresholdZ) {
        triggerUnzoom(item);
      } else if (!isZoomed) {
        camTargetZ = targetZ;
      }
    }

    lastPinchDistance = distance;

    return;
  }
  if (!isDragging) return;
  const dx = e.clientX - lastMouseX;
  const dy = e.clientY - lastMouseY;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;

  item.rotation.y += dx * rotateSpeed;
  item.rotation.x += dy * rotateSpeed;
  item.userData.targetRotationY = item.rotation.y;
});

window.addEventListener("keydown", (e) => {
  if (controlsLocked()) return;
  if (e.key === "ArrowRight") {
    const next = (currentItem + 1) % allModels.length;
    goToItem(next, 1);
  }
  if (e.key === "ArrowLeft") {
    const prev = (currentItem - 1 + allModels.length) % allModels.length;
    goToItem(prev, -1);
  }
});

let lastSwipeTime = 0;

// mobile touch input
const swipeCooldown = 900;
const activePointers = new Map();

let lastPinchDistance = null;

const pinchZoomSpeed = 0.085;

function getPinchDistance() {
  const pointers = [...activePointers.values()];

  if (pointers.length < 2) return null;

  const dx = pointers[0].x - pointers[1].x;
  const dy = pointers[0].y - pointers[1].y;

  return Math.hypot(dx, dy);
}

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

        goToItem(next, direction);
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
    goToItem(next, 1);
  });
}

if (backButton) {
  backButton.addEventListener("click", () => {
    if (controlsLocked()) return;
    const prev = (currentItem - 1 + allModels.length) % allModels.length;
    goToItem(prev, -1);
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
    setEndScenePlayed();
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
  setEndScenePlayed();
  if (infoPanel) infoPanel.classList.add("hidden");
  if (bottomBar) bottomBar.style.display = "none";
  showCredits();
  await playEndSequence();
  theatreMode = creditsOpen ? "credits" : "normal";
}

async function playCreditsScene() {
  if (controlsLocked()) return;

  creditsOpen = true;

  if (topBar) topBar.classList.add("hidden");
  if (bottomBar) bottomBar.style.display = "none";
  if (vignette) vignette.style.opacity = "0";
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
    document.querySelector(".credits").classList.remove("hidden");
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

if (ENABLE_GUI) {
  import("./gui.js")
    .then(({ initGui }) => {
      updateGui = initGui({ isZoomed: () => isZoomed }).update;
      console.log("GUI loaded");
    })
    .catch((err) => console.error("GUI failed to load:", err));
}

// Load models
loadInitialItem(gltfLoader);

// Animation loop
renderer.setAnimationLoop(() => {
  updateGui?.();
  updateShowcaseTransition();

  updateShowcase({
    allowAutoRotate: !isDragging && !controlsLocked(),
  });

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
