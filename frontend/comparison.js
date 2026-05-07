(() => {
  const API_BASE_URLS = window.__API_BASE_URLS__ || (
    window.location.protocol === "file:" || window.location.port === "5501"
      ? ["http://127.0.0.1:5001", "http://127.0.0.1:5000"]
      : [window.location.origin]
  );
  const comparisonContainer = document.getElementById("comparison-scene");
  const comparisonReadout = document.getElementById("comparison-readout");
  const toggleBillionaires = document.getElementById("toggle-billionaires");
  const toggleAmericans = document.getElementById("toggle-americans");
  const toggleSample = document.getElementById("toggle-sample");

  if (
    !comparisonContainer ||
    !comparisonReadout ||
    !toggleBillionaires ||
    !toggleAmericans ||
    !toggleSample ||
    typeof THREE === "undefined"
  ) {
    return;
  }

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x09080a, 18, 60);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1000);
  camera.position.set(0, 0, 18);

  const cameraTarget = new THREE.Vector3(0, 0, 18);
  const lookTarget = new THREE.Vector3(0, 0, 0);
  const lookTargetNext = new THREE.Vector3(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  comparisonContainer.appendChild(renderer.domElement);

  const tooltip = document.createElement("div");
  tooltip.className = "planet-tooltip";
  comparisonContainer.appendChild(tooltip);

  const group = new THREE.Group();
  scene.add(group);

  scene.add(new THREE.AmbientLight(0xffffff, 1.6));

  const directionalLight = new THREE.DirectionalLight(0xffffff, 2.4);
  directionalLight.position.set(6, 8, 10);
  scene.add(directionalLight);

  const assetUrl = path => new URL(path, document.baseURI).href;
  const textureLoader = new THREE.TextureLoader();
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

  function makeCanvasTexture(key) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;

    const ctx = canvas.getContext("2d");
    const palettes = {
      billionaires: ["#5b2d0e", "#8b4514", "#f7931a", "#ffd08a"],
      americans: ["#22313a", "#5b717b", "#b5c2c8", "#edf2f4"],
      sample: ["#3f4a32", "#72815c", "#b8b091", "#f0e5c9"],
    };
    const palette = palettes[key];

    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, palette[0]);
    gradient.addColorStop(0.45, palette[1]);
    gradient.addColorStop(1, palette[2]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 220; i += 1) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const radius = 18 + Math.random() * 120;
      const alpha = 0.04 + Math.random() * 0.16;
      const color = palette[(i % (palette.length - 1)) + 1];

      ctx.beginPath();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = maxAnisotropy;
    texture.needsUpdate = true;
    return texture;
  }

  const textures = {
    billionaires: makeCanvasTexture("billionaires"),
    americans: makeCanvasTexture("americans"),
    sample: makeCanvasTexture("sample"),
  };

  const materials = {
    billionaires: new THREE.MeshBasicMaterial({
      map: textures.billionaires,
      color: 0xffffff,
    }),
    americans: new THREE.MeshBasicMaterial({
      map: textures.americans,
      color: 0xffffff,
    }),
    sample: new THREE.MeshBasicMaterial({
      map: textures.sample,
      color: 0xffffff,
    }),
  };

  const textureSources = {
    billionaires: "planetTexture2.jpg",
    americans: "planetTexture3.jpg",
    sample: "planetTexture1.jpg",
  };

  Object.entries(textureSources).forEach(([key, source]) => {
    textureLoader.load(
      assetUrl(source),
      loadedTexture => {
        loadedTexture.colorSpace = THREE.SRGBColorSpace;
        loadedTexture.anisotropy = maxAnisotropy;
        materials[key].map = loadedTexture;
        materials[key].needsUpdate = true;
      },
      undefined,
      err => {
        console.warn(`Failed to load ${source}; using generated fallback texture.`, err);
      }
    );
  });

  const billionaireFallbackWealth = 4250000000000;
  const americansWealth = 4250000000000;
  const sampleWealth = 939 * 192000;
  let billionaireWealth = billionaireFallbackWealth;

  const baseRadius = 2.0;
  const planets = {
    billionaires: createPlanet({
      key: "billionaires",
      label: "Planet Billionaire",
      material: materials.billionaires,
      population: 939,
      wealth: () => billionaireWealth,
    }),
    americans: createPlanet({
      key: "americans",
      label: "Planet Bottom 50%",
      material: materials.americans,
      population: 171250000,
      wealth: () => americansWealth,
    }),
    sample: createPlanet({
      key: "sample",
      label: "Planet Average",
      material: materials.sample,
      population: 939,
      wealth: () => sampleWealth,
      minHaloScale: 0.2,
    }),
  };

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hoveredKey = null;
  let selectedKey = null;

  Object.values(planets).forEach(({ mesh, halo, hitArea }) => {
    group.add(mesh);
    group.add(halo);
    group.add(hitArea);
  });

  function createPlanet({ key, label, material, population, wealth, minHaloScale = 0.08 }) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(baseRadius, 56, 56),
      material
    );
    mesh.userData.key = key;

    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(baseRadius * 1.24, 40, 40),
      new THREE.MeshBasicMaterial({
        color: key === "billionaires" ? 0xf7931a : key === "americans" ? 0xd8f2ff : 0x9edcff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );

    const hitArea = new THREE.Mesh(
      new THREE.SphereGeometry(baseRadius * 1.35, 24, 24),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
      })
    );
    hitArea.userData.key = key;

    return { key, label, mesh, halo, hitArea, population, wealth, minHaloScale };
  }

  function resize() {
    const width = comparisonContainer.clientWidth;
    const height = comparisonContainer.clientHeight;

    if (!width || !height) return;

    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  const resizeObserver = typeof ResizeObserver !== "undefined"
    ? new ResizeObserver(() => resize())
    : null;

  if (resizeObserver) {
    resizeObserver.observe(comparisonContainer);
  } else {
    window.addEventListener("resize", resize);
  }

  function formatMoney(value) {
    if (value >= 1_000_000_000_000) return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
    if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
    return `$${Math.round(value).toLocaleString()}`;
  }

  function formatRatio(value) {
    return value >= 10
      ? value.toLocaleString(undefined, { maximumFractionDigits: 0 })
      : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  async function fetchJson(path) {
    let lastError = null;

    for (const baseUrl of API_BASE_URLS) {
      try {
        const response = await fetch(`${baseUrl}${path}`);
        if (!response.ok) {
          throw new Error(`Request failed with ${response.status}`);
        }

        return await response.json();
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error("Failed to fetch data");
  }

  function radiusScaleFor(wealth) {
    return Math.cbrt(wealth / billionaireWealth);
  }

  function selectedKeys() {
    return [
      { key: "billionaires", checked: toggleBillionaires.checked },
      { key: "americans", checked: toggleAmericans.checked },
      { key: "sample", checked: toggleSample.checked },
    ].filter(({ checked }) => checked).map(({ key }) => key);
  }

  function updateScales() {
    Object.values(planets).forEach(planet => {
      const scale = planet.key === "billionaires" ? 1 : radiusScaleFor(planet.wealth());
      planet.mesh.scale.setScalar(scale);
      planet.halo.scale.setScalar(Math.max(scale, planet.minHaloScale));
      planet.hitArea.scale.setScalar(Math.max(scale, 0.18));
    });
  }

  function updateLayout() {
    const keys = selectedKeys();
    const positionsByCount = {
      1: [0],
      2: [-2.2, 2,2],
      3: [-3.8, 0, 3.8],
    };

    Object.values(planets).forEach(planet => {
      const visible = keys.includes(planet.key);
      planet.mesh.visible = visible;
      planet.halo.visible = visible;
      planet.hitArea.visible = visible;
    });

    if (!keys.length) {
      selectedKey = null;
      hoveredKey = null;
      tooltip.classList.remove("is-visible");
      comparisonReadout.textContent = "Select at least one planet to view the comparison.";
      cameraTarget.set(0, 0, 14);
      lookTargetNext.set(0, 0, 0);
      return;
    }

    keys.forEach((key, index) => {
      const x = positionsByCount[keys.length][index];
      const y = key === "billionaires" ? 0.4 : key === "americans" ? -0.25 : -1.05;
      const planet = planets[key];

      planet.mesh.position.set(x, y, 0);
      planet.halo.position.copy(planet.mesh.position);
      planet.hitArea.position.copy(planet.mesh.position);
    });

    if (selectedKey && !keys.includes(selectedKey)) selectedKey = null;
    if (hoveredKey && !keys.includes(hoveredKey)) hoveredKey = null;

    updateCameraTarget();
    updateReadout();
  }

  function updateReadout() {
    comparisonReadout.textContent =
      `Billionaires vs 171,250,000 Americans: ${formatRatio(billionaireWealth / americansWealth)}:1. ` +
      `Billionaires vs 939 Americans: ${formatRatio(billionaireWealth / sampleWealth)}:1.`;
  }

  function updateCameraTarget() {
    const keys = selectedKeys();

    if (selectedKey && planets[selectedKey]?.mesh.visible) {
      const planet = planets[selectedKey];
      const worldPosition = new THREE.Vector3();
      planet.mesh.getWorldPosition(worldPosition);

      const radius = planet.mesh.scale.x * baseRadius;
      lookTargetNext.copy(worldPosition);
      cameraTarget.set(worldPosition.x, worldPosition.y, Math.max(3.2, radius * 4.2));
      return;
    }

    const largestVisibleRadius = Math.max(
      ...keys.map(key => planets[key].mesh.scale.x * baseRadius)
    );

    lookTargetNext.set(0, 0, 0);
    cameraTarget.set(
      0,
      0,
      Math.max(13, 10.5 + largestVisibleRadius * (keys.length === 1 ? 2.5 : 2.1))
    );
  }

  function setPointerFromEvent(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function planetFromEvent(event) {
    setPointerFromEvent(event);
    raycaster.setFromCamera(pointer, camera);

    const visibleMeshes = Object.values(planets)
      .map(planet => planet.hitArea)
      .filter(mesh => mesh.visible);
    const intersections = raycaster.intersectObjects(visibleMeshes, false);

    return intersections[0]?.object?.userData?.key || null;
  }

  function updateHover(event) {
    hoveredKey = planetFromEvent(event);
    renderer.domElement.style.cursor = hoveredKey ? "pointer" : "default";
  }

  function showTooltip(key) {
    const planet = planets[key];
    const wealth = planet.wealth();
    const radiusScale = planet.mesh.scale.x;

    tooltip.innerHTML = `
      <p class="planet-tooltip-title">${planet.label}</p>
      <p class="planet-tooltip-population"> Population: ${planet.population.toLocaleString()}</p>
      <p class="planet-tooltip-stat">Wealth: ${formatMoney(wealth)}</p>
      <p class="planet-tooltip-stat">Volume ratio vs billionaires: ${formatRatio(billionaireWealth / wealth)}:1</p>
      <p class="planet-tooltip-stat">Radius scale: ${(radiusScale * 100).toFixed(1)}%</p>
    `;
    tooltip.classList.add("is-visible");
  }

  function handleClick(event) {
    const clickedKey = planetFromEvent(event);

    if (!clickedKey) {
      selectedKey = null;
      tooltip.classList.remove("is-visible");
      updateCameraTarget();
      return;
    }

    selectedKey = selectedKey === clickedKey ? null : clickedKey;

    if (selectedKey) {
      showTooltip(selectedKey);
    } else {
      tooltip.classList.remove("is-visible");
    }

    updateCameraTarget();
  }

  function syncScene() {
    updateScales();
    updateLayout();
  }

  function updateHalos() {
    Object.values(planets).forEach(planet => {
      const active = planet.key === hoveredKey || planet.key === selectedKey;
      const targetOpacity = active ? 0.34 : 0;
      const material = planet.halo.material;

      material.opacity += (targetOpacity - material.opacity) * 0.18;
      planet.halo.visible = planet.mesh.visible && material.opacity > 0.01;
    });
  }

  function animateComparison() {
    requestAnimationFrame(animateComparison);

    if (!selectedKey) group.rotation.y += 0.00045;

    Object.values(planets).forEach(planet => {
      if (planet.mesh.visible) planet.mesh.rotation.y += planet.key === "sample" ? 0.008 : 0.0045;
    });

    updateHalos();
    camera.position.lerp(cameraTarget, 0.08);
    lookTarget.lerp(lookTargetNext, 0.08);
    camera.lookAt(lookTarget);

    renderer.render(scene, camera);
  }

  [toggleBillionaires, toggleAmericans, toggleSample].forEach(input => {
    input.addEventListener("change", syncScene);
  });

  renderer.domElement.addEventListener("pointermove", updateHover);
  renderer.domElement.addEventListener("pointerleave", () => {
    hoveredKey = null;
    renderer.domElement.style.cursor = "default";
  });
  renderer.domElement.addEventListener("click", handleClick);

  syncScene();
  animateComparison();

  fetchJson("/api/billionaires")
    .then(data => {
      billionaireWealth = data.reduce((sum, person) => sum + (person.wealth || 0), 0);
      syncScene();
    })
    .catch(err => {
      console.error("Failed to load comparison data:", err);
      comparisonReadout.textContent = "Unable to load live comparison data. Showing fallback values.";
    });
})();
