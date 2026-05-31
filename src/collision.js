// ============================================================
//  GAVRIL — One Shift · collision.js
//  Pure circle-vs-AABB push-out so the player can't pass through
//  buildings or cars. `pos` is any {x,z} (THREE.Vector3 works).
//  solids: [{ x, z, hx, hz }] (centre + half-extents).
// ============================================================

export function resolveSolids(pos, r, solids) {
  let pushed = false;
  for (const s of solids) {
    const dx = pos.x - s.x;
    const dz = pos.z - s.z;
    const ox = (s.hx + r) - Math.abs(dx); // x-overlap
    const oz = (s.hz + r) - Math.abs(dz); // z-overlap
    if (ox > 0 && oz > 0) {
      // resolve along the axis of least penetration
      if (ox < oz) pos.x += dx >= 0 ? ox : -ox;
      else pos.z += dz >= 0 ? oz : -oz;
      pushed = true;
    }
  }
  return pushed;
}
