import { getProject, types } from "@theatre/core";
import theatreState from "./theatre-project-state.json" assert { type: "json" };

const DEV_MODE = false; // TRUE TO OPEN DEV PANEL

if (DEV_MODE) {
  const theatreStudio = await import("@theatre/studio");
  const studio = theatreStudio.default ?? theatreStudio;

  studio.initialize();
  studio.ui.restore();
  window.__THEATRE_STUDIO__ = studio;
}

const camDefault = {
  x: 0.84, y: 11.09, z: 15,
  lookX: 0.85, lookY: 11.09, lookZ: 0.15,
};

const camZoomed = {
  x: -0.43, y: 16.17, z: 2.37,
  lookX: 1.35, lookY: 15.87, lookZ: -1.37,
};

const theatreProject = getProject("Object Showcase Camera", {
  state: theatreState,
});

export const introSheet = theatreProject.sheet("Intro");
export const endSheet   = theatreProject.sheet("End Scene");

export const introCamera = introSheet.object(
  "Camera",
  {
    x:     types.number(camDefault.x,     { range: [-80, 80]   }),
    y:     types.number(camDefault.y,     { range: [-80, 80]   }),
    z:     types.number(camDefault.z,     { range: [-80, 100]  }),
    lookX: types.number(camDefault.lookX, { range: [-80, 80]   }),
    lookY: types.number(camDefault.lookY, { range: [-80, 80]   }),
    lookZ: types.number(camDefault.lookZ, { range: [-100, 100] }),
    fov:   types.number(42,               { range: [20, 80]    }),
  },
  { reconfigure: true },
);

export const endCamera = endSheet.object(
  "Camera",
  {
    x:     types.number(camDefault.x,     { range: [-40, 40]   }),
    y:     types.number(camDefault.y,     { range: [-10, 40]   }),
    z:     types.number(camDefault.z,     { range: [-60, 120]  }),
    lookX: types.number(camDefault.lookX, { range: [-40, 40]   }),
    lookY: types.number(camDefault.lookY, { range: [-10, 40]   }),
    lookZ: types.number(camDefault.lookZ, { range: [-120, 120] }),
    fov:   types.number(42,               { range: [20, 80]    }),
  },
  { reconfigure: true },
);

export function applyTheatreCamera(values, { camera, setTargets, setLook }) {
  setTargets(values.x, values.y, values.z);
  setLook(values.lookX, values.lookY, values.lookZ);
  camera.position.set(values.x, values.y, values.z);
  camera.lookAt(values.lookX, values.lookY, values.lookZ);
  camera.fov = values.fov;
  camera.updateProjectionMatrix();
}

export async function playIntroSequence() {
  await theatreProject.ready;
  introSheet.sequence.position = 0;
  await introSheet.sequence.play({ iterationCount: 1 });
}

export async function playEndSequence() {
  await theatreProject.ready;
  endSheet.sequence.pause();
  endSheet.sequence.position = 0;
  await endSheet.sequence.play({ iterationCount: 1 });
}

export { theatreProject };