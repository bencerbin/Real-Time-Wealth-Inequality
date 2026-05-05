const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);

document.body.appendChild(renderer.domElement);
renderer.domElement.style.position = "fixed";
renderer.domElement.style.top = "0";
renderer.domElement.style.zIndex = "-1";

const starGeometry = new THREE.BufferGeometry();
const starCount = 2000;

const positions = new Float32Array(starCount * 3);

for (let i = 0; i < starCount * 3; i++) {
  positions[i] = (Math.random() - 0.5) * 2000;
}

starGeometry.setAttribute(
  "position",
  new THREE.BufferAttribute(positions, 3)
);

const starMaterial = new THREE.PointsMaterial({
  color: 0xffffff,
  size: 1
});

const stars = new THREE.Points(starGeometry, starMaterial);
scene.add(stars);

const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

const geometry = new THREE.SphereGeometry(5, 32, 32);
const textureLoader = new THREE.TextureLoader();

const planetTexture = textureLoader.load(
  "planetTexture1.jpg",
  () => console.log("Planet texture loaded"),
  undefined,
  (err) => console.error("Planet texture failed to load", err)
);
planetTexture.colorSpace = THREE.SRGBColorSpace;

const material = new THREE.MeshStandardMaterial({
  map: planetTexture
});

const planet = new THREE.Mesh(geometry, material);
planet.position.z = -100;
planet.position.x = -25;
planet.position.y = 0;

scene.add(planet);

camera.position.z = 0;


function animateBackground() {
  requestAnimationFrame(animateBackground);

  // move forward through space
  camera.position.z -= 0.02;
  planet.rotation.y += 0.001;
  renderer.render(scene, camera);
}

animateBackground();
