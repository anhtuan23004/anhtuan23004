import * as THREE from './assets/vendor/three/three.module.js';
import { createCrystal } from './crystal.js';

export function mountScene(host) {
  const container = host.querySelector('.scene-canvas');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgl2', { antialias: true, alpha: true, powerPreference: 'low-power' });
  if (!context) { host.dataset.sceneState = 'fallback'; return () => {}; }
  const renderer = new THREE.WebGLRenderer({canvas,context,antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-3,3,3,-3,.1,30);
  camera.position.set(0,0,9);
  const resources = new Set();
  const own = item => { resources.add(item); return item; };
  // Transparent pixels expose the page background in both themes.
  renderer.setClearColor(0x000000,0);
  scene.background = null;
  // Both reflection environments are built once; switching theme reuses them.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environments = {}, opticalEnvironments = {};
  for (const theme of ['light','dark']) {
    const studio = document.createElement('canvas'); studio.width=512; studio.height=256;
    const ctx=studio.getContext('2d');
    const gradient=ctx.createLinearGradient(0,0,0,256);
    const tones=theme==='dark' ? ['#8295a6','#34495d','#e2e6ed'] : ['#efeeeb','#c0c8d5','#f6f5f3'];
    [0,.48,1].forEach((offset,i)=>gradient.addColorStop(offset,tones[i]));
    ctx.fillStyle=gradient; ctx.fillRect(0,0,512,256);
    function panel(x,y,w,h,stops) {
      const fill=ctx.createLinearGradient(x,y,x+w,y+h);
      stops.forEach(([offset,color])=>fill.addColorStop(offset,color));
      ctx.fillStyle=fill;ctx.fillRect(x,y,w,h);
    }
    panel(35,25,62,170,[[0,'#ffffff'],[.7,'#ffffff'],[1,'#ccd7e9']]);
    panel(108,60,16,160,[[0,'#5a6b85'],[1,'#162d4b']]);
    panel(145,110,115,90,[[0,'#fffff5'],[.2,'#efcc8f'],[.42,'#c4a9dc'],[.62,'#609fdc'],[.8,'#9dcddc'],[1,'#faf9ef']]);
    panel(288,20,100,32,[[0,'#ffffff'],[1,'#ffffff']]);
    panel(330,100,58,115,[[0,'#dcefff'],[.35,'#89b8e7'],[.6,'#637ac5'],[1,'#d4c1df']]);
    panel(423,35,27,150,[[0,'#9caec4'],[.5,'#263d60'],[1,'#4c6788']]);
    panel(450,185,55,24,[[0,'#fff3ce'],[1,'#eacb92']]);
    const texture=own(new THREE.CanvasTexture(studio));texture.colorSpace=THREE.SRGBColorSpace;
    texture.mapping=THREE.EquirectangularReflectionMapping;
    opticalEnvironments[theme]=texture;
    environments[theme]=own(pmrem.fromEquirectangular(texture));
  }
  pmrem.dispose();
  const hemisphere=new THREE.HemisphereLight(0xffffff,0x506773,1.4);scene.add(hemisphere);
  const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(-3,4,5);scene.add(key);
  const rim=new THREE.PointLight(0xb8e4f4,12);rim.position.set(2,-1,3);scene.add(rim);
  const coreGroup=new THREE.Group();scene.add(coreGroup);
  const crystal=createCrystal(coreGroup,own,opticalEnvironments);
  const shards=crystal.shards;
  coreGroup.rotation.set(.16,.1,-.12);
  const ringMaterial=own(new THREE.MeshPhysicalMaterial({color:0x829da8,metalness:.55,roughness:.16,transmission:.3,thickness:.15,clearcoat:1}));
  function ring(rx,ry,rotation,depth,period,tilt,phase) {
    const points=Array.from({length:129},(_,i)=>{const t=i/128*Math.PI*2;return new THREE.Vector3(rx*Math.cos(t),ry*Math.sin(t),depth*Math.sin(t));});
    const mesh=new THREE.Mesh(own(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points,true),160,.011,8,true)),ringMaterial);
    mesh.rotation.z=rotation;scene.add(mesh);
    return {mesh,rotation,speed:Math.PI*2/period,tilt,phase};
  }
  const orbits=[ring(2.35,1.55,.5,.85,90,.12,0),ring(2.52,1.38,.5,-.7,-78,.16,1.7),ring(2.15,1.65,-.45,.55,66,.1,3.4)];
  const links=[...host.querySelectorAll('.architecture-link')],nodes=[];
  const hues=[0x7397b5,0x80a89a,0x9491b2,0xb09b7b],angles=[5.06,3.49,1.92,.35];
  const sphereGeometry=own(new THREE.SphereGeometry(.145,32,24));
  for(let index=0;index<4;index++) {
    const node=new THREE.Mesh(sphereGeometry,own(new THREE.MeshPhysicalMaterial({color:hues[index],metalness:.2,roughness:.07,transmission:.5,thickness:.45,clearcoat:1,emissive:hues[index],emissiveIntensity:.1})));scene.add(node);
    const halo=new THREE.Mesh(own(new THREE.TorusGeometry(.23,.007,6,48)),own(new THREE.MeshBasicMaterial({color:hues[index],transparent:true,opacity:.4})));scene.add(halo);
    nodes.push({node,halo,link:links.find(link=>Number(link.dataset.layer)===index)});
  }
  container.append(canvas);host.classList.add('scene-ready');host.dataset.sceneState='ready';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let paused=false,visible=true,lost=false,frame=0,previous=0,elapsed=0,width=1,height=1,settleUntil=0,cycleStart=0,orbitTime=0,held=false,spreadValue=0,heldPointer=null,press=null,holdTimer=0;
  let hoveredSatellite=-1;
  const projected=new THREE.Vector3(),target=new THREE.Vector3();
  function applySceneTheme() {
    const dark=document.documentElement.dataset.theme==='dark';
    scene.environment=environments[dark?'dark':'light'].texture;
    crystal.setTheme(dark);
    ringMaterial.color.setHex(dark?0xb5d5df:0x829da8);
    hemisphere.groundColor.setHex(dark?0x172d39:0x506773);hemisphere.intensity=dark?1.1:1.4;
    key.intensity=dark?2.5:3;rim.intensity=dark?18:12;renderer.toneMappingExposure=dark?1.08:1;
    requestDraw();
  }
  const themeObserver=new MutationObserver(applySceneTheme);
  themeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  function draw(now=0) {
    frame=0;if(lost)return;
    const delta=previous?Math.min((now-previous)/1000,.05):0;previous=now;
    if(!paused&&!reduced.matches)elapsed+=delta;
    const selected=Number(host.dataset.layer),opening=host.dataset.opening==='true'&&selected>=0;
    if(!paused&&!reduced.matches&&selected<0&&hoveredSatellite<0&&!press)orbitTime+=delta;
    orbits.forEach(({mesh,rotation,speed,tilt,phase})=>{
      const angle=orbitTime*speed;
      mesh.rotation.set(tilt*(Math.sin(angle+phase)-Math.sin(phase)),tilt*.7*(Math.cos(angle+phase)-Math.cos(phase)),rotation+angle);
    });
    nodes.forEach(({node,halo},index)=>{const angle=angles[index]+orbitTime*.14;
      node.position.set(2.35*Math.cos(angle),1.55*Math.sin(angle),.85*Math.sin(angle)).applyEuler(orbits[0].mesh.rotation);
      node.rotation.y=elapsed*.4;halo.position.copy(node.position);});
    target.set(0,0,0);if(opening)target.copy(nodes[selected].node.position).multiplyScalar(.7);
    const ease=reduced.matches?1:1-Math.exp(-delta*12);
    camera.position.x=THREE.MathUtils.lerp(camera.position.x,target.x,ease);
    camera.position.y=THREE.MathUtils.lerp(camera.position.y,target.y,ease);
    camera.zoom=THREE.MathUtils.lerp(camera.zoom,opening?1.8:selected>=0?1.025:1,ease);
    camera.updateProjectionMatrix();camera.updateMatrixWorld();coreGroup.rotation.y=.1+elapsed*.06;
    coreGroup.scale.setScalar(1.08);
    const phase=(elapsed-cycleStart)%9;
    const smooth=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};
    let spread=phase<2.6?0:phase<4.1?smooth((phase-2.6)/1.5):phase<5?1:phase<7.2?1-smooth((phase-5)/2.2):0;
    if(held)spread=1;if(reduced.matches)spread=.14;if(opening)spread=Math.max(spread,.8);
    spreadValue=THREE.MathUtils.lerp(spreadValue,spread,reduced.matches?1:1-Math.exp(-delta*9));
    shards.forEach(({mesh,center,direction,axis,turn,travel})=>{mesh.position.copy(center).addScaledVector(direction,spreadValue*travel);mesh.quaternion.setFromAxisAngle(axis,spreadValue*turn);});
    nodes.forEach(({node,halo,link},index)=>{const active=index===(selected>=0?selected:hoveredSatellite);
      node.scale.setScalar(active?1.4:1);node.material.emissiveIntensity=active?.65:.12;
      halo.scale.setScalar(active?1.25:1);halo.material.opacity=active?.8:.25;
      projected.copy(node.position).project(camera);
      const margin=width<=600?38:42;
      const distance=Math.max(Math.hypot(projected.x,projected.y),.001);
      // Keep each label outside its satellite, following the orbit without covering the glass.
      const offsetX=projected.x/distance*(width<=600?54:60);
      const offsetY=-projected.y/distance*38;
      link.style.left=`${THREE.MathUtils.clamp((projected.x*.5+.5)*width+offsetX,margin,width-margin)}px`;
      link.style.top=`${THREE.MathUtils.clamp((-projected.y*.5+.5)*height+offsetY,24,height-24)}px`;
    });
    crystal.updateOptics(camera);
    renderer.render(scene,camera);
    if(visible&&!document.hidden&&!lost&&((!paused&&!reduced.matches)||(!reduced.matches&&now<settleUntil)))frame=requestAnimationFrame(draw);
  }
  function requestDraw(){if(!frame&&!lost)frame=requestAnimationFrame(draw);}
  const blockedClicks=new WeakSet();
  const HOLD_DELAY=220;
  function releaseHold(){
    clearTimeout(holdTimer);holdTimer=0;
    const gesture=press;press=null;
    const wasHeld=held;held=false;
    if(wasHeld)cycleStart=elapsed;
    host.classList.remove('is-glass-held');
    heldPointer=null;
    if(gesture&&gesture.surface.hasPointerCapture(gesture.pointerId))
      gesture.surface.releasePointerCapture(gesture.pointerId);
    settleUntil=performance.now()+1200;requestDraw();
  }
  function activateHold(){
    if(!press||reduced.matches)return;
    held=true;
    if(press.surface!==canvas)blockedClicks.add(press.surface);
    host.classList.add('is-glass-held');
    settleUntil=performance.now()+1200;requestDraw();
  }
  function startPress(event,surface,satellite=null){
    if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||host.dataset.opening==='true')return;
    releaseHold();
    blockedClicks.delete(surface);
    press={surface,pointerId:event.pointerId,satellite,x:event.clientX,y:event.clientY,started:performance.now()};
    heldPointer=event.pointerId;
    surface.setPointerCapture(event.pointerId);
    // The core has no navigation; satellite presses distinguish a tap from a hold.
    if(satellite===null&&!reduced.matches)activateHold();
    else if(!reduced.matches)holdTimer=setTimeout(activateHold,HOLD_DELAY);
    requestDraw();
  }
  function endPress(event){
    if(!press||event.pointerId!==press.pointerId)return;
    const gesture=press,wasHeld=held||(press.satellite!==null&&performance.now()-press.started>=HOLD_DELAY);
    if(wasHeld&&gesture.surface!==canvas)blockedClicks.add(gesture.surface);
    if(event.type!=='pointerup'&&gesture.surface!==canvas)blockedClicks.add(gesture.surface);
    const openSatellite=event.type==='pointerup'&&!wasHeld&&gesture.surface===canvas&&gesture.satellite!==null;
    releaseHold();
    if(openSatellite)nodes[gesture.satellite].link.click();
  }
  function movePress(event){
    if(!press||held||event.pointerId!==press.pointerId)return;
    if(Math.hypot(event.clientX-press.x,event.clientY-press.y)>12){
      if(press.surface!==canvas)blockedClicks.add(press.surface);
      releaseHold();
    }
  }
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),glassBounds=new THREE.Sphere(new THREE.Vector3(),1.2);
  function satelliteAt(event){
    const bounds=canvas.getBoundingClientRect();
    pointer.set((event.clientX-bounds.left)/bounds.width*2-1,-(event.clientY-bounds.top)/bounds.height*2+1);
    raycaster.setFromCamera(pointer,camera);
    scene.updateMatrixWorld(true);
    const hit=raycaster.intersectObjects(nodes.map(({node})=>node),false)[0];
    return hit?nodes.findIndex(({node})=>node===hit.object):-1;
  }
  canvas.addEventListener('pointermove',event=>{
    if(press||event.pointerType==='touch')return;
    const next=satelliteAt(event);
    if(next!==hoveredSatellite){hoveredSatellite=next;canvas.style.cursor=next>=0?'pointer':'';requestDraw();}
  });
  canvas.addEventListener('pointerleave',()=>{hoveredSatellite=-1;canvas.style.cursor='';requestDraw();});
  canvas.addEventListener('pointerdown',event=>{
    const satellite=satelliteAt(event);
    if(satellite>=0){startPress(event,canvas,satellite);return;}
    glassBounds.radius=1.3+spreadValue*.7;
    if(raycaster.ray.intersectsSphere(glassBounds))startPress(event,canvas);
  });
  for(const surface of [canvas,...links]){
    if(surface!==canvas)surface.addEventListener('pointerdown',event=>startPress(event,surface,Number(surface.dataset.layer)));
    ['pointerup','pointercancel','lostpointercapture'].forEach(type=>surface.addEventListener(type,endPress));
    surface.addEventListener('pointermove',movePress);
    surface.addEventListener('contextmenu',event=>{if(held)event.preventDefault();});
    if(surface!==canvas)surface.addEventListener('click',event=>{
      if(blockedClicks.has(surface)&&event.detail>0){
        blockedClicks.delete(surface);event.preventDefault();event.stopImmediatePropagation();
      }
    },true);
  }
  window.addEventListener('blur',releaseHold);
  reduced.addEventListener('change',()=>{releaseHold();requestDraw();});
  host.addEventListener('architecture-view-change',()=>{settleUntil=performance.now()+700;requestDraw();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseHold();previous=0;if(!document.hidden)requestDraw();});
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;previous=0;if(visible)requestDraw();else{cancelAnimationFrame(frame);frame=0;}});observer.observe(host);
  function resize(){width=container.clientWidth;height=container.clientHeight;renderer.setSize(width,height,false);
    const halfHeight=Math.max(2.55,2.7/(width/height));camera.left=-halfHeight*width/height;camera.right=-camera.left;camera.top=halfHeight;camera.bottom=-halfHeight;camera.updateProjectionMatrix();requestDraw();}
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(container);
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();releaseHold();lost=true;cancelAnimationFrame(frame);frame=0;host.classList.remove('scene-ready');host.dataset.sceneState='fallback';});
  canvas.addEventListener('webglcontextrestored',()=>{lost=false;host.classList.add('scene-ready');host.dataset.sceneState='ready';applySceneTheme();requestDraw();});
  applySceneTheme();resize();
  return()=>{releaseHold();cancelAnimationFrame(frame);observer.disconnect();resizeObserver.disconnect();themeObserver.disconnect();renderer.dispose();resources.forEach(item=>item.dispose());canvas.remove();};
}
