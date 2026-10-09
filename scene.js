import * as THREE from './assets/vendor/three/three.module.js';

// Progressive enhancement: semantic content and the CSS illustration remain
// available while the module loads or when WebGL is unavailable.
export function mountScene(host) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgl2', { antialias: true, alpha: true, powerPreference: 'low-power' });
  if (!context) {
    host.dataset.sceneState = 'fallback';
    return () => {};
  }

  const renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-4, 4, 4, -4, 0.1, 30);
  camera.position.set(5, 4.4, 7);
  camera.lookAt(0, 0, 0);
  const composition = new THREE.Group();
  scene.add(composition);

  const resources = new Set();
  const own = resource => { resources.add(resource); return resource; };
  const material = parameters => own(new THREE.MeshPhysicalMaterial(parameters));
  const geometry = (width, depth) => {
    const r = 0.17;
    const x = -width / 2;
    const y = -depth / 2;
    const shape = new THREE.Shape();
    shape.moveTo(x + r, y);
    shape.lineTo(x + width - r, y);
    shape.quadraticCurveTo(x + width, y, x + width, y + r);
    shape.lineTo(x + width, y + depth - r);
    shape.quadraticCurveTo(x + width, y + depth, x + width - r, y + depth);
    shape.lineTo(x + r, y + depth);
    shape.quadraticCurveTo(x, y + depth, x, y + depth - r);
    shape.lineTo(x, y + r);
    shape.quadraticCurveTo(x, y, x + r, y);
    const result = own(new THREE.ExtrudeGeometry(shape, {
      depth: 0.11, bevelEnabled: true, bevelSize: 0.045,
      bevelThickness: 0.045, bevelSegments: 3, curveSegments: 12, steps: 1
    }));
    result.center();
    result.rotateX(-Math.PI / 2);
    return result;
  };

  // A procedural studio environment gives material highlights without fetching
  // a large HDR file. All other textures are also generated locally.
  const studio = document.createElement('canvas');
  studio.width = 512; studio.height = 256;
  const studioContext = studio.getContext('2d');
  const gradient = studioContext.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.5, '#cfc9e0');
  gradient.addColorStop(1, '#777785');
  studioContext.fillStyle = gradient;
  studioContext.fillRect(0, 0, 512, 256);
  studioContext.fillStyle = '#ffffff';
  studioContext.fillRect(90, 25, 55, 105);
  studioContext.fillRect(310, 40, 95, 70);
  const studioTexture = own(new THREE.CanvasTexture(studio));
  studioTexture.mapping = THREE.EquirectangularReflectionMapping;
  studioTexture.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromEquirectangular(studioTexture);
  scene.environment = environment.texture;
  pmrem.dispose();
  resources.add(environment);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x7d788f, 2.1));
  const key = new THREE.DirectionalLight(0xfff4e2, 3.3);
  key.position.set(-3, 6, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = key.shadow.camera.bottom = -5;
  key.shadow.camera.right = key.shadow.camera.top = 5;
  key.shadow.camera.far = 18;
  key.shadow.bias = -0.002;
  key.shadow.normalBias = 0.035;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xc0a3ff, 2.2);
  rim.position.set(4, 2, -5);
  scene.add(rim);

  const layerData = [
    { label: 'CLOUD', subtitle: '04 / FOUNDATION', color: '#3b4b48', ink: '#e3ece4', description: 'The infrastructure that serves, observes, and supports the system.' },
    { label: 'MODELS', subtitle: '03 / INTELLIGENCE', color: '#7f66b1', ink: '#f6f0ff', description: 'Language, vision, and retrieval bring intelligence and context.' },
    { label: 'AGENTS', subtitle: '02 / ORCHESTRATION', color: '#c0b1e8', ink: '#413158', description: 'Connect models, retrieval, and tools into a purposeful workflow.' },
    { label: 'PRODUCT', subtitle: '01 / EXPERIENCE', color: '#eee7d7', ink: '#424439', description: 'An interface shaped around people, decisions, and real workflows.' }
  ];
  const layers = [];
  const pickable = [];
  const labelPlane = own(new THREE.PlaneGeometry(3.42, 2.22));
  const nodeGeo = own(new THREE.SphereGeometry(0.07, 16, 12));
  const nodeMat = material({ color: 0xeee8fa, metalness: 0.55, roughness: 0.15, clearcoat: 1 });
  layerData.forEach((data, index) => {
    const layer = new THREE.Group();
    layer.position.y = -1.45 + index * 0.91;
    layer.rotation.y = (index - 1.5) * 0.045;
    const face = material({ color: data.color, roughness: 0.26, metalness: 0.18, clearcoat: 0.9, clearcoatRoughness: 0.22 });
    const edge = material({ color: data.color, roughness: 0.2, metalness: 0.45, clearcoat: 1 });
    const slab = new THREE.Mesh(geometry(3.52, 2.32), [face, edge]);
    slab.castShadow = slab.receiveShadow = true;
    slab.userData.layer = index;
    pickable.push(slab);
    layer.add(slab);

    const label = document.createElement('canvas');
    label.width = 1024; label.height = 640;
    const ctx = label.getContext('2d');
    ctx.fillStyle = data.ink;
    ctx.font = '500 23px monospace';
    ctx.fillText(data.subtitle, 65, 510);
    ctx.font = '600 63px sans-serif';
    ctx.fillText(data.label, 65, 456);
    ctx.lineWidth = 2;
    ctx.strokeStyle = data.ink;
    ctx.globalAlpha = 0.32;
    ctx.beginPath(); ctx.moveTo(65, 540); ctx.lineTo(935, 540); ctx.stroke();
    ctx.globalAlpha = 0.8;
    ctx.strokeRect(820, 410, 46, 46);
    ctx.strokeRect(870, 410, 46, 46);
    ctx.strokeRect(845, 357, 46, 46);
    const texture = own(new THREE.CanvasTexture(label));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
    const decal = new THREE.Mesh(labelPlane, own(new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })));
    decal.rotation.x = -Math.PI / 2;
    decal.position.y = 0.106;
    layer.add(decal);
    const indicator = new THREE.Mesh(nodeGeo, nodeMat);
    indicator.position.set(1.42, 0.2, 0.89);
    layer.add(indicator);
    layers.push({ group: layer, face, baseY: layer.position.y, baseRotation: layer.rotation.y });
    composition.add(layer);
  });

  // Thin paths and satellite nodes suggest information moving between layers.
  const orbit = new THREE.Group();
  composition.add(orbit);
  const orbitGeometry = own(new THREE.TorusGeometry(2.62, 0.009, 6, 140));
  const orbitMaterial = own(new THREE.MeshBasicMaterial({ color: 0x9d91b8, transparent: true, opacity: 0.38 }));
  const ring = new THREE.Mesh(orbitGeometry, orbitMaterial);
  ring.rotation.set(0.78, -0.45, 0.25);
  orbit.add(ring);
  const satellites = [];
  const satelliteGeo = own(new THREE.IcosahedronGeometry(0.11, 1));
  const satelliteMat = material({ color: 0xd6c6f2, roughness: 0.18, metalness: 0.35, clearcoat: 1 });
  for (let i = 0; i < 5; i++) {
    const node = new THREE.Mesh(satelliteGeo, satelliteMat);
    satellites.push(node); orbit.add(node);
  }
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 128;
  const shadowContext = shadowCanvas.getContext('2d');
  const shadowGradient = shadowContext.createRadialGradient(64, 64, 2, 64, 64, 64);
  shadowGradient.addColorStop(0, 'rgba(73,56,91,0.33)');
  shadowGradient.addColorStop(0.6, 'rgba(73,56,91,0.13)');
  shadowGradient.addColorStop(1, 'rgba(73,56,91,0)');
  shadowContext.fillStyle = shadowGradient; shadowContext.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(own(new THREE.PlaneGeometry(8, 6)), own(new THREE.MeshBasicMaterial({ map: own(new THREE.CanvasTexture(shadowCanvas)), transparent: true, depthWrite: false })));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -2.25;
  scene.add(shadow);

  const pointer = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarsePointer = window.matchMedia('(pointer: coarse)');
  const toggle = host.querySelector('.scene-toggle');
  const controls = host.querySelector('.scene-interface');
  const description = host.querySelector('.scene-description');
  const buttons = [...host.querySelectorAll('[data-layer]')];
  let selected = 2;
  let hovered = -1;
  let paused = false;
  let intersecting = true;
  let contextLost = false;
  let disposed = false;
  let frame = 0;
  let previous = 0;
  let elapsed = 0;
  let scrollAmount = 0;

  const select = index => {
    selected = index;
    buttons.forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.layer) === index)));
    description.textContent = layerData[index].description;
    if (motionPreference.matches || paused) draw(0, true);
    else requestDraw();
  };
  const handlers = buttons.map(button => {
    const handler = () => select(Number(button.dataset.layer));
    button.addEventListener('click', handler);
    return handler;
  });
  const updateToggle = () => {
    const stopped = paused || motionPreference.matches;
    toggle.setAttribute('aria-pressed', String(stopped));
    toggle.setAttribute('aria-label', motionPreference.matches ? 'Animation disabled by reduced-motion preference' : stopped ? 'Resume 3D animation' : 'Pause 3D animation');
    toggle.innerHTML = `<span aria-hidden="true">${stopped ? '▷' : 'Ⅱ'}</span> ${motionPreference.matches ? 'STILL' : stopped ? 'PLAY' : 'PAUSE'}`;
    toggle.disabled = motionPreference.matches;
  };
  const setPaused = () => {
    paused = !paused; updateToggle();
    cancelAnimationFrame(frame); frame = 0; previous = 0;
    if (!paused) requestDraw();
  };
  toggle.addEventListener('click', setPaused);

  function draw(time, staticFrame = false) {
    frame = 0;
    if (disposed || contextLost) return;
    const moving = !motionPreference.matches && !paused && !staticFrame;
    const delta = previous && time ? Math.min((time - previous) / 1000, 0.05) : 1 / 60;
    previous = time;
    if (moving) elapsed += delta;
    const ease = staticFrame || motionPreference.matches ? 1 : 1 - Math.exp(-delta * 5);
    composition.rotation.y = THREE.MathUtils.lerp(composition.rotation.y, -0.32 + (moving ? pointer.x * 0.17 + Math.sin(elapsed * 0.21) * 0.075 : 0), ease);
    composition.rotation.x = THREE.MathUtils.lerp(composition.rotation.x, moving ? -pointer.y * 0.08 : 0, ease);
    composition.position.y = moving ? Math.sin(elapsed * 0.65) * 0.045 - scrollAmount * 0.08 : 0;
    layers.forEach((layer, index) => {
      const active = index === selected;
      const lifted = index === hovered;
      const float = moving ? Math.sin(elapsed * 0.9 + index * 0.7) * 0.028 : 0;
      const target = layer.baseY + (active ? 0.18 : 0) + (lifted ? 0.1 : 0) + float;
      layer.group.position.y = THREE.MathUtils.lerp(layer.group.position.y, target, ease);
      layer.group.rotation.y = THREE.MathUtils.lerp(layer.group.rotation.y, layer.baseRotation + (active ? 0.035 : 0), ease);
      layer.face.emissive.setHex(active ? 0x392247 : 0x000000);
      layer.face.emissiveIntensity = active ? 0.06 : 0;
    });
    satellites.forEach((node, index) => {
      const angle = elapsed * 0.14 + index * Math.PI * 2 / satellites.length;
      node.position.set(Math.cos(angle) * 2.62, Math.sin(angle) * 1.85, Math.sin(angle) * 1.65);
      node.rotation.set(angle * 0.5, angle, 0);
    });
    renderer.render(scene, camera);
    if (moving && intersecting && !document.hidden) frame = requestAnimationFrame(draw);
  }
  function requestDraw() {
    if (!frame && !disposed && !contextLost && intersecting && !document.hidden) frame = requestAnimationFrame(draw);
  }
  const resize = () => {
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (!width || !height) return;
    const aspect = width / height;
    const halfHeight = Math.max(3.95, 3.35 / aspect);
    camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect;
    camera.top = halfHeight; camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 500 ? 1.25 : 1.6));
    renderer.setSize(width, height, false);
    if (motionPreference.matches || paused) draw(0, true);
    else requestDraw();
  };
  const onPointer = event => {
    if (coarsePointer.matches || motionPreference.matches) return;
    const bounds = canvas.getBoundingClientRect();
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -((event.clientY - bounds.top) / bounds.height * 2 - 1));
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(pickable);
    hovered = hits.length ? hits[0].object.userData.layer : -1;
    canvas.style.cursor = hovered >= 0 ? 'pointer' : 'default';
    if (paused) draw(0, true);
  };
  const resetPointer = () => { pointer.set(0, 0); hovered = -1; if (paused) draw(0, true); };
  const onCanvasClick = event => {
    const bounds = canvas.getBoundingClientRect();
    const position = new THREE.Vector2((event.clientX - bounds.left) / bounds.width * 2 - 1, -((event.clientY - bounds.top) / bounds.height * 2 - 1));
    raycaster.setFromCamera(position, camera);
    const hit = raycaster.intersectObjects(pickable)[0];
    if (hit) select(hit.object.userData.layer);
  };
  const onScroll = () => { scrollAmount = Math.min(1, window.scrollY / Math.max(1, host.offsetHeight)); };
  const visibility = () => {
    cancelAnimationFrame(frame); frame = 0; previous = 0;
    if (!document.hidden && intersecting) { if (paused || motionPreference.matches) draw(0, true); else requestDraw(); }
  };
  const onMotionChange = () => { updateToggle(); cancelAnimationFrame(frame); frame = 0; previous = 0; draw(0, motionPreference.matches); };
  const onContextLost = event => {
    event.preventDefault(); contextLost = true;
    cancelAnimationFrame(frame); frame = 0;
    host.classList.remove('scene-ready'); controls.hidden = toggle.hidden = true;
    host.dataset.sceneState = 'fallback';
  };
  const onContextRestored = () => {
    contextLost = false; previous = 0;
    draw(0, true); host.classList.add('scene-ready');
    controls.hidden = toggle.hidden = false; host.dataset.sceneState = 'ready';
    requestDraw();
  };
  canvas.addEventListener('pointermove', onPointer);
  canvas.addEventListener('pointerleave', resetPointer);
  canvas.addEventListener('click', onCanvasClick);
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);
  window.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('visibilitychange', visibility);
  motionPreference.addEventListener('change', onMotionChange);
  const resizeObserver = new ResizeObserver(resize);
  const visibilityObserver = new IntersectionObserver(entries => {
    intersecting = entries[0].isIntersecting;
    if (!intersecting) { cancelAnimationFrame(frame); frame = 0; previous = 0; }
    else if (paused || motionPreference.matches) draw(0, true);
    else requestDraw();
  });
  host.querySelector('.scene-canvas').append(canvas);
  resize(); updateToggle(); draw(0, true);
  host.classList.add('scene-ready'); host.dataset.sceneState = 'ready';
  controls.hidden = toggle.hidden = false;
  resizeObserver.observe(host); visibilityObserver.observe(host);
  requestDraw();

  return () => {
    disposed = true; cancelAnimationFrame(frame);
    resizeObserver.disconnect(); visibilityObserver.disconnect();
    window.removeEventListener('scroll', onScroll);
    document.removeEventListener('visibilitychange', visibility);
    motionPreference.removeEventListener('change', onMotionChange);
    toggle.removeEventListener('click', setPaused);
    buttons.forEach((button, index) => button.removeEventListener('click', handlers[index]));
    canvas.removeEventListener('pointermove', onPointer);
    canvas.removeEventListener('pointerleave', resetPointer);
    canvas.removeEventListener('click', onCanvasClick);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    canvas.removeEventListener('webglcontextrestored', onContextRestored);
    resources.forEach(resource => resource.dispose());
    key.shadow.dispose(); renderer.dispose(); canvas.remove();
    host.classList.remove('scene-ready'); controls.hidden = toggle.hidden = true;
    host.dataset.sceneState = 'fallback';
  };
}
