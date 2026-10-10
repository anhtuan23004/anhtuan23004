import * as THREE from './assets/vendor/three/three.module.js';

const MAX_PLANES = 80;
const vertexShader = `
  varying vec3 localPosition;
  varying vec3 localNormal;
  varying float bevelFace;
  attribute float bevel;
  void main() {
    localPosition = position;
    localNormal = normal;
    bevelFace = bevel;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const fragmentShader = `
  uniform sampler2D opticalEnvironment;
  uniform vec4 planes[${MAX_PLANES}];
  uniform int planeCount;
  uniform vec3 localCamera;
  uniform mat3 localToWorld;
  varying vec3 localPosition;
  varying vec3 localNormal;
  varying float bevelFace;
  const float PI = 3.14159265359;
  vec3 studio(vec3 direction) {
    vec3 d = normalize(localToWorld * direction);
    vec2 uv = vec2(atan(d.z, d.x) / (2.0 * PI) + .5, acos(clamp(d.y, -1.0, 1.0)) / PI);
    vec3 light = texture2D(opticalEnvironment, uv).rgb;
    float window = smoothstep(.65, .92, max(light.r, max(light.g, light.b)));
    return light * (1.0 + window * 1.7);
  }
  // Find the exit through the actual convex volume of this glass fragment.
  void exitSurface(vec3 origin, vec3 direction, out vec3 point, out vec3 normal) {
    float nearest = 10000.0;
    normal = normalize(direction);
    for (int i = 0; i < ${MAX_PLANES}; i++) {
      if (i >= planeCount) break;
      float denominator = dot(planes[i].xyz, direction);
      if (denominator > .00001) {
        float distance = (planes[i].w - dot(planes[i].xyz, origin)) / denominator;
        if (distance > .00001 && distance < nearest) {
          nearest = distance;
          normal = planes[i].xyz;
        }
      }
    }
    point = origin + direction * min(nearest, 5.0);
  }
  vec3 transmitted(vec3 incoming, vec3 normal, float ior) {
    vec3 ray = refract(incoming, normal, 1.0 / ior);
    vec3 exitPoint, exitNormal;
    exitSurface(localPosition + ray * .0005, ray, exitPoint, exitNormal);
    vec3 outgoing = refract(ray, -exitNormal, ior);
    if (dot(outgoing, outgoing) < .001) {
      // One internal bounce keeps the crystal's sharp light/dark facets.
      ray = reflect(ray, exitNormal);
      exitSurface(exitPoint + ray * .0005, ray, exitPoint, exitNormal);
      outgoing = refract(ray, -exitNormal, ior);
      if (dot(outgoing, outgoing) < .001) outgoing = reflect(ray, exitNormal);
    }
    return studio(outgoing);
  }
  void main() {
    // Slightly bowed optical faces create smooth lens-like reflections,
    // while the volume retains the reference's large cut planes.
    vec3 normal = normalize(localNormal + normalize(localPosition) * .24);
    vec3 view = normalize(localCamera - localPosition);
    vec3 incoming = -view;
    vec3 red = transmitted(incoming, normal, 1.48);
    vec3 green = transmitted(incoming, normal, 1.50);
    vec3 blue = transmitted(incoming, normal, 1.52);
    vec3 refraction = vec3(red.r, green.g, blue.b);
    vec3 reflection = studio(reflect(incoming, normal));
    float fresnel = .055 + .945 * pow(1.0 - max(dot(view, normal), 0.0), 5.0);
    float reflectionWeight = clamp(fresnel + bevelFace * .22, 0.0, .94);
    vec3 color = mix(refraction, reflection, reflectionWeight);
    // Neutral optical glass: colors come from dispersed studio lighting.
    color = mix(color, vec3(.93, .97, 1.0), .045);
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// Clip a convex polyhedron and close its newly exposed cut surface.
function clip(faces, normal, distance, bevel = false) {
  const result = [], cap = [];
  for (const face of faces) {
    const polygon = [];
    for (let i = 0; i < face.points.length; i++) {
      const a = face.points[i], b = face.points[(i + 1) % face.points.length];
      const da = normal.dot(a) - distance, db = normal.dot(b) - distance;
      if (da <= .000001) polygon.push(a);
      if ((da < -.000001 && db > .000001) || (da > .000001 && db < -.000001)) {
        const crossing = a.clone().lerp(b, da / (da - db));
        polygon.push(crossing); cap.push(crossing);
      }
    }
    if (polygon.length >= 3) result.push({ ...face, points: polygon });
  }
  const unique = cap.filter((p, i) => cap.findIndex(q => p.distanceToSquared(q) < 1e-10) === i);
  if (unique.length >= 3) {
    const center = unique.reduce((sum, p) => sum.add(p), new THREE.Vector3()).divideScalar(unique.length);
    const tangent = new THREE.Vector3().crossVectors(normal, Math.abs(normal.y) > .9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize();
    const bitangent = new THREE.Vector3().crossVectors(normal, tangent);
    unique.sort((a, b) => {
      const x = a.clone().sub(center), y = b.clone().sub(center);
      return Math.atan2(x.dot(bitangent), x.dot(tangent)) - Math.atan2(y.dot(bitangent), y.dot(tangent));
    });
    result.push({ points: unique, normal: normal.clone(), distance, bevel });
  }
  return result;
}

export function createCrystal(group, own, opticalEnvironments) {
  const base = own(new THREE.IcosahedronGeometry(1.25, 1));
  const baseFaces = [], positions = base.attributes.position;
  for (let i = 0; i < positions.count; i += 3) {
    const points = [0, 1, 2].map(j => new THREE.Vector3().fromBufferAttribute(positions, i + j));
    const normal = new THREE.Vector3().subVectors(points[1], points[0]).cross(new THREE.Vector3().subVectors(points[2], points[0])).normalize();
    baseFaces.push({ points, normal, distance: normal.dot(points[0]), bevel: false });
  }
  const seeds = Array.from({ length: 13 }, (_, i) => {
    const y = 1 - (i + .5) / 13 * 2, angle = i * 2.399963;
    const radius = .56 + (i % 4) * .085;
    return new THREE.Vector3(Math.cos(angle) * Math.sqrt(1 - y * y), y, Math.sin(angle) * Math.sqrt(1 - y * y)).multiplyScalar(radius);
  });
  const shards = [], materials = [];
  seeds.forEach((seed, index) => {
    let faces = baseFaces;
    seeds.forEach((other, j) => {
      if (j === index) return;
      const normal = other.clone().sub(seed).normalize();
      const distance = (other.lengthSq() - seed.lengthSq()) / (2 * other.distanceTo(seed));
      faces = clip(faces, normal, distance);
    });
    // Bevel the original edges with additional clipping planes.
    const edges = new Map();
    for (const face of faces) for (let i = 0; i < face.points.length; i++) {
      const a = face.points[i], b = face.points[(i + 1) % face.points.length];
      const key = [a, b].map(p => [p.x, p.y, p.z].map(n => n.toFixed(5)).join(',')).sort().join('|');
      const entry = edges.get(key);
      if (entry) {
        const normal = entry.normal.clone().add(face.normal).normalize();
        if (normal.lengthSq() > .1) {
          const middle = a.clone().add(b).multiplyScalar(.5);
          edges.set(key, { normal, distance: normal.dot(middle) - .007, complete: true });
        }
      } else edges.set(key, { normal: face.normal.clone(), complete: false });
    }
    for (const edge of edges.values()) if (edge.complete) faces = clip(faces, edge.normal, edge.distance, true);
    const allPoints = faces.flatMap(face => face.points);
    const center = allPoints.reduce((sum, p) => sum.add(p), new THREE.Vector3()).divideScalar(allPoints.length);
    const coords = [], normals = [], bevels = [];
    for (const face of faces) {
      for (let i = 1; i < face.points.length - 1; i++) {
        for (const p of [face.points[0], face.points[i], face.points[i + 1]]) {
          const local = p.clone().sub(center);
          coords.push(local.x, local.y, local.z); normals.push(face.normal.x, face.normal.y, face.normal.z); bevels.push(face.bevel ? 1 : 0);
        }
      }
    }
    const geometry = own(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(coords, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('bevel', new THREE.Float32BufferAttribute(bevels, 1));
    // The same plane may appear on multiple polygons; keep the optical array compact.
    const planes = [];
    for (const face of faces) {
      const plane = new THREE.Vector4(face.normal.x, face.normal.y, face.normal.z, face.distance - face.normal.dot(center));
      if (!planes.some(p => Math.abs(p.x-plane.x)+Math.abs(p.y-plane.y)+Math.abs(p.z-plane.z)+Math.abs(p.w-plane.w) < .00001)) planes.push(plane);
    }
    if (planes.length > MAX_PLANES) throw new Error('Crystal optical volume exceeds plane capacity');
    const count = planes.length;
    while (planes.length < MAX_PLANES) planes.push(new THREE.Vector4());
    const material = own(new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms: {
      opticalEnvironment: { value: opticalEnvironments.light }, planes: { value: planes }, planeCount: { value: count },
      localCamera: { value: new THREE.Vector3() }, localToWorld: { value: new THREE.Matrix3() }
    }}));
    const mesh = new THREE.Mesh(geometry, material); mesh.position.copy(center); mesh.scale.setScalar(.984); group.add(mesh);
    const axis = new THREE.Vector3(Math.sin(index * 2.3), Math.cos(index * 1.7), Math.sin(index * .9)).normalize();
    const inverse = new THREE.Matrix4();
    materials.push(material);
    shards.push({ mesh, center, direction: center.clone().normalize(), axis, turn: .28 + (index % 5) * .085, travel: .45 + (index % 4) * .08, inverse });
  });
  return {
    shards,
    setTheme(dark) { materials.forEach(material => { material.uniforms.opticalEnvironment.value = opticalEnvironments[dark ? 'dark' : 'light']; }); },
    updateOptics(camera) {
      group.updateWorldMatrix(true, true);
      shards.forEach(({ mesh, inverse }) => {
        inverse.copy(mesh.matrixWorld).invert();
        mesh.material.uniforms.localCamera.value.copy(camera.position).applyMatrix4(inverse);
        mesh.material.uniforms.localToWorld.value.setFromMatrix4(mesh.matrixWorld);
      });
    }
  };
}
