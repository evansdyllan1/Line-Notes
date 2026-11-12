"use strict";

import GUI from "three/examples/jsm/libs/lil-gui.module.min.js";
import { showcaseItems, currentItem, allModels } from "./repo.js";

const round = (v) => Number(v.toFixed(2));

export function initGui({ isZoomed }) {
  const gui = new GUI({ title: "Object positions" });
  gui.domElement.style.zIndex = "99999";

  const item = () => showcaseItems[currentItem];

  const overlay = createGridOverlay();

  function sync() {
    const u = item()?.userData;
    const c = allModels[currentItem];
    if (!u || !c) return;
    Object.assign(c, {
      x: round(u.browseX),
      y: round(u.browseY),
      z: round(u.browseZ),
      zoomX: round(u.zoomX),
      zoomY: round(u.zoomY),
      zoomZ: round(u.zoomZ),
      zoomScale: round(u.zoomScale),
    });
  }

  function prop(key, targetKey, activeWhenZoomed) {
    return {
      get value() {
        return item()?.userData[key] ?? 0;
      },
      set value(v) {
        const it = item();
        if (!it) return;
        it.userData[key] = v;
        if (isZoomed() === activeWhenZoomed) it.userData[targetKey] = v;
        sync();
      },
    };
  }

  const browse = gui.addFolder("Browse position");
  browse.add(prop("browseX", "targetX", false), "value", -20, 20, 0.01).name("x");
  browse.add(prop("browseY", "targetY", false), "value", -20, 20, 0.01).name("y");
  browse.add(prop("browseZ", "targetZ", false), "value", -20, 20, 0.01).name("z");

  const zoom = gui.addFolder("Zoom position (zoom in first)");
  zoom.add(prop("zoomX", "targetX", true), "value", -20, 20, 0.01).name("zoomX");
  zoom.add(prop("zoomY", "targetY", true), "value", -20, 20, 0.01).name("zoomY");
  zoom.add(prop("zoomZ", "targetZ", true), "value", -20, 20, 0.01).name("zoomZ");
  zoom
    .add(prop("zoomScale", "targetScale", true), "value", 0.1, 5, 0.01)
    .name("zoomScale");

  const format = (c) =>
    `// ${c.name}\n` +
    `x: ${c.x}, y: ${c.y}, z: ${c.z},\n` +
    `zoomX: ${c.zoomX}, zoomY: ${c.zoomY}, zoomZ: ${c.zoomZ},\n` +
    `zoomScale: ${c.zoomScale},`;

  const actions = {
    logCurrent() {
      const c = allModels[currentItem];
      if (c) console.log(format(c));
    },
    logAll() {
      console.log(allModels.map(format).join("\n\n"));
    },
  };
  gui.add(actions, "logCurrent").name("Log current model");
  gui.add(actions, "logAll").name("Log ALL models");

  let lastItem;
  function update() {
    const it = item();
    if (it === lastItem) return;
    lastItem = it;
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
  }

  return { gui, update };
}