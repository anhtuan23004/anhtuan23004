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
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.setClearColor(0x171321, 1);
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
  const backdrop = document.createElement('canvas');
  backdrop.width = backdrop.height = 512;
  const backdropContext = backdrop.getContext('2d');
  const backdropGradient = backdropContext.createRadialGradient(280, 180, 0, 256, 256, 360);
  backdropGradient.addColorStop(0, '#413050');
  backdropGradient.addColorStop(0.48, '#251e33');
  backdropGradient.addColorStop(1, '#171321');
  backdropContext.fillStyle = backdropGradient;
  backdropContext.fillRect(0, 0, 512, 512);
  const backdropTexture = own(new THREE.CanvasTexture(backdrop));
  backdropTexture.colorSpace = THREE.SRGBColorSpace;
  scene.background = backdropTexture;
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

  scene.add(new THREE.HemisphereLight(0xe9e0ff, 0x252031, 1.3));
  const key = new THREE.DirectionalLight(0xfff4ef, 2.8);
  key.position.set(-3, 6, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = key.shadow.camera.bottom = -5;
  key.shadow.camera.right = key.shadow.camera.top = 5;
  key.shadow.camera.far = 18;
  key.shadow.bias = -0.002;
  key.shadow.normalBias = 0.035;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xb6a0ff, 3.6);
  rim.position.set(4, 2, -5);
  scene.add(rim);

  const layerData = [
    { label: 'CLOUD', subtitle: '04 / FOUNDATION', color: '#29343b', ink: '#d7dfeb', description: 'AWS & GCP · Deployment, storage, observability, and reliable infrastructure.' },
    { label: 'MODELS', subtitle: '03 / INTELLIGENCE', color: '#9270cb', ink: '#eee5ff', description: 'LLMs & retrieval · Language, vision, and grounding in your data.' },
    { label: 'AGENTS', subtitle: '02 / ORCHESTRATION', color: '#baa3ed', ink: '#3d2858', description: 'Agents & tools · Coordinate reasoning, context, and actions.' },
    { label: 'PRODUCT', subtitle: '01 / EXPERIENCE', color: '#dfd8f4', ink: '#372744', description: 'Product & workflow · Turn AI capabilities into useful experiences.' }
  ];
  const layers = [];
  const pickable = [];
  const labelPlane = own(new THREE.PlaneGeometry(3.42, 2.22));
  const nodeGeo = own(new THREE.SphereGeometry(0.07, 16, 12));
  const slabGeometry = geometry(3.52, 2.32);
  // Rounded perimeter lines catch the light without a bloom render pass.
  const perimeter = [];
  for (let corner = 0; corner < 4; corner++) {
    const angle = corner * Math.PI / 2;
    const cx = corner === 0 || corner === 3 ? 1.59 : -1.59;
    const cz = corner < 2 ? 0.99 : -0.99;
    for (let step = 0; step <= 10; step++) {
      const a = angle + step / 10 * Math.PI / 2;
      perimeter.push(new THREE.Vector3(cx + Math.cos(a) * 0.17, 0.105, cz + Math.sin(a) * 0.17));
    }
  }
  const outlineGeometry = own(new THREE.BufferGeometry().setFromPoints(perimeter));
  // An offset fan gives each plate its own silhouette and exposed glass edge.
  const layout = [
    { x: -0.46, z: 0.16, rotation: -0.13, tilt: 0.012 },
    { x: -0.18, z: 0.02, rotation: 0.055, tilt: -0.018 },
    { x: 0.22, z: -0.15, rotation: -0.065, tilt: 0.015 },
    { x: 0.64, z: -0.34, rotation: 0.16, tilt: -0.012 }
  ];
  layerData.forEach((data, index) => {
    const placement = layout[index];
    const layer = new THREE.Group();
    layer.position.set(placement.x, -1.45 + index * 1.08, placement.z);
    layer.rotation.set(placement.tilt, placement.rotation, 0);
    const glass = index > 0;
    const face = material({ color: data.color, roughness: glass ? 0.065 : 0.3, metalness: glass ? 0 : 0.55,
      transmission: glass ? 0.88 : 0, thickness: 0.22, ior: 1.45,
      attenuationColor: data.color, attenuationDistance: 5,
      clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.45 });
    const edge = material({ color: data.color, roughness: 0.16, metalness: 0.25,
      emissive: glass ? 0x8e6fbc : 0x364958, emissiveIntensity: 0.18, clearcoat: 1 });
    const slab = new THREE.Mesh(slabGeometry, [face, edge]);
    slab.castShadow = slab.receiveShadow = true;
    slab.userData.layer = index;
    pickable.push(slab);
    layer.add(slab);
    const outlineMaterial = own(new THREE.LineBasicMaterial({ color: glass ? 0xd3bafc : 0x8195a8, transparent: true, opacity: 0.5 }));
    layer.add(new THREE.LineLoop(outlineGeometry, outlineMaterial));

    const label = document.createElement('canvas');
    label.width = 1024; label.height = 640;
    const ctx = label.getContext('2d');
    ctx.fillStyle = data.ink;
    ctx.font = '500 23px monospace';
    ctx.fillText(data.subtitle, 65, 575);
    ctx.font = '500 46px sans-serif';
    ctx.fillText(data.label, 65, 530);
    ctx.lineWidth = 2;
    ctx.strokeStyle = data.ink;
    ctx.globalAlpha = 0.32;
    ctx.beginPath(); ctx.moveTo(65, 600); ctx.lineTo(935, 600); ctx.stroke();
    const texture = own(new THREE.CanvasTexture(label));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
    const decal = new THREE.Mesh(labelPlane, own(new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })));
    decal.rotation.x = -Math.PI / 2;
    decal.position.y = 0.106;
    layer.add(decal);
    layers.push({ group: layer, face, outlineMaterial, baseX: layer.position.x, baseY: layer.position.y, baseZ: layer.position.z, baseRotation: layer.rotation.y });
    composition.add(layer);
  });

  const foundation = new THREE.Mesh(geometry(3.9, 2.7), material({ color: 0x19212c, metalness: 0.6, roughness: 0.25, clearcoat: 1 }));
  foundation.position.set(layout[0].x, -1.73, layout[0].z);
  foundation.rotation.y = layout[0].rotation;
  foundation.castShadow = foundation.receiveShadow = true;
  composition.add(foundation);

  // Separate links follow the moving plates; geometry is reused every frame.
  const links = [];
  const linkGeometry = own(new THREE.CylinderGeometry(0.012, 0.012, 1, 8));
  const linkMaterial = own(new THREE.MeshBasicMaterial({ color: 0xbca0e5, transparent: true, opacity: 0.32 }));
  const pulseMaterial = own(new THREE.MeshBasicMaterial({ color: 0xe4cdff }));
  const haloGeometry = own(new THREE.SphereGeometry(0.14, 12, 8));
  const haloMaterial = own(new THREE.MeshBasicMaterial({ color: 0xb58aff, transparent: true, opacity: 0.12, depthWrite: false }));
  const up = new THREE.Vector3(0, 1, 0);
  const direction = new THREE.Vector3();
  for (let index = 0; index < 3; index++) {
    for (let port = 0; port < 2; port++) {
      const anchor = new THREE.Vector3(port ? 1.3 : -1.3, 0.12, -0.77);
      const line = new THREE.Mesh(linkGeometry, linkMaterial);
      const pulse = new THREE.Mesh(nodeGeo, pulseMaterial);
      pulse.add(new THREE.Mesh(haloGeometry, haloMaterial));
      composition.add(line, pulse);
      links.push({ index, port, anchor, line, pulse, start: new THREE.Vector3(), end: new THREE.Vector3() });
    }
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
  const buttons = [...host.querySelectorAll('[data-layer]')];
  let selected = Number(host.dataset.layer ?? -1);
  let hovered = -1;
  let paused = false;
  let intersecting = true;
  let contextLost = false;
  let disposed = false;
  let frame = 0;
  let previous = 0;
  let elapsed = 0;
  let scrollAmount = 0;
  let entered = false;
  const cameraTarget = new THREE.Vector3();
  const nextCameraPosition = new THREE.Vector3();
  const nextCameraTarget = new THREE.Vector3();

  const onViewChange = event => {
    selected = event.detail;
    hovered = -1; pointer.set(0, 0);
    if (motionPreference.matches || paused) draw(0, true);
    else requestDraw();
  };
  host.addEventListener('architecture-view-change', onViewChange);
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
    const ease = staticFrame || motionPreference.matches ? 1 : 1 - Math.exp(-delta * 3.2);
    const exploring = selected >= 0;
    const opening = host.dataset.opening === 'true' && exploring;
    const focusY = opening ? layers[selected].baseY + 0.54 : 0.25;
    const focusX = opening ? layers[selected].baseX + 0.26 : 0;
    const focusZ = opening ? layers[selected].baseZ + 0.14 : 0;
    nextCameraTarget.set(focusX, focusY, focusZ);
    nextCameraPosition.set(focusX + (exploring ? 5.4 : 5), focusY + (exploring ? 3.8 : 4.4), focusZ + 7);
    cameraTarget.lerp(nextCameraTarget, ease);
    camera.position.lerp(nextCameraPosition, ease);
    camera.lookAt(cameraTarget);
    const zoom = opening ? 1.65 : exploring ? 1.22 : entered ? 1.18 : 1.14;
    camera.zoom = THREE.MathUtils.lerp(camera.zoom, zoom, ease);
    camera.updateProjectionMatrix();
    composition.rotation.y = THREE.MathUtils.lerp(composition.rotation.y, -0.32 + (moving ? pointer.x * 0.17 + Math.sin(elapsed * 0.21) * 0.075 : 0), ease);
    composition.rotation.x = THREE.MathUtils.lerp(composition.rotation.x, moving ? -pointer.y * 0.08 : 0, ease);
    composition.position.y = 0.36 + (moving ? Math.sin(elapsed * 0.65) * 0.045 - scrollAmount * 0.08 : 0);
    layers.forEach((layer, index) => {
      const active = index === selected;
      const lifted = index === hovered;
      const float = moving ? Math.sin(elapsed * 0.9 + index * 0.7) * 0.028 : 0;
      const separation = exploring && !active ? (index > selected ? 0.18 : -0.08) : 0;
      const target = layer.baseY + separation + (active ? 0.18 : 0) + (lifted ? 0.08 : 0) + float;
      layer.group.position.y = THREE.MathUtils.lerp(layer.group.position.y, target, ease);
      layer.group.rotation.y = THREE.MathUtils.lerp(layer.group.rotation.y, layer.baseRotation + (active ? 0.025 : 0), ease);
      layer.group.position.x = THREE.MathUtils.lerp(layer.group.position.x, layer.baseX + (active ? 0.26 : 0), ease);
      layer.group.position.z = THREE.MathUtils.lerp(layer.group.position.z, layer.baseZ + (active ? 0.14 : 0), ease);
      layer.face.emissive.setHex(active ? 0x63458f : 0x000000);
      layer.face.emissiveIntensity = active ? 0.07 : 0;
      layer.outlineMaterial.opacity = active ? 0.95 : lifted ? 0.7 : 0.38;
      if (index > 0) layer.face.transmission = THREE.MathUtils.lerp(layer.face.transmission, active ? 0.88 : 0.96, ease);
    });
    foundation.visible = shadow.visible = true;
    layers.forEach(layer => layer.group.updateMatrix());
    links.forEach(link => {
      link.line.visible = true;
      link.pulse.visible = !exploring;
      link.start.copy(link.anchor).applyMatrix4(layers[link.index].group.matrix);
      link.end.copy(link.anchor).applyMatrix4(layers[link.index + 1].group.matrix);
      direction.subVectors(link.end, link.start);
      link.line.position.copy(link.start).add(link.end).multiplyScalar(0.5);
      link.line.scale.y = direction.length();
      link.line.quaternion.setFromUnitVectors(up, direction.normalize());
      const progress = (elapsed * 0.38 + link.index * 0.23 + link.port * 0.5) % 1;
      link.pulse.position.lerpVectors(link.start, link.end, progress);
    });
    renderer.render(scene, camera);
    if (moving && intersecting && !document.hidden) frame = requestAnimationFrame(draw);
  }
  function requestDraw() {
    if (!frame && !disposed && !contextLost && intersecting && !document.hidden) frame = requestAnimationFrame(draw);
  }
  const resize = () => {
    const width = host.querySelector('.scene-canvas').clientWidth;
    const height = host.querySelector('.scene-canvas').clientHeight;
    if (!width || !height) return;
    const aspect = width / height;
    const halfHeight = Math.max(3.85, 3.05 / aspect);
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
    buttons.forEach(link => link.classList.toggle('is-active', Number(link.dataset.layer) === (hovered >= 0 ? hovered : selected)));
    canvas.style.cursor = hovered >= 0 ? 'pointer' : 'default';
    if (paused) draw(0, true);
  };
  const onEnter = () => { entered = true; if (paused) draw(0, true); else requestDraw(); };
  const resetPointer = () => { entered = false; pointer.set(0, 0); hovered = -1; if (paused) draw(0, true); };
  const onCanvasClick = event => {
    const bounds = canvas.getBoundingClientRect();
    const position = new THREE.Vector2((event.clientX - bounds.left) / bounds.width * 2 - 1, -((event.clientY - bounds.top) / bounds.height * 2 - 1));
    raycaster.setFromCamera(position, camera);
    const hit = raycaster.intersectObjects(pickable)[0];
    if (hit) buttons.find(button => Number(button.dataset.layer) === hit.object.userData.layer)?.click();
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
    host.classList.remove('scene-ready'); toggle.hidden = true;
    host.dataset.sceneState = 'fallback';
  };
  const onContextRestored = () => {
    contextLost = false; previous = 0;
    draw(0, true); host.classList.add('scene-ready');
    controls.hidden = toggle.hidden = false; host.dataset.sceneState = 'ready';
    requestDraw();
  };
  canvas.addEventListener('pointermove', onPointer);
  canvas.addEventListener('pointerenter', onEnter);
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
  resizeObserver.observe(host.querySelector('.scene-canvas')); visibilityObserver.observe(host);
  requestDraw();

  return () => {
    disposed = true; cancelAnimationFrame(frame);
    resizeObserver.disconnect(); visibilityObserver.disconnect();
    window.removeEventListener('scroll', onScroll);
    document.removeEventListener('visibilitychange', visibility);
    motionPreference.removeEventListener('change', onMotionChange);
    toggle.removeEventListener('click', setPaused);
    host.removeEventListener('architecture-view-change', onViewChange);
    canvas.removeEventListener('pointermove', onPointer);
    canvas.removeEventListener('pointerenter', onEnter);
    canvas.removeEventListener('pointerleave', resetPointer);
    canvas.removeEventListener('click', onCanvasClick);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    canvas.removeEventListener('webglcontextrestored', onContextRestored);
    resources.forEach(resource => resource.dispose());
    key.shadow.dispose(); renderer.dispose(); canvas.remove();
    host.classList.remove('scene-ready'); toggle.hidden = true;
    host.dataset.sceneState = 'fallback';
  };
}
