import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { BUILDING_IDS, ROSTER_IDS } from '../../domain/types';
import { EXHIBITS, WINGS } from '../../domain/museum';
import { building, villager, rohld, exhibitModel } from './models';
import { createWorld, routePosition, plotPosition } from './scenes';

function finiteGeometry(root:T.Object3D) {
  root.updateMatrixWorld(true);
  let count=0;
  root.traverse(o=>{if(o instanceof T.Mesh){count++;const p=o.geometry.getAttribute('position');for(let i=0;i<p.array.length;i++)assert.ok(Number.isFinite(p.array[i]));assert.ok(o.material);}});
  assert.ok(count>0);
  const bounds=new T.Box3().setFromObject(root);
  assert.ok(Number.isFinite(bounds.max.x));assert.ok(bounds.max.y>bounds.min.y);
}
test('every saved building, resident and exhibit identifier has finite nonempty 3D geometry',()=>{
  for(const id of BUILDING_IDS)finiteGeometry(building(id));
  ROSTER_IDS.forEach((id,i)=>finiteGeometry(villager(id,i)));
  finiteGeometry(rohld());
  for(const x of EXHIBITS)finiteGeometry(exhibitModel(x.id));
});
test('resident routes stay on plot boundary paths for all supported town sizes',()=>{
  for(let size=4;size<=9;size++)for(const [x,y] of [[0,0],[size-1,size-1]]){
    const origin=plotPosition(x,y,size);
    for(let t=0;t<35;t+=.1){const p=routePosition(t,2,x,y,size);const dx=Math.abs(p.x-origin.x),dz=Math.abs(p.z-origin.z);assert.ok(dx<=.90001&&dz<=.90001);assert.ok(Math.abs(dx-.9)<1e-6||Math.abs(dz-.9)<1e-6);}
  }
});
test('museum galleries only install models for owned exhibits and expose every case for inspection',()=>{
  for(const wing of WINGS){const world=createWorld({kind:'museum',wing:wing.id,owned:[]});const targets:string[]=[];world.root.traverse(o=>{if(o.userData.target)targets.push(o.userData.target);});assert.deepEqual(targets,EXHIBITS.filter(x=>x.wing===wing.id).map(x=>`exhibit:${x.id}`));finiteGeometry(world.root);}
});
test('simultaneous worlds do not share disposable material instances',()=>{
  const a=createWorld({kind:'exhibit',id:'quartz'}),b=createWorld({kind:'exhibit',id:'quartz'});const first=new Set<T.Material>();
  a.root.traverse(o=>{if(o instanceof T.Mesh&&!Array.isArray(o.material))first.add(o.material);});
  b.root.traverse(o=>{if(o instanceof T.Mesh&&!Array.isArray(o.material))assert.ok(!first.has(o.material));});
});
test('town population and plot interaction reflect actual save data, including largest town',()=>{
  const w=createWorld({kind:'town',size:9,buildings:[],residents:ROSTER_IDS.map(id=>({id,movedIn:'2026-10-22'})),season:'winter',rohld:false});
  w.update(800);const plots:string[]=[],residents:string[]=[];w.root.traverse(o=>{const t=o.userData.target;if(t?.startsWith('tile:'))plots.push(t);if(t?.startsWith('resident:'))residents.push(t);});assert.equal(plots.length,81);assert.equal(residents.length,13);finiteGeometry(w.root);
});

test('scroll gestures and absent pointer-down never count as scene taps',async()=>{
  const {isSceneTap,cameraAngle}=await import('./interaction');
  assert.equal(isSceneTap(null,{x:1,y:1}),false);
  assert.equal(isSceneTap({x:50,y:50},{x:51,y:52}),true);
  assert.equal(isSceneTap({x:50,y:50},{x:50,y:70}),false);
  assert.equal(isSceneTap({x:0,y:0},{x:NaN,y:0}),false);
  assert.equal(cameraAngle(9,true),Math.PI/4);
  assert.equal(cameraAngle(-9,true),-Math.PI/4);
  assert.equal(cameraAngle(9,false),9);
});
test('materials remain valid across world updates and paused time is deterministic',()=>{
  const w=createWorld({kind:'town',size:4,buildings:[{id:'home',type:'cottage',x:0,y:0,placedAt:'2026-10-22T12:00:00.000Z'}],residents:[{id:'pip',movedIn:'2026-10-22'}],season:'autumn',rohld:false});
  w.update(12);const p=w.root.children.find(o=>o.userData.target==='resident:pip')!;const pos=p.position.clone();w.update(12);assert.ok(pos.equals(p.position));w.update(14);assert.ok(!pos.equals(p.position));finiteGeometry(w.root);
});

test('Rohld appears as one interactive town visitor only after unlock',()=>{
  const town={kind:'town' as const,size:5,buildings:[],residents:[],season:'spring' as const};
  const locked=createWorld({...town,rohld:false});
  const lockedTargets:string[]=[];locked.root.traverse(o=>{if(o.userData.target)lockedTargets.push(o.userData.target);});
  assert.equal(lockedTargets.some(x=>x==='visitor:rohld'),false);
  const unlocked=createWorld({...town,rohld:true});
  const visitors:string[]=[];unlocked.root.traverse(o=>{if(o.userData.target==='visitor:rohld')visitors.push(o.userData.target);});
  assert.equal(visitors.length,1);unlocked.update(10);finiteGeometry(unlocked.root);
});
