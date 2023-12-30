import * as THREE from "three";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";

let sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
};
let params = {
  exposure: 1,
  bloomStrength: 0.75,
  bloomThreshold: 0,
  bloomRadius: 1,
};

/** @type {HTMLCanvasElement} */
const canvas = document.querySelector("canvas.webgl");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ReinhardToneMapping;
renderer.setClearAlpha(0);

const scene = new THREE.Scene();

let cameraRotationProxyX = 0;
let cameraRotationProxyY = 0;
const camera = new THREE.PerspectiveCamera(
  75,
  sizes.width / sizes.height,
  0.1,
  100
);
camera.position.set(0, 0, 2);
const pointLight = new THREE.PointLight(0xffffff, 2.5, 50);
pointLight.position.set(0, 0, 2);

window.addEventListener("resize", () => {
  // Update sizes
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  // Update camera
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  // Update renderer
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

scene.add(camera);
scene.add(pointLight);

scene.add(new THREE.AmbientLight(0xffffff, 10));

const rendererScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(sizes.width, sizes.height),
  params.bloomStrength,
  params.bloomRadius,
  params.bloomThreshold
);

const composer = new EffectComposer(renderer);
composer.addPass(rendererScene);
composer.addPass(bloomPass);

const clock = new THREE.Clock();
let mouseX = 0,
  mouseY = 0,
  targetX = 0,
  targetY = 0,
  windowHalfX = window.innerWidth / 2,
  windowHalfY = window.innerHeight / 2;

document.addEventListener("mousemove", (e) => {
  mouseX = e.clientX - windowHalfX;
  mouseY = e.clientY - windowHalfY;
  cameraRotationProxyX =
    THREE.MathUtils.mapLinear(e.clientX, 0, window.innerWidth, -0.04, 0.04) *
    -1;
  cameraRotationProxyY =
    THREE.MathUtils.mapLinear(e.clientY, 0, window.innerHeight, -0.1, 0.1) * -1;
});

// EVERYTHING #f00
/** @type {HTMLInputElement} */
const file = document.getElementById("fileUpload");
let sphereData = {
  radius: 1,
  widthSegments: 32,
  heightSegments: 32,
  phiStart: 0,
  phiLength: 2 * Math.PI,
  thetaStart: 0,
  thetaLength: Math.PI,
};
const obj = new THREE.Mesh(
  new THREE.SphereGeometry(
    sphereData.radius,
    sphereData.widthSegments,
    sphereData.heightSegments,
    sphereData.phiStart,
    sphereData.phiLength,
    sphereData.thetaStart,
    sphereData.thetaLength
  ),
  new THREE.MeshNormalMaterial()
);
scene.add(obj);

import * as dat from "dat.gui";
(() => {
  const Gui = new dat.GUI({ closed: true, name: "GUI" });
  const shader = Gui.addFolder("shader");
  shader.add(params, "exposure", 0.1, 2, 0.01).onChange(function (value) {
    renderer.toneMappingExposure = Math.pow(value, 4.0);
  });
  shader
    .add(params, "bloomThreshold", 0.0, 1.0, 0.01)
    .onChange(function (value) {
      bloomPass.threshold = Number(value);
    });
  shader.add(params, "bloomStrength", 0.0, 3.0).onChange(function (value) {
    bloomPass.strength = Number(value);
  });
  shader.add(params, "bloomRadius", 0.0, 2.0, 0.01).onChange(function (value) {
    bloomPass.radius = Number(value);
  });

  const obF = Gui.addFolder("object");
  obF.add(sphereData, "radius", 0.1, 2, 0.01).onChange(function (value) {
    obj.scale(value, 1);
  });
})();

/** @type {MediaElementAudioSourceNode | undefined} */
let audioSourse;
/** @type {AnalyserNode | undefined} */
let analyser;
file.addEventListener("change", function (e) {
  const files = this.files;
  const audioElemet = document.createElement("audio");

  const container = document.querySelector("div.container");
  if (container.lastChild.nodeName == "AUDIO")
    container.removeChild(container.lastChild);

  container.appendChild(audioElemet);
  audioElemet.src = URL.createObjectURL(files[0]);
  audioElemet.load();

  const audioContext = new AudioContext();
  audioElemet.play();
  audioSourse = audioContext.createMediaElementSource(audioElemet);
  analyser = audioContext.createAnalyser();
  audioSourse.connect(analyser);
  analyser.connect(audioContext.destination);
  analyser.fftSize = 32;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  function tick() {
    clock.getElapsedTime();
    targetX = mouseX * 0.001;
    targetY = mouseY * 0.001;

    camera.rotation.y += (cameraRotationProxyX - camera.rotation.y) / 15;
    camera.rotation.x += (cameraRotationProxyY - camera.rotation.x) / 15;

    analyser?.getByteFrequencyData(dataArray);
    const radius =
      dataArray.map((d, i) => d * i).reduce((a, b) => a + b) /
      (200 * bufferLength);
    bloomPass.radius = dataArray.slice(-5)[0] / 255;
    bloomPass.strength = radius;
    console.log(radius);
    console.log(dataArray);

    obj.rotation.y += 0.005;
    obj.rotation.x += 0.005;

    composer.render();

    window.requestAnimationFrame(tick);
  }
  tick();
});
