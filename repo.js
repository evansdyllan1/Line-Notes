"use strict";

import * as THREE from "three";
import { svModels } from "./sv-models.js";
import { scene } from "./scene.js";

const itemDefaultPos = { x: 0, y: 0, z: 0 };
const defaultZoomPos = { x: 0, y: -2.7, z: 0 };
const defaultZoomScale = 1.4;

const transDist = 60;
const transDur = 1000;

const autoRotate = 0.002;
const itemSmooth = 0.05;
const wireSmooth = 0.07;
const wireColor = 0x1d150c;

export const allModels = svModels;
export const showcaseItems = [];

export let currentItem = 0;
export let transition = null;
export let modelLoading = false;

const seenItems = new Set();
let endScenePlayed = false;

let browseLoader = null;
let resetCameraHandler = null;
let swipeHandler = null;
let journeyCompleteHandler = null;
let controlsLockedHandler = null;

const infoPanel = document.getElementById("info-panel");
const infoName = document.getElementById("info-name");
const infoPoetic = document.getElementById("info-poetic");
const infoContributor = document.getElementById("info-contributor");
const infoPlaceYear = document.getElementById("info-place-year");
const cardNum = document.getElementById("card-number");

export function initShowcase({
  loader,
  resetCamera,
  playSwipeSound,
  showJourneyComplete,
  controlsLocked,
}) {
  browseLoader = loader;
  resetCameraHandler = resetCamera;
  swipeHandler = playSwipeSound;
  journeyCompleteHandler = showJourneyComplete;
  controlsLockedHandler = controlsLocked;
}

export function setEndScenePlayed(value = true) {
  endScenePlayed = value;
}

function setupWireframe(object) {
  object.traverse((child) => {
    if (!child.isMesh || child.userData.isWireframeOverlay) return;

    const mat = child.material;

    (Array.isArray(mat) ? mat : [mat]).forEach((m) => {
      m.transparent = false;
      m.opacity = 1;
      m.depthWrite = true;
    });

    const wire = new THREE.Mesh(
      child.geometry,
      new THREE.MeshBasicMaterial({
        color: wireColor,
        wireframe: true,
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

export function getBrowsePos(item) {
  return {
    x: item.userData.browseX ?? itemDefaultPos.x,
    y: item.userData.browseY ?? itemDefaultPos.y,
    z: item.userData.browseZ ?? itemDefaultPos.z,
  };
}

export function getZoomPos(item) {
  return {
    x: item.userData.zoomX ?? defaultZoomPos.x,
    y: item.userData.zoomY ?? defaultZoomPos.y,
    z: item.userData.zoomZ ?? defaultZoomPos.z,
  };
}

export function setItemTargets(item, pos, wireframeTarget, scaleTarget) {
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

  model.traverse((child) => {
    if (child.isMesh && !child.userData.isWireframeOverlay) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

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

function showItem(index) {
  resetCameraHandler?.();

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

export function goToItem(nextIndex, direction) {
  if (
    transition ||
    modelLoading ||
    nextIndex === currentItem ||
    controlsLockedHandler?.()
  )
    return;

  const from = showcaseItems[currentItem];
  const to = showcaseItems[nextIndex];

  if (!from) return;

  if (!to) {
    const config = allModels[nextIndex];

    if (!config || !browseLoader) return;

    modelLoading = true;

    browseLoader.load(
      config.path,
      (gltf) => {
        const model = gltf.scene;

        model.scale.setScalar(
          (config.scale ?? 1) * (window.innerWidth <= 768 ? 0.6 : 1),
        );
        model.rotation.y = config.rotation ?? Math.PI / 4;
        model.position.set(0, 0, 0);

        showcaseItems[nextIndex] = makeGroup(model, config);

        modelLoading = false;

        goToItem(nextIndex, direction);
      },
      undefined,
      (error) => {
        console.error(error);
        modelLoading = false;
      },
    );

    return;
  }

  const allSeen = seenItems.size >= allModels.length;
  const wrappingAround = direction === 1 && nextIndex === 0;

  if (wrappingAround && allSeen && !endScenePlayed) {
    setTimeout(() => journeyCompleteHandler?.(), 1000);
    endScenePlayed = true;
  }

  swipeHandler?.();
  resetCameraHandler?.();

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

export function updateShowcaseTransition() {
  if (!transition) return;

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

  if (progress !== 1) return;

  const previous = transition.from;
  const next = transition.nextItem;

  transition.from.visible = false;

  resetItem(transition.from);
  resetItem(transition.to);

  transition = null;

  showItem(next);

  showcaseItems.forEach((item, index) => {
    if (!item || item === previous || index === next) return;

    item.traverse((child) => {
      if (child.geometry && !child.userData.isWireframeOverlay) {
        child.geometry.dispose();
      }

      if (!child.material) return;

      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];

      materials.forEach((material) => {
        Object.values(material).forEach((value) => {
          if (value && value.isTexture) value.dispose();
        });

        material.dispose();
      });
    });

    scene.remove(item);
    showcaseItems[index] = undefined;
  });
}

export function updateShowcase({ allowAutoRotate = true } = {}) {
  const item = showcaseItems[currentItem];

  if (!item) return;

  if (!transition && allowAutoRotate) {
    item.userData.targetRotationY =
      (item.userData.targetRotationY ?? item.rotation.y) + autoRotate;
  }

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

export function loadInitialItem(loader) {
  const config = allModels[0];

  if (!config) return;

  loader.load(config.path, (gltf) => {
    const model = gltf.scene;

    model.scale.setScalar(
      (config.scale ?? 1) * (window.innerWidth <= 768 ? 0.6 : 1),
    );
    model.rotation.y = config.rotation ?? Math.PI / 4;
    model.position.set(0, 0, 0);

    showcaseItems[0] = makeGroup(model, config);

    showItem(0);
  });
}
