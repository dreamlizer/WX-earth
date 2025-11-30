import { makeCountryColliders } from './layers.js'

export function createColliderManager(ctx){
  const { THREE, globeGroup } = ctx
  let group = null
  function build(features){
    try { group = makeCountryColliders(THREE, globeGroup, features) } catch(_){ group = null }
    return group
  }
  function getGroup(){ return group }
  function dispose(){ try { if (!group) return; globeGroup.remove(group); group.traverse(o=>{ o.geometry?.dispose?.(); o.material?.dispose?.(); }); group = null } catch(_){ } }
  return { build, getGroup, dispose }
}