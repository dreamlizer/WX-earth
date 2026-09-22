const require = createRequire(path.resolve(process.argv[2], 'package.json'));
const {NodeIO} = await import(require.resolve('@gltf-transform/core'));
const {ALL_EXTENSIONS} = await import(require.resolve('@gltf-transform/extensions'));
const {flatten,join,weld,simplify,prune} = await import(require.resolve('@gltf-transform/functions'));
const draco = require('draco3dgltf');
const {MeshoptSimplifier} = require('meshoptimizer');
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder':await draco.createDecoderModule()});
await MeshoptSimplifier.ready;
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
for (const [name,file] of [['lander','apollo-lunar-module-nasa/Apollo Lunar Module.glb'],['eva00','eva-units-github-juan-hernandez/eva00.glb']]) {
 const doc=await io.read(root+'/source-models/'+file);
 doc.getRoot().listAnimations().forEach(a=>a.dispose());
 await doc.transform(flatten(),join(),weld());
 if(name==='lander') await doc.transform(simplify({simplifier:MeshoptSimplifier,ratio:0.18,error:0.01}));
 await doc.transform(prune());
 doc.getRoot().listExtensionsUsed().filter(e=>e.extensionName==='KHR_draco_mesh_compression').forEach(e=>e.dispose());
 await io.write(path.join(process.argv[2],name+'.glb'),doc);
 console.log(name,doc.getRoot().listMeshes().flatMap(m=>m.listPrimitives()).reduce((n,p)=>n+p.getIndices().getCount()/3,0));
}
