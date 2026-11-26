/* Spacecraft models for the journey (NASA 3D Resources), loaded in the background.
   loadSpacecraft() hands the scene a centred, scaled holder group once per quality tier: a light 'preview' first,
   then (where available) a 'detail' model that replaces it. The scene adds the holder to its pivot, removes the
   previous tier's holder, and disposes it with disposeTree().
   Contract (keep it stable, the scene depends on it): the holder's bounding box is centred on the origin and its
   largest dimension equals `span`; materials are MeshStandardMaterial / MeshPhysicalMaterial. */
import * as THREE from 'three'
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export type Tier = 'preview' | 'detail'
export type SpacecraftKind = 'iss' | 'voyager'

const BASE = import.meta.env.BASE_URL

/** files per tier, in load order */
const FILES: Record<SpacecraftKind, { tier: Tier; file: string }[]> = {
  iss: [{ tier: 'preview', file: 'iss.glb' }],
  voyager: [{ tier: 'preview', file: 'voyager.glb' }],
}

/** Prepare a loader (the decoders the model files need). Called once by the scene. */
export function setupLoader(loader: GLTFLoader) {
  void loader
}

function fit(root: THREE.Object3D, span: number) {
  const box = new THREE.Box3().setFromObject(root)
  const size = box.getSize(new THREE.Vector3())
  const c = box.getCenter(new THREE.Vector3())
  root.position.sub(c)
  const holder = new THREE.Group()
  holder.add(root)
  holder.scale.setScalar(span / Math.max(size.x, size.y, size.z))
  return holder
}

/** Loads each tier in turn; `onModel` gets every tier that loads. Returns a cancel function. */
export function loadSpacecraft(loader: GLTFLoader, kind: SpacecraftKind, span: number, onModel: (holder: THREE.Group, tier: Tier) => void) {
  let cancelled = false
  ;(async () => {
    for (const { tier, file } of FILES[kind]) {
      try {
        const g = await loader.loadAsync(BASE + 'journey/' + file)
        if (cancelled) return disposeTree(g.scene)
        onModel(fit(g.scene, span), tier)
      } catch {
        /* the journey runs without this tier */
      }
    }
  })()
  return () => {
    cancelled = true
  }
}

/** Free a model's GPU resources (geometries, materials, textures). */
export function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    m.geometry?.dispose()
    const mats = Array.isArray(m.material) ? m.material : [m.material]
    for (const mt of mats) {
      for (const v of Object.values(mt)) if (v instanceof THREE.Texture) v.dispose()
      mt.dispose()
    }
  })
}
