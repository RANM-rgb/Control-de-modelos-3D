// assets/js/main.js
import * as THREE from "three";

import Stats from "three/addons/libs/stats.module.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";

const manager = new THREE.LoadingManager();

let camera, scene, renderer, stats, object, loader, guiMorphsFolder;
let mixer;

const timer = new THREE.Timer();
timer.connect(document);

const params = {
  // ✅ Renombra el archivo para evitar espacios:
  // models/fbx/Samba_Dancing.fbx
  asset: "Samba_Dancing",
};

const assets = [
  "Samba_Dancing",
  "morph_test",
  "monkey",
  "monkey_embedded_texture",
  "vCube",
];

// ✅ Para animación por código en modelos sin clips (monkey / vCube)
let currentAsset = params.asset;

init();

function init() {
  const container = document.createElement("div");
  document.body.appendChild(container);

  camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    1,
    2000
  );
  camera.position.set(100, 200, 300);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa0a0a0);
  scene.fog = new THREE.Fog(0xa0a0a0, 200, 1000);

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 5);
  hemiLight.position.set(0, 200, 0);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 5);
  dirLight.position.set(0, 200, 100);
  dirLight.castShadow = true;
  dirLight.shadow.camera.top = 180;
  dirLight.shadow.camera.bottom = -100;
  dirLight.shadow.camera.left = -120;
  dirLight.shadow.camera.right = 120;
  scene.add(dirLight);

  // ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000),
    new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(2000, 20, 0x000000, 0x000000);
  grid.material.opacity = 0.2;
  grid.material.transparent = true;
  scene.add(grid);

  loader = new FBXLoader(manager);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setAnimationLoop(animate);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 100, 0);
  controls.update();

  window.addEventListener("resize", onWindowResize);

  stats = new Stats();
  container.appendChild(stats.dom);

  const gui = new GUI();
  gui.add(params, "asset", assets).onChange((value) => {
    currentAsset = value;
    loadAsset(value);
  });

  guiMorphsFolder = gui.addFolder("Morphs").hide();

  // ✅ Carga inicial
  loadAsset(params.asset);
}

function disposeCurrentObject() {
  if (!object) return;

  object.traverse((child) => {
    if (child.isSkinnedMesh && child.skeleton) child.skeleton.dispose();

    if (child.material) {
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];

      materials.forEach((material) => {
        if (material.map) material.map.dispose();
        material.dispose();
      });
    }

    if (child.geometry) child.geometry.dispose();
  });

  scene.remove(object);
  object = null;
  mixer = null;
}

function resetMorphGUI() {
  if (!guiMorphsFolder) return;
  guiMorphsFolder.children.forEach((c) => c.destroy());
  guiMorphsFolder.hide();
}

function loadAsset(asset) {
  // ✅ Ruta robusta para GitHub Pages/local (NO depende del nombre del repo)
  const base = new URL("../../models/fbx/", import.meta.url);
  const url = new URL(`${asset}.fbx`, base).href;

  loader.load(
    url,
    (group) => {
      disposeCurrentObject();
      resetMorphGUI();

      object = group;

      // ✅ Si trae animaciones (Samba_Dancing)
      if (object.animations && object.animations.length) {
        mixer = new THREE.AnimationMixer(object);
        mixer.clipAction(object.animations[0]).play();
      } else {
        mixer = null;
      }

      // ✅ Sombras + Morph GUI
      object.traverse((child) => {
        if (!child.isMesh) return;

        child.castShadow = true;
        child.receiveShadow = true;

        if (child.morphTargetDictionary && child.morphTargetInfluences) {
          guiMorphsFolder.show();
          const meshFolder = guiMorphsFolder.addFolder(child.name || child.uuid);

          Object.keys(child.morphTargetDictionary).forEach((key) => {
            meshFolder.add(
              child.morphTargetInfluences,
              child.morphTargetDictionary[key],
              0,
              1,
              0.01
            );
          });
        }
      });

      scene.add(object);
    },
    undefined,
    (err) => {
      console.error("❌ Error cargando FBX:", asset, err);
      console.error("URL intentada:", url);
    }
  );
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  timer.update();
  const delta = timer.getDelta();

  // ✅ Animación por clips
  if (mixer) mixer.update(delta);

  // ✅ Movimiento por código para modelos sin clips (monkey / vCube)
  if (object && !mixer) {
    if (currentAsset === "monkey") {
      object.rotation.y += delta * 1.2;
    }

    if (currentAsset === "vCube") {
      object.rotation.x += delta * 1.5;
      object.rotation.y += delta * 1.5;
    }
  }

  renderer.render(scene, camera);
  stats.update();
}