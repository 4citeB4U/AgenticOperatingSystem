export type CadFeature = {
  id: string;
  kind: 'Sketch' | 'Extrude' | 'Revolve' | 'Boolean' | 'Fillet' | 'SketchLine';
  params: Record<string, any>;
  dependsOn?: string[];
};

export type CadModel = {
  id: string;
  name?: string;
  features: CadFeature[];
  createdTs: number;
};

export function createEmptyModel(name?: string): CadModel {
  return { id: Date.now().toString(), name, features: [], createdTs: Date.now() };
}

export function addFeature(model: CadModel, feature: CadFeature) {
  model.features.push(feature);
  return feature.id;
}

// Very small mesh builder: supports extruding a 2D rectangle into a box
export function buildMeshFromModel(model: CadModel) {
  // find an Extrude with params {w,h,d} or fall back to unit cube
  const extrude = model.features.find(f => f.kind === 'Extrude');
  const w = extrude?.params?.w ?? 1;
  const h = extrude?.params?.h ?? 1;
  const d = extrude?.params?.d ?? 1;
  // create 8 vertices
  const verts = [
    [-w/2,-d/2,0], [w/2,-d/2,0], [w/2,d/2,0], [-w/2,d/2,0],
    [-w/2,-d/2,h], [w/2,-d/2,h], [w/2,d/2,h], [-w/2,d/2,h]
  ];
  const tris = [
    [0,1,2],[0,2,3], // bottom
    [4,6,5],[4,7,6], // top
    [0,4,5],[0,5,1], // front
    [1,5,6],[1,6,2],
    [2,6,7],[2,7,3],
    [3,7,4],[3,4,0]
  ];
  return { verts, tris };
}

export function exportSTLAscii(mesh: { verts: number[][]; tris: number[][] }, name = 'model') {
  let out = `solid ${name}\n`;
  for (const t of mesh.tris) {
    const a = mesh.verts[t[0]];
    const b = mesh.verts[t[1]];
    const c = mesh.verts[t[2]];
    // naive normal
    const ux = b[0]-a[0], uy = b[1]-a[1], uz = b[2]-a[2];
    const vx = c[0]-a[0], vy = c[1]-a[1], vz = c[2]-a[2];
    const nx = uy*vz - uz*vy; const ny = uz*vx - ux*vz; const nz = ux*vy - uy*vx;
    out += ` facet normal ${nx} ${ny} ${nz}\n  outer loop\n`;
    out += `   vertex ${a[0]} ${a[1]} ${a[2]}\n`;
    out += `   vertex ${b[0]} ${b[1]} ${b[2]}\n`;
    out += `   vertex ${c[0]} ${c[1]} ${c[2]}\n`;
    out += `  endloop\n endfacet\n`;
  }
  out += `endsolid ${name}\n`;
  return out;
}

export const createParametricCad = () => ({ createEmptyModel, addFeature, buildMeshFromModel, exportSTLAscii });
