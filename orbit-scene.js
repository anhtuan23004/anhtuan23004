import * as THREE from './assets/vendor/three/three.module.js';

export function mountScene(host) {
  const container = host.querySelector('.scene-canvas');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgl2', { antialias: true, powerPreference: 'low-power' });
  if (!context) { host.dataset.sceneState = 'fallback'; return () => {}; }
  const renderer = new THREE.WebGLRenderer({canvas,context,antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-3,3,3,-3,.1,30);
  camera.position.set(0,0,9);
  const resources = new Set();
  const own = item => { resources.add(item); return item; };
  const backdrop = document.createElement('canvas'); backdrop.width = backdrop.height = 512;
  const paint = backdrop.getContext('2d');
  scene.background = own(new THREE.CanvasTexture(backdrop));
  scene.background.colorSpace = THREE.SRGBColorSpace;
  // Both reflection environments are built once; switching theme reuses them.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environments = {};
  for (const theme of ['light','dark']) {
    const studio = document.createElement('canvas'); studio.width=512; studio.height=256;
    const ctx=studio.getContext('2d');
    const gradient=ctx.createLinearGradient(0,0,0,256);
    const tones=theme==='dark' ? ['#648593','#152630','#627c89'] : ['#829da9','#223e4d','#6d8d9a'];
    [0,.48,1].forEach((offset,i)=>gradient.addColorStop(offset,tones[i]));
    ctx.fillStyle=gradient; ctx.fillRect(0,0,512,256);
    function softbox(x,y,w,h,color) { ctx.save();ctx.shadowColor=color;ctx.shadowBlur=20;ctx.fillStyle=color;ctx.fillRect(x,y,w,h);ctx.restore(); }
    softbox(55,28,23,145,'#ffffff');softbox(300,40,105,12,'#ffffff');
    softbox(220,180,120,18,theme==='dark'?'#a3d4e3':'#314f5b');
    const texture=own(new THREE.CanvasTexture(studio));texture.colorSpace=THREE.SRGBColorSpace;
    texture.mapping=THREE.EquirectangularReflectionMapping;
    environments[theme]=own(pmrem.fromEquirectangular(texture));
  }
  pmrem.dispose();
  const hemisphere=new THREE.HemisphereLight(0xffffff,0x506773,1.4);scene.add(hemisphere);
  const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(-3,4,5);scene.add(key);
  const rim=new THREE.PointLight(0xb8e4f4,12);rim.position.set(2,-1,3);scene.add(rim);
  const coreGroup=new THREE.Group();scene.add(coreGroup);
  const glass=own(new THREE.MeshPhysicalMaterial({color:0xf0fbff,roughness:.015,metalness:0,
    transmission:.92,thickness:.11,ior:1.46,transparent:true,opacity:.48,depthWrite:false,
    attenuationColor:new THREE.Color(0xd0eaf2),attenuationDistance:3,clearcoat:1,
    clearcoatRoughness:.035,envMapIntensity:1.15,dispersion:.045}));
  const fractureMaterial=own(new THREE.LineBasicMaterial({color:0x345f73,transparent:true,opacity:.36}));
  const lattice=own(new THREE.IcosahedronGeometry(1.15,1));
  const latticePosition=lattice.attributes.position;
  const shards=[];
  const subdivisions=4;
  for(let i=0;i<latticePosition.count;i+=3) {
    const corners=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(latticePosition,i+j));
    const center=corners.reduce((sum,v)=>sum.add(v),new THREE.Vector3()).divideScalar(3);
    const direction=center.clone().normalize(),coordinates=[],normals=[];
    const point=(u,v,radius)=>corners[0].clone().multiplyScalar(1-u-v)
      .addScaledVector(corners[1],u).addScaledVector(corners[2],v).lerp(center,.018).normalize().multiplyScalar(radius);
    function triangle(a,b,c,smooth=0) {
      const normal=new THREE.Vector3().subVectors(b,a).cross(new THREE.Vector3().subVectors(c,a)).normalize();
      [a,b,c].forEach(vertex=>{const local=vertex.clone().sub(center);coordinates.push(local.x,local.y,local.z);
        const n=smooth?vertex.clone().normalize().multiplyScalar(smooth):normal;normals.push(n.x,n.y,n.z);});
    }
    function shell(cells) {
      const front=cells.map(([x,y])=>point(x/subdivisions,y/subdivisions,1.15));
      const back=cells.map(([x,y])=>point(x/subdivisions,y/subdivisions,1.04));
      triangle(...front,1);triangle(back[2],back[1],back[0],-1);
    }
    for(let u=0;u<subdivisions;u++)for(let v=0;v<subdivisions-u;v++) {
      shell([[u,v],[u+1,v],[u,v+1]]);
      if(u+v<subdivisions-1)shell([[u+1,v],[u+1,v+1],[u,v+1]]);
    }
    const boundaries=[t=>[t,0],t=>[1-t,t],t=>[0,1-t]],edgePoints=[];
    boundaries.forEach(boundary=>{for(let j=0;j<subdivisions;j++) {
      const [u,v]=boundary(j/subdivisions),[u2,v2]=boundary((j+1)/subdivisions);
      const a=point(u,v,1.15),b=point(u2,v2,1.15),c=point(u,v,1.04),d=point(u2,v2,1.04);
      triangle(a,c,b);triangle(b,c,d);
      edgePoints.push(point(u,v,1.152).sub(center),point(u2,v2,1.152).sub(center));
    }});
    const geometry=own(new THREE.BufferGeometry());
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(coordinates,3));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
    const mesh=new THREE.Mesh(geometry,glass);mesh.position.copy(center);coreGroup.add(mesh);
    mesh.add(new THREE.LineSegments(own(new THREE.BufferGeometry().setFromPoints(edgePoints)),fractureMaterial));
    const seed=i/3,axis=new THREE.Vector3(Math.sin(seed*2.3),Math.cos(seed*1.7),Math.sin(seed*.9)).normalize();
    shards.push({mesh,center,direction,axis,turn:.3+(seed%7)*.08,travel:.48+(seed%5)*.055});
  }
  coreGroup.rotation.set(.16,.1,-.12);
  const ringMaterial=own(new THREE.MeshPhysicalMaterial({color:0x829da8,metalness:.55,roughness:.16,transmission:.3,thickness:.15,clearcoat:1}));
  function ring(rx,ry,rotation,depth) {
    const points=Array.from({length:129},(_,i)=>{const t=i/128*Math.PI*2;return new THREE.Vector3(rx*Math.cos(t),ry*Math.sin(t),depth*Math.sin(t));});
    const mesh=new THREE.Mesh(own(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points,true),160,.011,8,true)),ringMaterial);
    mesh.rotation.z=rotation;scene.add(mesh);
  }
  ring(2.35,1.55,.5,.85);ring(2.52,1.38,.5,-.7);ring(2.15,1.65,-.45,.55);
  const links=[...host.querySelectorAll('.architecture-link')],nodes=[];
  const hues=[0x7397b5,0x80a89a,0x9491b2,0xb09b7b],angles=[5.06,3.49,1.92,.35];
  const sphereGeometry=own(new THREE.SphereGeometry(.145,32,24));
  for(let index=0;index<4;index++) {
    const node=new THREE.Mesh(sphereGeometry,own(new THREE.MeshPhysicalMaterial({color:hues[index],metalness:.2,roughness:.07,transmission:.5,thickness:.45,clearcoat:1,emissive:hues[index],emissiveIntensity:.1})));scene.add(node);
    const halo=new THREE.Mesh(own(new THREE.TorusGeometry(.23,.007,6,48)),own(new THREE.MeshBasicMaterial({color:hues[index],transparent:true,opacity:.4})));scene.add(halo);
    nodes.push({node,halo,link:links.find(link=>Number(link.dataset.layer)===index)});
  }
  container.append(canvas);host.classList.add('scene-ready');host.dataset.sceneState='ready';
  const holdControl=host.querySelector('.orbit-hold');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let paused=false,visible=true,lost=false,frame=0,previous=0,elapsed=0,width=1,height=1,settleUntil=0,cycleStart=0,orbitTime=0,held=false,spreadValue=0,heldPointer=null;
  const projected=new THREE.Vector3(),target=new THREE.Vector3(),orbitAxis=new THREE.Vector3(0,0,1);
  function applySceneTheme() {
    const dark=document.documentElement.dataset.theme==='dark';
    const glow=paint.createRadialGradient(260,250,0,256,256,350);
    const stops=dark?['#243c48','#162731','#0e191f']:['#f7faf9','#e5edef','#d6e0e3'];
    [0,.5,1].forEach((offset,i)=>glow.addColorStop(offset,stops[i]));
    paint.fillStyle=glow;paint.fillRect(0,0,512,512);scene.background.needsUpdate=true;
    scene.environment=environments[dark?'dark':'light'].texture;
    glass.color.setHex(dark?0xdff7ff:0xf0fbff);glass.opacity=dark?.58:.48;
    glass.envMapIntensity=dark?1.55:1.15;
    glass.attenuationColor.setHex(dark?0xa7d7e6:0xd0eaf2);
    fractureMaterial.color.setHex(dark?0xb9e1ed:0x345f73);fractureMaterial.opacity=dark?.48:.36;
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
    if(!paused&&!reduced.matches&&selected<0)orbitTime+=delta;
    nodes.forEach(({node,halo},index)=>{const angle=angles[index]+orbitTime*.14;
      node.position.set(2.35*Math.cos(angle),1.55*Math.sin(angle),.85*Math.sin(angle)).applyAxisAngle(orbitAxis,.5);
      node.rotation.y=elapsed*.4;halo.position.copy(node.position);});
    target.set(0,0,0);if(opening)target.copy(nodes[selected].node.position).multiplyScalar(.7);
    const ease=reduced.matches?1:1-Math.exp(-delta*12);
    camera.position.x=THREE.MathUtils.lerp(camera.position.x,target.x,ease);
    camera.position.y=THREE.MathUtils.lerp(camera.position.y,target.y,ease);
    camera.zoom=THREE.MathUtils.lerp(camera.zoom,opening?1.8:selected>=0?1.025:1,ease);
    camera.updateProjectionMatrix();camera.updateMatrixWorld();coreGroup.rotation.y=.1+elapsed*.06;
    const phase=(elapsed-cycleStart)%9;
    const smooth=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};
    let spread=phase<2.6?0:phase<4.1?smooth((phase-2.6)/1.5):phase<5?1:phase<7.2?1-smooth((phase-5)/2.2):0;
    if(held)spread=1;if(reduced.matches)spread=.12;if(opening)spread=Math.max(spread,.8);
    spreadValue=THREE.MathUtils.lerp(spreadValue,spread,reduced.matches?1:1-Math.exp(-delta*9));
    shards.forEach(({mesh,center,direction,axis,turn,travel})=>{mesh.position.copy(center).addScaledVector(direction,spreadValue*travel);mesh.quaternion.setFromAxisAngle(axis,spreadValue*turn);});
    nodes.forEach(({node,halo,link},index)=>{const active=index===selected;
      node.scale.setScalar(active?1.4:1);node.material.emissiveIntensity=active?.65:.12;
      halo.scale.setScalar(active?1.25:1);halo.material.opacity=active?.8:.25;
      projected.copy(node.position).project(camera);const margin=width<=360?58:68;
      link.style.left=`${THREE.MathUtils.clamp((projected.x*.5+.5)*width,margin,width-margin)}px`;
      link.style.top=`${THREE.MathUtils.clamp((-projected.y*.5+.5)*height-38*Math.tanh(node.position.y*2.5),38,height-38)}px`;
    });
    renderer.render(scene,camera);
    if(visible&&!document.hidden&&!lost&&((!paused&&!reduced.matches)||(!reduced.matches&&now<settleUntil)))frame=requestAnimationFrame(draw);
  }
  function requestDraw(){if(!frame&&!lost)frame=requestAnimationFrame(draw);}
  function releaseHold(){if(!held)return;held=false;cycleStart=elapsed;host.classList.remove('is-glass-held');
    if(heldPointer!==null&&canvas.hasPointerCapture(heldPointer))canvas.releasePointerCapture(heldPointer);
    heldPointer=null;settleUntil=performance.now()+1200;requestDraw();}
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),glassBounds=new THREE.Sphere(new THREE.Vector3(),1.2);
  canvas.addEventListener('pointerdown',event=>{if(event.button!==0||reduced.matches||host.dataset.opening==='true')return;
    const bounds=canvas.getBoundingClientRect();pointer.set((event.clientX-bounds.left)/bounds.width*2-1,-(event.clientY-bounds.top)/bounds.height*2+1);
    raycaster.setFromCamera(pointer,camera);glassBounds.radius=1.2+spreadValue*.65;if(!raycaster.ray.intersectsSphere(glassBounds))return;
    held=true;heldPointer=event.pointerId;host.classList.add('is-glass-held');canvas.setPointerCapture(event.pointerId);settleUntil=performance.now()+1200;requestDraw();});
  ['pointerup','pointercancel','lostpointercapture'].forEach(type=>canvas.addEventListener(type,releaseHold));
  window.addEventListener('blur',releaseHold);
  holdControl.addEventListener('keydown',event=>{if(![' ','Enter'].includes(event.key)||event.repeat||reduced.matches)return;event.preventDefault();held=true;host.classList.add('is-glass-held');settleUntil=performance.now()+1200;requestDraw();});
  holdControl.addEventListener('keyup',event=>{if([' ','Enter'].includes(event.key)){event.preventDefault();releaseHold();}});
  holdControl.addEventListener('blur',releaseHold);
  holdControl.addEventListener('pointerdown',event=>{if(event.button!==0||reduced.matches)return;held=true;host.classList.add('is-glass-held');holdControl.setPointerCapture(event.pointerId);settleUntil=performance.now()+1200;requestDraw();});
  ['pointerup','pointercancel','lostpointercapture'].forEach(type=>holdControl.addEventListener(type,releaseHold));
  function updateHoldControl(){holdControl.hidden=false;holdControl.disabled=reduced.matches;}
  reduced.addEventListener('change',()=>{releaseHold();updateHoldControl();requestDraw();});
  host.addEventListener('architecture-view-change',()=>{settleUntil=performance.now()+700;requestDraw();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseHold();previous=0;if(!document.hidden)requestDraw();});
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;previous=0;if(visible)requestDraw();else{cancelAnimationFrame(frame);frame=0;}});observer.observe(host);
  function resize(){width=container.clientWidth;height=container.clientHeight;renderer.setSize(width,height,false);
    const halfHeight=Math.max(2.8,2.8/(width/height));camera.left=-halfHeight*width/height;camera.right=-camera.left;camera.top=halfHeight;camera.bottom=-halfHeight;camera.updateProjectionMatrix();requestDraw();}
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(container);
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();releaseHold();lost=true;cancelAnimationFrame(frame);frame=0;host.classList.remove('scene-ready');holdControl.hidden=true;host.dataset.sceneState='fallback';});
  canvas.addEventListener('webglcontextrestored',()=>{lost=false;host.classList.add('scene-ready');host.dataset.sceneState='ready';applySceneTheme();updateHoldControl();requestDraw();});
  applySceneTheme();updateHoldControl();resize();
  return()=>{cancelAnimationFrame(frame);observer.disconnect();resizeObserver.disconnect();themeObserver.disconnect();renderer.dispose();resources.forEach(item=>item.dispose());canvas.remove();};
}
