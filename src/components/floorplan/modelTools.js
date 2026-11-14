import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { fileUrl } from './planFiles';

/**
 * 3D 모델(GLB)·사진 상자 도구
 * - 모델은 한 번 읽으면 기억해 두고 비품마다 복사해서 씀 (모양·재질은 같이 씀 → 지우지 않음)
 */

const sceneCache = new Map();
const texCache = new Map();

export { FACE_KEYS, hasFaces } from './planLibrary';

/** GLB 읽기 → three 장면 (같은 주소는 한 번만) */
export function loadModelScene(url) {
  if (!sceneCache.has(url)) {
    const loader = new GLTFLoader();
    const first = fileUrl(url);
    // 사이트 주소로 돌려 읽기가 안 되면 저장소 주소로 바로 한 번 더
    const load = first === url ? loader.loadAsync(url) : loader.loadAsync(first).catch(() => loader.loadAsync(url));
    const p = load.then(gltf => {
      const scene = gltf.scene || gltf.scenes?.[0];
      if (!scene) throw new Error('모델 안에 모양이 없어요.');
      scene.traverse(o => {
        if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.userData.shared = true; }
      });
      return scene;
    });
    p.catch(() => sceneCache.delete(url));
    sceneCache.set(url, p);
  }
  return sceneCache.get(url);
}

/** 사진 상자 면 사진 무늬 */
export function faceTexture(url) {
  if (!texCache.has(url)) {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    const first = fileUrl(url);
    const t = loader.load(first, undefined, undefined, () => {
      if (first === url) return;
      // 사이트 주소로 안 되면 저장소 주소로 바로
      loader.load(url, (img) => { t.image = img.image; t.needsUpdate = true; });
    });
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    texCache.set(url, t);
  }
  return texCache.get(url);
}

/**
 * 모델을 비품 크기(mm)에 맞춰 세우기: 바닥 가운데가 (0,0,0)
 * - h가 있으면 가로·세로·높이를 모두 맞춤, 없으면 비율 그대로 가로·세로 안에 들어가게
 * - rot: 모델 앞쪽이 다를 때 돌리는 각도(도)
 */
export function fitModel(source, { w, d, h, rot = 0 }) {
  const M = 0.001;
  const inner = source.clone(true);
  inner.rotation.y = (-(rot || 0) * Math.PI) / 180;
  const holder = new THREE.Group();
  holder.add(inner);
  holder.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(holder);
  const s = bb.getSize(new THREE.Vector3());
  if (s.x <= 0 || s.z <= 0) return holder;
  let sx; let sy; let sz;
  if (h) { sx = (w * M) / s.x; sz = (d * M) / s.z; sy = (h * M) / Math.max(s.y, 1e-6); } else {
    const k = Math.min((w * M) / s.x, (d * M) / s.z);
    sx = k; sy = k; sz = k;
  }
  holder.scale.set(sx, sy, sz);
  holder.updateMatrixWorld(true);
  const bb2 = new THREE.Box3().setFromObject(holder);
  const c = bb2.getCenter(new THREE.Vector3());
  const outer = new THREE.Group();
  holder.position.set(-c.x, -bb2.min.y, -c.z);
  outer.add(holder);
  return outer;
}

/**
 * 모델 살펴보기: 원래 크기(mm)와 위에서 본 그림(2D 배치도용)
 * - GLB는 보통 m 단위. 50m가 넘으면 mm로 만든 파일로 봄
 */
export async function analyzeModel(url, rot = 0) {
  const src = await loadModelScene(url);
  const obj = src.clone(true);
  obj.rotation.y = (-(rot || 0) * Math.PI) / 180;
  const holder = new THREE.Group(); holder.add(obj); holder.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(holder);
  const s = bb.getSize(new THREE.Vector3());
  const unit = Math.max(s.x, s.y, s.z) > 50 ? 1 : 1000;
  const dims = { w: Math.round(s.x * unit), d: Math.round(s.z * unit), h: Math.round(s.y * unit) };

  // 위에서 본 그림 (바탕 투명)
  let top = null;
  let renderer = null;
  try {
    const side = 512;
    const ratio = s.x / Math.max(s.z, 1e-6);
    const cw = ratio >= 1 ? side : Math.max(32, Math.round(side * ratio));
    const ch = ratio >= 1 ? Math.max(32, Math.round(side / ratio)) : side;
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(cw, ch);
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    scene.add(holder);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 1.4));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(1, 3, 2); scene.add(sun);
    const c = bb.getCenter(new THREE.Vector3());
    const cam = new THREE.OrthographicCamera(-s.x / 2, s.x / 2, s.z / 2, -s.z / 2, 0.01, s.y * 4 + 10);
    cam.up.set(0, 0, -1);
    cam.position.set(c.x, bb.max.y + 1, c.z);
    cam.lookAt(c.x, bb.min.y, c.z);
    renderer.render(scene, cam);
    top = renderer.domElement.toDataURL('image/webp', 0.85);
    if (!top.startsWith('data:image/webp') || top.length > 160 * 1024) top = renderer.domElement.toDataURL('image/png');
    if (top.length > 200 * 1024) top = null;
  } catch {
    top = null;
  } finally {
    if (renderer) { renderer.dispose(); renderer.forceContextLoss?.(); }
  }
  return { ...dims, top };
}
