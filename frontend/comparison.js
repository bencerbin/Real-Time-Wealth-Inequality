const comparisonContainer = document.getElementById("comparison-scene");
const comparisonReadout = document.getElementById("comparison-readout");

if (comparisonContainer && comparisonReadout && typeof THREE !== "undefined") {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x09080a, 18, 50);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1000);
  camera.position.set(0, 0, 18);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  comparisonContainer.appendChild(renderer.domElement);

  const group = new THREE.Group();
  scene.add(group);

  const ambientLight = new THREE.AmbientLight(0xffffff, 1.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 2.2);
  directionalLight.position.set(6, 8, 10);
  scene.add(directionalLight);

  const planetTexture1 = textureLoader.load(
  "planetTexture2.jpg",
  () => console.log("Planet texture loaded"),
  undefined,
  (err) => console.error("Planet texture failed to load", err)
);

  planetTexture1.colorSpace = THREE.SRGBColorSpace;

   const planetTexture2 = textureLoader.load(
  "planetTexture3.jpg",
  () => console.log("Planet texture loaded"),
  undefined,
  (err) => console.error("Planet texture failed to load", err)
);

  planetTexture2.colorSpace = THREE.SRGBColorSpace;

  const bigMaterial = new THREE.MeshStandardMaterial({
    map: planetTexture1
  });

  const smallMaterial = new THREE.MeshStandardMaterial({
    map: planetTexture2
  });

   const tinyMaterial = new THREE.MeshStandardMaterial({
    map: planetTexture2
  });

  const largeRadius = 3.3;
  let bigPlanet;
  let smallPlanet;

  const RESIZE_OBSERVER = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => resize()) : null;
  if (RESIZE_OBSERVER) {
    RESIZE_OBSERVER.observe(comparisonContainer);
  } else {
    window.addEventListener("resize", resize);
  }

  function resize() {
    const width = comparisonContainer.clientWidth;
    const height = comparisonContainer.clientHeight;

    if (!width || !height) return;

    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function buildScene(ratio,tinyRatio) {
    if (bigPlanet) group.remove(bigPlanet);
    if (smallPlanet) group.remove(smallPlanet);

    const safeRatio = Math.max(ratio, 1);
    const safeTinyRatio = Math.max(tinyRatio, 1);
    const volumeScale = Math.cbrt(safeRatio);
    const tinyVolumeScale = Math.cbrt(safeTinyRatio);
    const smallRadius = largeRadius / volumeScale;
    const tinyRadius = largeRadius / tinyVolumeScale;

    const bigGeometry = new THREE.SphereGeometry(largeRadius, 48, 48);
    const smallGeometry = new THREE.SphereGeometry(smallRadius, 48, 48);
    const tinyGeometry = new THREE.SphereGeometry(tinyRadius, 48, 48);


    bigPlanet = new THREE.Mesh(bigGeometry, bigMaterial);
    smallPlanet = new THREE.Mesh(smallGeometry, smallMaterial);
    tinyPlanet = new THREE.Mesh(tinyGeometry, tinyMaterial);

    bigPlanet.position.set(-4.8, 0, 0);
    smallPlanet.position.set(2.4, -0.9, 0.5);
    tinyPlanet.position.set(6.2, -1.1, 1.5);

    group.add(bigPlanet);
    group.add(smallPlanet);
    group.add(tinyPlanet);

    comparisonReadout.textContent = `Sphere volume tracks the wealth ratio: ${safeRatio.toLocaleString(undefined, { maximumFractionDigits: 0 })}:1`;
    resize();
  }

  function animate() {
    requestAnimationFrame(animate);

    group.rotation.y += 0.00005;
    if (bigPlanet) bigPlanet.rotation.y += 0.004;
    if (smallPlanet) smallPlanet.rotation.y += 0.006;

    renderer.render(scene, camera);
  }

  fetch("http://127.0.0.1:5000/api/billionaires")
    .then(res => res.json())
    .then(data => {
      const totalBillionaireWealth = data.reduce((sum, person) => sum + (person.wealth || 0), 0);
      const americansWealth = 4250000000000;
      const sampleAmericansWealth = 939 * 192000;
      const ratio = totalBillionaireWealth / americansWealth;
      const tinyRatio = totalBillionaireWealth / sampleAmericansWealth;
      buildScene(ratio, tinyRatio);
      animate();
    })
    .catch(err => {
      console.error("Failed to load comparison data:", err);
      comparisonReadout.textContent = "Unable to load the wealth comparison right now.";
    });
}
