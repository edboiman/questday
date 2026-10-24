import * as T from 'three';
import { ROSTER_IDS, type Building, type ResidentRow } from '../../domain/types';
import type { Season } from '../../domain/city';
import { rosterEntry } from '../../domain/city';
import type { WingId } from '../../domain/museum';
import { EXHIBITS } from '../../domain/museum';
import { box, ball, mesh, cylinder, tree, building, villager, rohld, exhibitModel, glassPanel, clearMaterials } from './models';

export type WorldSpec = {kind:'town';size:number;buildings:Building[];residents:ResidentRow[];season:Season;rohld:boolean} | {kind:'museum';wing:WingId;owned:string[]} | {kind:'exhibit';id:string};
export interface World {root:T.Group; radius:number; update:(time:number)=>void;}
export const pitch=1.8;
export function plotPosition(x:number,y:number,size:number) {return new T.Vector3((x-(size-1)/2)*pitch,0,(y-(size-1)/2)*pitch);}
export function routePosition(time:number, index:number,x:number,y:number,size:number) {
  const p=plotPosition(x,y,size),cycle=(time*.15+index*.83)%4,side=Math.floor(cycle),fraction=cycle-side;
  // Pause at each corner, then walk to the next along the shared roads.
  const t=Math.max(0,Math.min(1,(fraction-.22)/.78));
  const pts=[[-.9,-.9],[.9,-.9],[.9,.9],[-.9,.9],[-.9,-.9]];
  const a=pts[side],b=pts[side+1];
  return {x:p.x+a[0]+(b[0]-a[0])*t,z:p.z+a[1]+(b[1]-a[1])*t,angle:Math.atan2(b[0]-a[0],b[1]-a[1]),walking:fraction>.22};
}
export function createWorld(spec:WorldSpec):World {
  clearMaterials(); // A world owns its own material instances, including modal inspection worlds.
  const root=new T.Group();
  if(spec.kind==='exhibit') {
    cylinder(root,1.2,1.35,.18,'#a99d80',0,-.11);
    cylinder(root,.8,.8,.3,'#d4c7ab',0,.1);
    const model=exhibitModel(spec.id);model.position.y=.27;model.scale.setScalar(2.5);root.add(model);
    return {root,radius:2,update:()=>{}};
  }
  if(spec.kind==='museum') {
    const palettes:Record<WingId,string>={minerals:'#486d67',fossils:'#876f59',antiquities:'#84734f',space:'#455b76',curios:'#765d72'};
    const accent=palettes[spec.wing];
    box(root,11,.25,8,'#b6ad9c',0,-.2);
    for(let x=0;x<11;x++)for(let z=0;z<8;z++){
      const tile=box(root,.985,.025,.985,(x+z)%2?'#d8d0bf':'#e5dece',x-5,-.055,z-3.5);
      tile.receiveShadow=true;
    }
    // A warm, quiet gallery with panelled walls, carved trim and jewel-toned wing accents.
    box(root,11,3,.18,accent,0,1.45,-4);box(root,.18,3,8,accent,-5.5,1.45,0);
    box(root,11,.14,.23,'#d1bd91',0,.12,-3.86);box(root,.24,.14,8,'#d1bd91',-5.36,.12,0);
    box(root,11,.12,.23,'#ead9b4',0,2.92,-3.86);box(root,.24,.12,8,'#ead9b4',-5.36,2.92,0);
    for(const x of [-5.08,-2.72,0,2.72,5.08]){
      box(root,.12,2.62,.22,'#c6ae7e',x,1.45,-3.83);
      box(root,.04,2.43,.04,'#ead8ab',x,1.45,-3.69);
    }
    for(const x of [-4.05,-1.35,1.35,4.05]){
      box(root,1.48,1.65,.06,'#344e4a',x,1.66,-3.85);
      box(root,1.36,1.53,.035,'#576f66',x,1.66,-3.8);
      const halo=mesh(root,new T.TorusGeometry(.43,.025,8,40),accent,x,1.75,-3.76,.15);
      halo.scale.set(1.25,1,1);
      box(root,.35,.04,.035,'#e5d4ae',x,1.07,-3.75);
    }
    box(root,7,.035,1.15,'#a86f58',.6,-.02,.45);
    box(root,1.65,.17,.48,'#765b42',.6,.45,2.9);box(root,1.7,.055,.52,'#cfb27d',.6,.56,2.9);
    for(const x of [.05,1.15])box(root,.1,.45,.34,'#665747',x,.2,2.9);
    for(const z of [-2.6,2.8]){const t=tree();t.position.set(-4.8,0,z);t.scale.setScalar(.55);root.add(t);cylinder(root,.29,.23,.37,'#997b5c',-4.8,.185,z);cylinder(root,.3,.3,.035,'#c7ad82',-4.8,.38,z);}
    const items=EXHIBITS.filter(x=>x.wing===spec.wing);
    items.forEach((item,i)=>{
      const display=new T.Group();display.position.set(-2.5+(i%3)*2.65,0,-1.8+Math.floor(i/3)*3.3);root.add(display);
      display.userData.target=`exhibit:${item.id}`;
      cylinder(display,.62,.72,.12,'#79614a',0,.06,0,24);
      cylinder(display,.66,.66,.035,'#d0b578',0,.14,0,24);
      box(display,1.22,.18,1.22,'#795e46',0,.23,0);
      box(display,1.24,.035,1.24,'#d1b77c',0,.335,0);
      box(display,1.04,.045,1.04,'#344f4a',0,.37,0);
      // Brass corner posts and clear panels frame each artifact without obscuring it.
      for(const x of [-.54,.54])for(const z of [-.54,.54]){
        box(display,.035,1.03,.035,'#c5a364',x,.9,z);
        ball(display,.036,'#e3cb8e',x,1.43,z);
      }
      glassPanel(display,1.05,.94,.018,0,.9,-.53);
      glassPanel(display,1.05,.94,.018,0,.9,.53);
      glassPanel(display,.018,.94,1.05,-.53,.9,0);
      glassPanel(display,.018,.94,1.05,.53,.9,0);
      glassPanel(display,1.12,.025,1.12,0,1.39,0,'#e6f2e9');
      box(display,.38,.09,.035,'#ad935d',0,.27,.63);
      box(display,.28,.012,.012,'#ead8a9',0,.293,.651);
      const mine=spec.owned.includes(item.id);
      if(mine){const model=exhibitModel(item.id);model.position.y=.4;model.scale.setScalar(.83);display.add(model);}
      else { // Empty cases communicate ownership rather than presenting unearned items as collected.
        box(display,.48,.018,.34,'#c6bea9',0,.41);ball(display,.045,'#ad9564',0,.47);
      }
      const spot=new T.SpotLight('#fff1d0',13,5,Math.PI/6,.72,1);spot.position.set(display.position.x-.35,3.25,display.position.z+.35);spot.target=display;root.add(spot);
    });
    return {root,radius:7,update:()=>{}};
  }
  const {size,season}=spec,span=size*pitch,autumn=season==='autumn';
  box(root,span+2.1,.5,span+2.1,'#71816a',0,-.32);
  box(root,span+2.1,.08,span+2.1,season==='winter'?'#dae5de':autumn?'#aeb384':'#97b38a',0,-.03);
  // Continuous paths are part of the ground, not empty tiles pretending to be roads.
  for(let i=0;i<=size;i++){const n=-span/2+i*pitch;box(root,.25,.025,span+.45,'#d6c8a7',n,.025);box(root,span+.45,.025,.25,'#d6c8a7',0,.025,n);}
  for(let x=0;x<size;x++)for(let y=0;y<size;y++){
    const p=plotPosition(x,y,size);const tile=box(root,1.5,.04,1.5,season==='winter'?'#e4e9df':'#a9bc8b',p.x,.01,p.z);tile.userData.target=`tile:${x}:${y}`;
  }
  spec.buildings.forEach(b=>{const g=building(b.type);g.scale.setScalar(.82);g.position.copy(plotPosition(b.x,b.y,size));g.userData.target=`tile:${b.x}:${b.y}`;root.add(g);});
  for(let i=0;i<size+3;i++){
    const t=tree(autumn);t.position.set(-span/2-.65,0,-span/2+i*(span/(size+2)));t.scale.setScalar(.85+(i%3)*.11);root.add(t);
    const t2=tree(autumn);t2.position.set(-span/2+i*(span/(size+2)),0,-span/2-.65);t2.scale.setScalar(.85);root.add(t2);
  }
  // Pond and a simple timber bridge, both anchored at the edge of the land.
  box(root,span*.5,.02,.55,'#7eafb0',span*.2,.03,span/2+.65);
  for(let i=0;i<7;i++)box(root,.09,.045,.7,'#ba9e74',.2+i*.105,.08,span/2+.65);
  for(const side of [-1,1])for(let i=0;i<size;i++){const p=-span/2+i*pitch+.7;box(root,.07,.35,.07,'#dfd0aa',p,.18,side*(span/2+.85));box(root,1.6,.05,.05,'#dfd0aa',p,.28,side*(span/2+.85));}
  const people=spec.residents.map((r,i)=>{
    const favorite=spec.buildings.find(b=>b.type===rosterEntry(r.id).fav);
    const g=villager(r.id,i);g.userData.target=`resident:${r.id}`;root.add(g);
    return {g,x:favorite?.x??i%size,y:favorite?.y??Math.floor(i/size)%size,left:g.getObjectByName('leg-left')!,right:g.getObjectByName('leg-right')!};
  });
  const visitor=spec.rohld?rohld():null;
  if(visitor){visitor.userData.target='visitor:rohld';root.add(visitor);}
  const wheels:T.Object3D[]=[],smoke:T.Object3D[]=[];
  root.traverse(o=>{if(o.name==='wheel')wheels.push(o);if(o.name==='smoke'){o.userData.base=o.position.y;smoke.push(o);}});
  return {root,radius:span*.83+1,update(time){
    people.forEach((p,i)=>{const q=routePosition(time,i,p.x,p.y,size);p.g.position.set(q.x,.06,q.z);p.g.rotation.y=q.angle;p.left.rotation.x=q.walking?Math.sin(time*8+i)*.4:0;p.right.rotation.x=-p.left.rotation.x;});
    if(visitor){const q=routePosition(time,ROSTER_IDS.length+2,Math.floor((size-1)/2),Math.floor((size-1)/2),size);visitor.position.set(q.x,.06,q.z);visitor.rotation.y=q.angle;const left=visitor.getObjectByName('leg-left'),right=visitor.getObjectByName('leg-right');if(left&&right){left.rotation.x=q.walking?Math.sin(time*8+13)*.32:0;right.rotation.x=-left.rotation.x;}}
    wheels.forEach(w=>w.rotation.z=time*.13);
    smoke.forEach((s,i)=>{const phase=(time*.23+i*.3)%1;s.position.y=s.userData.base+phase*.55;s.scale.setScalar(1+phase*2);s.visible=phase<.85;});
  }};
}
