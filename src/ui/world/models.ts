import * as T from 'three';
import type { BuildingId, ResidentId } from '../../domain/types';
import { rosterEntry } from '../../domain/city';

// All geometry is created here. No model, image, font, or texture loaders.
const materials = new Map<string, T.MeshStandardMaterial>();
type Finish = 'matte' | 'polished' | 'cut';
export function material(color: string, metal = 0, finish: Finish = 'matte') {
  const key = `${color}:${metal}:${finish}`;
  if (!materials.has(key)) materials.set(key, new T.MeshStandardMaterial({
    color,
    roughness: finish === 'polished' ? .2 : metal ? .34 : .72,
    metalness: metal,
    flatShading: finish === 'cut',
  }));
  return materials.get(key)!;
}
export function clearMaterials() { materials.clear(); }
export function mesh(parent: T.Object3D, shape: T.BufferGeometry, color: string, x=0, y=0, z=0, metal=0, finish: Finish = 'matte') {
  const m = new T.Mesh(shape, material(color,metal,finish)); m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; parent.add(m); return m;
}
export const box = (p:T.Object3D,w:number,h:number,d:number,c:string,x=0,y=0,z=0) => mesh(p,new T.BoxGeometry(w,h,d),c,x,y,z);
export const ball = (p:T.Object3D,r:number,c:string,x=0,y=0,z=0) => mesh(p,new T.SphereGeometry(r,20,14),c,x,y,z);
export const cylinder = (p:T.Object3D,a:number,b:number,h:number,c:string,x=0,y=0,z=0,n=16) => mesh(p,new T.CylinderGeometry(a,b,h,n),c,x,y,z);
export const cone = (p:T.Object3D,r:number,h:number,c:string,x=0,y=0,z=0,n=8) => mesh(p,new T.ConeGeometry(r,h,n),c,x,y,z);
function ring(p:T.Object3D,r:number,t:number,c:string,x=0,y=0,z=0) { return mesh(p,new T.TorusGeometry(r,t,6,28),c,x,y,z,.45); }
export function tree(autumn=false) {
  const g=new T.Group(); cylinder(g,.07,.1,.7,'#795a40',0,.35); 
  ball(g,.4,autumn?'#c47745':'#56856a',0,.9).scale.set(1,1.3,1);
  ball(g,.32,autumn?'#e2aa65':'#7d9e70',-.14,1.16,.02); return g;
}
function bench(g:T.Object3D,x:number,z:number) {
  box(g,.68,.08,.26,'#af8255',x,.28,z);box(g,.68,.24,.06,'#af8255',x,.48,z-.12);
  for(const dx of [-.23,.23])box(g,.06,.28,.2,'#435b53',x+dx,.14,z);
}
const roofColors:Partial<Record<BuildingId,string>>={cottage:'#bb6557',townhouse:'#586e8c',bakery:'#be8750',market:'#a95555',cafe:'#72998d',library:'#697993',boutique:'#a97790',guildhall:'#556f72',bathhouse:'#6f9d9c',cinema:'#6d6683'};
export function building(type: BuildingId) {
  const g=new T.Group();
  if(type==='snowman') {
    cylinder(g,.65,.68,.08,'#dce5de',0,.04);ball(g,.25,'#f1eddf',0,.29);ball(g,.18,'#f1eddf',0,.65);cylinder(g,.24,.24,.04,'#54636a',0,.81);cylinder(g,.15,.15,.19,'#54636a',0,.91);
    for(const x of [-.06,.06])ball(g,.018,'#384941',x,.7,.16);const nose=cone(g,.025,.13,'#c48a52',0,.64,.22);nose.rotation.x=Math.PI/2;
    box(g,.4,.055,.36,'#a96e65',0,.5);
  } else if(type==='lemonade') {
    box(g,.9,.5,.6,'#d1b579',0,.25);for(const x of [-.43,.43])box(g,.05,.9,.05,'#8b7651',x,.65);box(g,1.1,.08,.8,'#f1dca4',0,1.1);
    for(let i=0;i<4;i++)cylinder(g,.045,.045,.12,'#ead46a',-.3+i*.2,.56,.1);
  } else if (['park','gardens','pumpkin','blossom'].includes(type)) {
    box(g,1.4,.12,1.35,'#8da775',0,.06);
    const t=tree(type==='pumpkin');if(type==='blossom')t.traverse(o=>{if(o instanceof T.Mesh&&o.geometry instanceof T.SphereGeometry)o.material=material('#c89ca5');});t.position.set(-.3,.12,-.25); t.scale.setScalar(.65);g.add(t);bench(g,.2,.36);
    for(let i=0;i<6;i++)ball(g,.07,type==='pumpkin'?'#dc8943':'#d7a4ad',-.45+(i%3)*.45,.2,-.43+Math.floor(i/3)*.7);
  } else if(type==='fountain') {
    cylinder(g,.66,.7,.18,'#c1c8b6',0,.09);cylinder(g,.57,.57,.02,'#6baaae',0,.19);
    cylinder(g,.1,.16,.65,'#dfdcca',0,.46);cylinder(g,.3,.13,.12,'#d0d6c6',0,.76);
    const water=cylinder(g,.035,.06,.35,'#a1d1d3',0,.96); water.name='water';
    for(let i=0;i<6;i++){const a=i*Math.PI/3;ball(g,.035,'#abd6d5',Math.cos(a)*.22,.57,Math.sin(a)*.22);}
  } else if(type==='ferris') {
    box(g,1.3,.1,1.3,'#ded2b4',0,.05);
    const wheel=new T.Group();wheel.position.y=1.1;wheel.name='wheel';g.add(wheel);
    ring(wheel,.65,.035,'#eee2bf');
    for(let i=0;i<8;i++){const a=i*Math.PI/4;const spoke=box(wheel,.025,1.28,.025,'#d6c596');spoke.rotation.z=a;box(wheel,.2,.22,.2,i%2?'#bc7164':'#77958d',Math.sin(a)*.65,Math.cos(a)*.65);}
    for(const x of [-.3,.3]){const post=box(g,.09,1.15,.09,'#657f78',x,.6,.12);post.rotation.z=x*.8;}
  } else if(type==='carousel') {
    cylinder(g,.65,.7,.15,'#b58663',0,.1);cylinder(g,.07,.07,1.1,'#c1a665',0,.7);
    cone(g,.78,.46,'#ba7067',0,1.45);cone(g,.25,.12,'#e8c67b',0,1.74);
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5;const x=Math.cos(a)*.44,z=Math.sin(a)*.44;cylinder(g,.022,.022,.9,'#e5c788',x,.78,z);ball(g,.15,'#e8debc',x,.48,z).scale.set(1.3,.7,.7);}
  } else if(type==='observatory') {
    cylinder(g,.55,.6,.72,'#e2d9bf',0,.36);ball(g,.57,'#638e98',0,.73).scale.y=.7;
    const telescope=cylinder(g,.11,.11,.68,'#dcc38b',.24,1.1,.1);telescope.rotation.z=-.8;
    box(g,.23,.4,.04,'#5d6766',0,.2,.59);
  } else {
    const tall=type==='townhouse'||type==='guildhall';const h=tall?1.2:.75;
    box(g,1.22,.12,1.15,'#cabf9c',0,.06);
    box(g,1.06,h,.88,'#e5d7b5',0,.12+h/2);
    // A gabled roof: two sloping planes meet along a real ridge.
    for(const side of [-1,1]){const roof=box(g,.76,.1,1.13,roofColors[type]??'#8c9272',side*.29,h+.31);roof.rotation.z=side*-.53;
      for(let row=0;row<3;row++){const seam=box(g,.015,.018,1.14,roofColors[type]??'#8c9272',0,.06,0);seam.position.set(side*(.13+row*.2),h+.48-row*.12,0);}
    }
    box(g,.22,.42,.05,'#655746',0,.33,.465);
    ball(g,.023,'#e4c47e',.07,.3,.5);
    for(const x of [-.34,.34]){box(g,.23,.25,.05,'#fff0b8',x,.54,.47);box(g,.025,.27,.06,'#9c7b57',x,.54,.5);box(g,.25,.025,.06,'#9c7b57',x,.54,.5);box(g,.3,.07,.14,'#8b7050',x,.38,.5);ball(g,.08,'#658b65',x,.44,.55);}
    if(tall)for(const x of [-.34,.34])box(g,.23,.22,.04,'#fbdf9d',x,1.05,.47);
    box(g,.18,.44,.2,'#ae8467',.34,h+.38,-.23);
    const smoke=ball(g,.06,'#e9e4d5',.34,h+.68,-.23);smoke.name='smoke';
    if(['market','bakery','cafe','boutique'].includes(type)){
      for(let i=0;i<6;i++){const stripe=box(g,.19,.06,.43,i%2?'#f3e6c9':roofColors[type]??'#b16a63',-.475+i*.19,.64,.64);stripe.rotation.x=.14;}
      box(g,.85,.25,.28,'#ac8159',0,.23,.7);
      for(let i=0;i<4;i++)ball(g,.065,type==='bakery'?'#d8ad6a':'#cb805f',-.3+i*.2,.4,.7);
    }
    if(type==='cinema'){box(g,.9,.19,.13,'#dec594',0,.75,.55);for(let i=0;i<6;i++)ball(g,.025,'#fff0be',-.37+i*.15,.73,.63);}
    if(type==='bathhouse'){cylinder(g,.35,.39,.18,'#abbaa9',.35,.16,.56);cylinder(g,.31,.31,.02,'#88b9bc',.35,.26,.56);}
    if(type==='guildhall'){cylinder(g,.19,.22,1.2,'#d9caaa',-.45,.7,-.3);cone(g,.28,.4,'#577b78',-.45,1.5,-.3);}
    if(type==='library'){box(g,.45,.16,.04,'#526d63',0,.82,.52);for(let i=0;i<4;i++)box(g,.06,.1,.02,'#d5c28d',-.12+i*.08,.82,.55);}
  }
  return g;
}

export function villager(id:ResidentId,index:number) {
  const entry=rosterEntry(id),g=new T.Group();
  const fur:Record<string,string>={fox:'#bd7951',hedgehog:'#927759',owl:'#9e8a65',otter:'#886f57',gardener:'#ddb28e',bear:'#8b6b4e',rabbit:'#e6dbc7',frog:'#7caa79',cat:'#aba5a2',mayor:'#d5aa83',dragon:'#bc826d',unicorn:'#eee2cd',griffin:'#b5a47d'};
  const color=fur[entry.species];
  cylinder(g,.12,.16,.25,['#568b86','#af7780','#7d83a2','#be965f'][index%4],0,.31);
  ball(g,.17,color,0,.57).scale.set(1,1,.92);
  if(['fox','cat','rabbit','unicorn','dragon'].includes(entry.species))for(const x of [-.1,.1]){const ear=cone(g,.07,entry.species==='rabbit'?.25:.15,color,x,.75);ear.rotation.z=-x*2;}
  else for(const x of [-.15,.15])ball(g,.065,color,x,.65);
  ball(g,.095,['gardener','mayor','frog'].includes(entry.species)?color:'#ead9bb',0,.52,.12).scale.set(1,.65,.55);
  for(const x of [-.062,.062])ball(g,.019,'#293c37',x,.6,.142);
  ball(g,.026,'#4b4038',0,.55,.18);
  if(entry.species==='gardener'||entry.species==='mayor'){cylinder(g,.22,.22,.035,'#d4b474',0,.74);cylinder(g,.13,.14,.12,'#c8a365',0,.8);}
  if(entry.species==='unicorn')cone(g,.035,.19,'#dfbe7e',0,.82,.08);
  if(entry.species==='hedgehog')for(let i=0;i<7;i++){const a=(i-3)*.32;const spike=cone(g,.055,.12,'#6c5b47',Math.sin(a)*.17,.6+Math.cos(a)*.13,-.08);spike.rotation.z=-a;}
  if(entry.species==='owl')for(const x of [-.06,.06]){ball(g,.055,'#e4d5b4',x,.6,.13);ball(g,.021,'#293c37',x,.6,.182);}
  if(entry.species==='frog')for(const x of [-.1,.1]){ball(g,.07,color,x,.69,.07);ball(g,.025,'#293c37',x,.7,.13);}
  if(entry.species==='dragon'||entry.species==='griffin')for(const side of [-1,1]){const wing=cone(g,.16,.32,entry.species==='dragon'?'#9f6d6e':'#dbccaa',side*.2,.38,-.09,3);wing.rotation.z=side*-.75;wing.scale.z=.2;}
  if(entry.species==='fox'){const tail=cone(g,.09,.34,color,0,.25,-.21);tail.rotation.x=-.85;}
  for(const side of [-1,1]){const leg=new T.Group();leg.position.set(side*.07,.2,0);g.add(leg);box(leg,.07,.14,.09,'#59605a',0,-.07);ball(leg,.055,'#574c42',0,-.13,.035);leg.name=side<0?'leg-left':'leg-right';
    const arm=box(g,.065,.19,.07,color,side*.16,.33);arm.rotation.z=side*.2;}
  return g;
}

/** Rohld: an original, woolly little travelling penguin who visits the town. */
export function rohld() {
  const g = new T.Group();
  const slate = '#61798b', wing = '#526a7c', belly = '#f3ead6', scarf = '#c77755', beak = '#dfaa63', boot = '#c98756';
  ball(g,.24,slate,0,.48).scale.set(1,.98,.82);
  ball(g,.205,slate,0,.68,.015).scale.set(1,.92,.85);
  ball(g,.137,belly,0,.46,.152).scale.set(1,.92,.32);
  // A small feather tuft and soft cheek spots keep his silhouette distinct.
  for (const [x,y,turn] of [[-.04,.87,-.18],[.035,.89,.14]] as const) {
    const feather=cone(g,.035,.105,slate,x,y,-.01,7); feather.rotation.z=turn;
  }
  for(const x of [-.075,.075]){
    ball(g,.034,'#fff8e8',x,.72,.17);
    ball(g,.018,'#293943',x,.72,.199);
    ball(g,.006,'#fffdf5',x-.005,.727,.215);
  }
  const beakShape=cone(g,.045,.095,beak,0,.66,.225,7);beakShape.rotation.x=Math.PI/2;
  for(const side of [-1,1]){
    const flipper=ball(g,.085,wing,side*.205,.43,.015);flipper.scale.set(.55,1.42,.62);flipper.rotation.z=side*-.22;
  }
  cylinder(g,.197,.2,.075,scarf,0,.58,.015,24);
  const scarfTail=box(g,.075,.18,.04,scarf,.095,.48,.12);scarfTail.rotation.z=-.22;
  // A tiny travel satchel and cross-body strap add a collectible character detail.
  const strap=box(g,.035,.36,.03,'#dfc18e',-.105,.47,.132);strap.rotation.z=-.42;
  box(g,.105,.115,.055,'#b4865f',.145,.31,.105);
  box(g,.067,.018,.012,'#e2c888',.145,.32,.138);
  for(const side of [-1,1]){
    const foot=ball(g,.074,boot,side*.105,.085,.055);foot.scale.set(1.35,.42,1.15);
    const leg=new T.Group();leg.position.set(side*.09,.16,0);g.add(leg);leg.name=side<0?'leg-left':'leg-right';
    box(leg,.045,.12,.05,boot,0,-.02,.005);
  }
  return g;
}

function glassMaterial(color = '#d8eee8') {
  return new T.MeshPhysicalMaterial({ color, roughness: .12, metalness: .04, transparent: true, opacity: .16, transmission: .2, thickness: .08, clearcoat: .9, clearcoatRoughness: .1, depthWrite: false });
}

export function glassPanel(parent:T.Object3D, width:number, height:number, depth:number, x=0, y=0, z=0, color='#d8eee8') {
  const pane=new T.Mesh(new T.BoxGeometry(width,height,depth),glassMaterial(color));
  pane.position.set(x,y,z);pane.castShadow=false;pane.receiveShadow=true;pane.renderOrder=2;parent.add(pane);return pane;
}

export function exhibitModel(id:string) {
  const g=new T.Group(), gold='#c5a364', bone='#dfd0aa', dark='#3e4844';
  const cut=(shape:T.BufferGeometry,color:string,x=0,y=0,z=0,metal=0)=>mesh(g,shape,color,x,y,z,metal,'cut');
  const shard=(x:number,z:number,h:number,color:string,r=.09)=>{
    cylinder(g,r*.7,r,h*.62,color,x,h*.31,z,6).material=material(color,.08,'cut');
    const tip=cone(g,r,h*.4,color,x,h*.81,z,6);tip.material=material(color,.08,'cut');
  };
  if(['quartz','geode','emerald','sapphire','opal','stardiamond'].includes(id)){
    const colors:Record<string,string>={quartz:'#c8ddd7',geode:'#a17bc2',emerald:'#3e9972',sapphire:'#527bb8',opal:'#e59570',stardiamond:'#b8e0ed'};
    const gem=colors[id]!;
    const matrix=mesh(g,new T.IcosahedronGeometry(.39,1),id==='geode'?'#716f68':id==='emerald'?'#616c57':'#827f73',0,.2,0,0,'cut');matrix.scale.set(1,.67,.76);
    if(id==='geode'){
      const hollow=ball(g,.245,'#453b56',0,.3,.06);hollow.scale.set(1,.65,.32);
      for(let i=0;i<9;i++){const a=(i/9)*Math.PI*2;shard(Math.cos(a)*.16,Math.sin(a)*.14,.18+(i%3)*.055,gem,.047+(i%2)*.012);}
    } else if(id==='quartz'||id==='emerald'){
      const count=id==='quartz'?6:4;
      for(let i=0;i<count;i++){
        const x=((i%3)-1)*.13,z=(Math.floor(i/3)-.5)*.13;
        shard(x,z,.32+(i%3)*.085,gem,id==='emerald'?.12:.082);
        const glint=box(g,.012,.22,.012,id==='quartz'?'#eff8ec':'#b2e1a6',x-.035,.21+(i%3)*.04,z+.045);glint.rotation.z=-.13;
      }
      if(id==='emerald')for(const x of [-.23,.23])ball(g,.12,'#616c57',x,.14,.02).scale.set(1,.75,1);
    } else {
      const crystal=cut(new T.OctahedronGeometry(id==='stardiamond'?.35:.31,0),gem,0,.4,0,.08);
      crystal.scale.set(1,1.13,.83);
      if(id==='sapphire'){
        cylinder(g,.24,.28,.075,gold,0,.11,0,8);
        for(let i=0;i<4;i++){const p=box(g,.025,.12,.025,'#e4d0a0',Math.cos(i*Math.PI/2)*.27,.27,Math.sin(i*Math.PI/2)*.22);p.rotation.z=Math.cos(i*Math.PI/2)*-.24;}
      }
      if(id==='opal')for(let i=0;i<5;i++){const a=i*1.26;ball(g,.026,['#f8d095','#9fd2c5','#c6a9dc'][i%3]!,Math.cos(a)*.12,.42+Math.sin(a)*.1,.21);}
      if(id==='stardiamond'){ring(g,.43,.018,'#d4c391',0,.39,0).rotation.x=1.13;for(let i=0;i<4;i++)ball(g,.025,'#fff4c6',Math.cos(i*1.57)*.43,.44,Math.sin(i*1.57)*.43);}
    }
  } else if(id==='ammonite'){
    // Ribbed, chambered shell with a visible spiral whorl.
    for(let i=0;i<31;i++){const a=i*.34,r=.035+i*.0074;const bead=ball(g,.043,bone,Math.cos(a)*r,.31+Math.sin(a)*r,0);bead.scale.set(1,.92,.62);}
    const center=ball(g,.055,'#a99475',0,.31,.018);center.scale.set(1,1,.65);
    for(let i=0;i<9;i++){const a=i*.66,r=.29;const rib=box(g,.02,.33,.018,'#b9a381',Math.cos(a)*r,.31+Math.sin(a)*r,.035);rib.rotation.z=-a;}
    box(g,.08,.12,.16,bone,.36,.28,0);
  } else if(id==='trilobite'){
    const shell=ball(g,.28,bone,0,.16,0);shell.scale.set(.77,.47,1.22);
    const head=ball(g,.17,'#e4d5b9',0,.19,.22);head.scale.set(.88,.62,.58);
    const tail=ball(g,.12,'#c6b695',0,.17,-.27);tail.scale.set(.62,.48,.8);
    for(let i=0;i<7;i++){const z=.12-i*.052;const rib=box(g,.29-i*.022,.025,.018,'#a99475',0,.25,z);rib.rotation.x=.15;}
    box(g,.075,.025,.42,'#80755e',0,.35,.005);
    for(const side of [-1,1])for(let i=0;i<5;i++){const leg=box(g,.18,.018,.027,'#a99475',side*.19,.11,.13-i*.075);leg.rotation.y=side*.23;}
    for(const x of [-.095,.095])ball(g,.025,dark,x,.29,.31);
  } else if(id==='sharktooth'){
    const root=box(g,.36,.14,.2,'#a99475',0,.1,0);root.rotation.z=.08;
    const tooth=cut(new T.ConeGeometry(.2,.58,4),bone,0,.43,0);tooth.rotation.z=Math.PI;
    box(g,.045,.09,.21,'#c6b695',-.08,.22,.025);box(g,.045,.09,.21,'#c6b695',.08,.22,.025);
    for(let i=0;i<4;i++){const glint=box(g,.012,.24,.014,'#f5edd9',-.04+i*.025,.42,.16);glint.rotation.z=.09;}
  } else if(id==='claw'){
    const mount=box(g,.4,.09,.34,'#95836b',0,.055,0);mount.rotation.z=-.08;
    for(let i=0;i<5;i++){const y=.15+i*.07,x=.12-i*.034;const joint=ball(g,.082-i*.007,bone,x,y,0);joint.scale.set(.85,1,.74);}
    const claw=cut(new T.ConeGeometry(.105,.46,7),bone,-.03,.57,0);claw.rotation.z=.48;
    ring(g,.056,.012,'#b4a27f',.1,.26,0).rotation.z=.18;
  } else if(id==='amber'){
    const resin=cut(new T.IcosahedronGeometry(.31,2),'#c78331',0,.32,0);
    resin.scale.set(.9,1.06,.74);
    const insect=ball(g,.09,'#514539',.015,.33,.2);insect.scale.set(.8,.55,1.6);
    ball(g,.035,'#514539',.02,.34,.31);
    for(const side of [-1,1])for(let i=0;i<3;i++){const leg=box(g,.1,.012,.014,'#514539',side*.075,.31-i*.035,.19-i*.045);leg.rotation.z=side*.5;}
    for(const side of [-1,1]){const wing=ball(g,.067,'#edd18a',side*.055,.39,.22);wing.scale.set(.48,.25,1.2);}
    for(const side of [-1,1]){const glint=box(g,.018,.18,.012,'#f4cf77',side*.15,.37,.19);glint.rotation.z=side*.42;}
  } else if(id==='trex'){
    // A small mounted skull: brow, eye sockets, nasal opening and individual teeth.
    box(g,.72,.24,.35,bone,0,.43,0);
    const snout=ball(g,.24,'#d5c5a0',0,.39,.22);snout.scale.set(1.45,.7,1.1);
    const cranium=ball(g,.25,bone,0,.58,-.08);cranium.scale.set(1.28,.9,1.03);
    for(const x of [-.18,.18]){
      ball(g,.085,'#403e38',x,.55,.18).scale.set(1,.82,.45);
      ring(g,.104,.025,'#b7a783',x,.55,.18);
      ball(g,.035,'#544d40',x,.38,.34).scale.set(1,.7,.7);
    }
    box(g,.68,.08,.31,'#b8a783',0,.27,.1);
    for(let i=0;i<8;i++){
      const x=-.29+i*.083;
      const tooth=cone(g,.029,.12,'#faf0d8',x,.3,.26,5);tooth.rotation.z=Math.PI;
      if(i%2===0){const lower=cone(g,.02,.075,'#f5ead1',x,.22,.19,5);lower.rotation.z=.08;}
    }
    box(g,.5,.06,.22,'#76644c',0,.08,0);
    for(const x of [-.22,.22])cylinder(g,.025,.025,.14,gold,x,.03,0,8);
  } else if(id==='pot'){
    const profile=[new T.Vector2(.09,0),new T.Vector2(.19,.04),new T.Vector2(.27,.16),new T.Vector2(.3,.29),new T.Vector2(.24,.4),new T.Vector2(.16,.43),new T.Vector2(.15,.48),new T.Vector2(.21,.5)];
    mesh(g,new T.LatheGeometry(profile,28),'#b77d58',0,.06,0,0,'polished');
    ring(g,.195,.025,'#e0c796',0,.55).rotation.x=Math.PI/2;
    for(const y of [.2,.27,.34])ring(g,.27-(Math.abs(y-.27)*.55),.012,y===.27?'#d9b77b':'#8c553d',0,y).rotation.x=Math.PI/2;
    for(const x of [-.28,.28]){const handle=ring(g,.072,.018,'#c69b68',x,.36,0);handle.rotation.y=Math.PI/2;}
    box(g,.15,.018,.015,'#4e715f',0,.36,.266);
  } else if(id==='coin'){
    const disk=cylinder(g,.28,.28,.065,'#a97742',0,.35,0,32);disk.rotation.x=Math.PI/2;
    const rim=ring(g,.255,.022,'#e0c080',0,.35,.045);rim.rotation.x=Math.PI/2;
    const crest=ball(g,.105,'#d3b06b',0,.35,.051);crest.scale.set(.76,1,.22);
    for(let i=0;i<12;i++){const a=i*Math.PI/6;const mark=box(g,.018,.045,.012,'#edcf8b',Math.cos(a)*.215,.35+Math.sin(a)*.215,.049);mark.rotation.z=-a;}
  } else if(id==='lamp'){
    const bowl=ball(g,.22,'#b47c4b',0,.18,0);bowl.scale.set(1,.56,.72);
    box(g,.34,.035,.21,'#d6ae70',0,.29,0);
    const spout=cylinder(g,.065,.09,.28,'#b47c4b',.22,.32,0,10);spout.rotation.z=-.72;
    const handle=ring(g,.105,.025,'#d0ad75',-.2,.28,0);handle.scale.set(.72,1,1);
    box(g,.055,.025,.025,'#f2cc78',.34,.43,0);
    ball(g,.027,'#ffdc82',.35,.47,0);
    ring(g,.12,.018,'#e0c08a',0,.3).rotation.x=Math.PI/2;
  } else if(id==='scarab'){
    const body=ball(g,.24,'#b38a3d',0,.2,0);body.material=material('#b38a3d',.55,'polished');body.scale.set(.86,.53,1.1);
    const shell=ball(g,.2,'#d0a849',0,.27,-.015);shell.material=material('#d0a849',.72,'polished');shell.scale.set(.84,.57,.98);
    ball(g,.09,'#9b783a',0,.2,.22).scale.set(.9,.72,.8);
    for(const side of [-1,1])for(let i=0;i<3;i++){const leg=box(g,.16,.025,.036,'#79633b',side*.2,.12,.13-i*.14);leg.rotation.z=side*-.38;}
    box(g,.014,.34,.018,'#76603c',0,.29,-.015);
    for(const x of [-.12,.12]){const shine=ball(g,.025,'#ebd084',x,.31,.13);shine.material=material('#ebd084',.45,'polished');}
  } else if(id==='mask'){
    const face=ball(g,.29,'#c5a364',0,.37,0);face.material=material('#c5a364',.72,'polished');face.scale.set(.82,1,.31);
    for(const x of [-.115,.115]){
      ball(g,.058,'#433f36',x,.42,.09).scale.set(1,.58,.3);
      const brow=box(g,.15,.036,.035,'#e1c783',x,.5,.105);brow.rotation.z=x*.45;
      ball(g,.038,'#b39154',x*1.5,.27,.075).scale.set(1,.65,.35);
    }
    const nose=mesh(g,new T.ConeGeometry(.055,.18,5),'#d3b575',0,.32,.11,.68,'cut');nose.rotation.x=Math.PI;
    for(const y of [.58,.22]){const trim=box(g,.25,.018,.02,'#e1c783',0,y,.065);trim.rotation.z=y>.5?.06:-.05;}
  } else if(id==='crown'){
    cylinder(g,.27,.29,.13,gold,0,.14,0,16);
    ring(g,.27,.024,'#ead495',0,.21).rotation.x=Math.PI/2;
    for(let i=0;i<7;i++){const a=i*Math.PI*2/7,x=Math.cos(a)*.23,z=Math.sin(a)*.23,color=['#78a1ac','#b66f64','#89a66e'][i%3]!;cone(g,.067,.24,gold,x,.32,z,6);const jewel=ball(g,.044,color,x,.46,z);jewel.material=material(color,.08,'polished');}
    for(let i=0;i<8;i++){const a=i*Math.PI/4;const stud=ball(g,.025,'#f1d998',Math.cos(a)*.25,.17,Math.sin(a)*.25);stud.material=material('#f1d998',.65,'polished');}
  } else if(id==='meteorite'||id==='moonrock'){
    const color=id==='meteorite'?'#65716c':'#aeb5a7';
    const rock=mesh(g,new T.IcosahedronGeometry(.31,2),color,0,.3,0,id==='meteorite'?.4:0,'cut');rock.scale.set(1.16,.78,1);
    const craters=id==='meteorite'?5:8;
    for(let i=0;i<craters;i++){
      const a=i*2.4,r=.16+(i%2)*.055,x=Math.cos(a)*r,z=Math.sin(a)*r;
      const crater=ball(g,.052,id==='meteorite'?'#454d49':'#7c857d',x,.3+(i%3)*.11,z);crater.scale.set(1,.25,.78);
      ring(g,.056,.012,id==='meteorite'?'#87918a':'#d1d5c8',x,.3+(i%3)*.11,z).rotation.x=Math.PI/2;
    }
  } else if(id==='telescope'){
    for(const x of [-.18,0,.18]){const leg=box(g,.035,.43,.035,'#795f46',x,.23,.02);leg.rotation.z=x*1.5;}
    cylinder(g,.13,.13,.055,gold,0,.43,0,12);
    const tube=cylinder(g,.1,.14,.64,'#b78b54',0,.79,0,12);tube.rotation.z=-.74;
    const lens=ring(g,.12,.025,'#e2c582',.22,1.02,0);lens.rotation.z=-.74;
    const eyepiece=ring(g,.075,.021,'#dfc587',-.22,.55,0);eyepiece.rotation.z=-.74;
    const band=ring(g,.095,.014,'#7e6850',.09,.82,0);band.rotation.z=-.74;
    const smallGlass=ball(g,.065,'#9bced0',.235,1.04,.006);smallGlass.scale.set(.8,.8,.22);
  } else if(id==='astrolabe'){
    const base=ring(g,.31,.027,gold,0,.39,0);base.rotation.x=Math.PI/2;
    const inner=ring(g,.22,.016,'#e3c985',0,.39,.015);inner.rotation.x=Math.PI/2;
    const meridian=ring(g,.29,.013,'#8b7655',0,.39,.04);meridian.rotation.set(.45,0,.24);
    const axis=cylinder(g,.025,.025,.09,gold,0,.39,.05,10);axis.rotation.x=Math.PI/2;
    box(g,.018,.42,.014,'#69583e',0,.39,.07);
    for(let i=0;i<16;i++){const a=i*Math.PI/8;const mark=box(g,.012,i%4===0?.07:.035,.012,'#e9d6a6',Math.cos(a)*.27,.39+Math.sin(a)*.27,.045);mark.rotation.z=-a;}
    box(g,.32,.05,.055,'#8f7755',0,.06,0);
  } else if(id==='planet'){
    const planet=ball(g,.25,'#bba77e',0,.42,0);planet.material=material('#bba77e',0,'polished');
    for(let i=0;i<5;i++){const band=ring(g,.253-i*.012,.009,['#8f9b7a','#d6c39c','#a97561'][i%3],0,.42+(i-2)*.055);band.scale.y=.62;band.rotation.x=.26;}
    const orbit=ring(g,.39,.045,'#d2c6a1',0,.42);orbit.rotation.set(1.12,.2,.05);
    const orbit2=ring(g,.46,.012,'#8296a1',0,.42);orbit2.rotation.set(1.12,.2,.05);
    cylinder(g,.035,.04,.1,gold,0,.09,0,10);
    cylinder(g,.15,.18,.045,'#88775d',0,.035,0,12);
  } else if(id==='comet'){
    const jar=ball(g,.31,'#c5e3df',0,.35,0);jar.material=glassMaterial('#c5e3df');jar.scale.set(.84,1,.8);jar.castShadow=false;
    const core=ball(g,.085,'#e7d49e',-.045,.37,.13);core.material=material('#f0cf79',.08,'polished');
    const tail=cone(g,.105,.42,'#80bcc3',.09,.47,.06,7);tail.rotation.z=-.58;
    for(let i=0;i<9;i++){const a=i*2.2;ball(g,.012,'#f8f1c9',Math.cos(a)*.2,.28+(i%4)*.08,Math.sin(a)*.2);}
    cylinder(g,.2,.22,.075,gold,0,.055,0,16);
    ring(g,.205,.018,'#e7cf91',0,.1).rotation.x=Math.PI/2;
  } else if(id==='watch'){
    const watchCase=cylinder(g,.27,.27,.075,'#a77f49',0,.38,0,32);watchCase.rotation.x=Math.PI/2;
    const dial=cylinder(g,.225,.225,.012,'#eadcb8',0,.38,.05,32);dial.rotation.x=Math.PI/2;
    const bezel=ring(g,.24,.02,'#e4c784',0,.38,.065);bezel.rotation.x=Math.PI/2;
    for(let i=0;i<12;i++){const a=i*Math.PI/6;const tick=box(g,.012,i%3===0?.04:.025,.01,'#635843',Math.cos(a)*.19,.38+Math.sin(a)*.19,.074);tick.rotation.z=-a;}
    box(g,.016,.15,.012,'#4d4c43',0,.415,.078);
    box(g,.09,.014,.012,'#4d4c43',.035,.38,.078);
    const crown=cylinder(g,.045,.045,.08,gold,.29,.4,0,10);crown.rotation.z=Math.PI/2;
    const loop=ring(g,.075,.016,gold,0,.7,0);loop.rotation.x=Math.PI/2;
  } else if(id==='musicbox'){
    box(g,.54,.24,.39,'#85614c',0,.16,0);
    box(g,.57,.035,.42,'#c5a364',0,.29,0);
    for(const x of [-.21,.21])for(const z of [-.13,.13])box(g,.05,.045,.05,'#dfc88f',x,.045,z);
    for(let i=0;i<5;i++){const inlay=box(g,.018,.02,.2,'#e2c985',-.2+i*.1,.306,.1);inlay.rotation.y=.24;}
    const lid=box(g,.54,.035,.37,'#986f55',0,.51,-.19);lid.rotation.x=-.38;
    box(g,.44,.3,.025,'#d6bd8b',0,.52,-.37).rotation.x=-.38;
    ball(g,.09,'#dbb7a4',0,.44,.015);cone(g,.12,.17,'#c6a0aa',0,.38,.015);
    const spindle=cylinder(g,.015,.015,.22,gold,0,.33,.1,8);spindle.rotation.x=Math.PI/2;
    ring(g,.045,.012,gold,.3,.27,0).rotation.y=Math.PI/2;
  } else if(id==='snowglobe'){
    cylinder(g,.28,.31,.1,'#90745a',0,.07,0,20);
    cylinder(g,.3,.28,.045,'#d1b17c',0,.13,0,20);
    const dome=ball(g,.28,'#cce1dc',0,.43,0);dome.material=glassMaterial('#cce1dc');dome.scale.y=1.05;dome.castShadow=false;
    cylinder(g,.055,.07,.13,'#6e9775',0,.31,0,8);
    for(let i=0;i<3;i++)cone(g,.11-i*.022,.16,'#63856a',0,.36+i*.075,0,7);
    for(let i=0;i<11;i++){const a=i*2.4;ball(g,.012,'#fff9e9',Math.cos(a)*(.08+(i%3)*.045),.31+(i%5)*.075,Math.sin(a)*.08);}
    ring(g,.3,.015,'#a3c8cc',0,.17).rotation.x=Math.PI/2;
  } else if(id==='ship'){
    const hull=ball(g,.25,'#936f51',0,.21,0);hull.scale.set(1.25,.48,.68);
    box(g,.52,.045,.045,'#c3a06d',0,.2,.01);
    for(const x of [-.13,0,.13])cylinder(g,.012,.012,.38,gold,x,.42,0,8);
    // Three triangular cloth sails, with gold seams and a pennant.
    for(const [x,y,w,h] of [[-.13,.44,.13,.18],[0,.45,.15,.22],[.13,.42,.12,.16]] as const){
      const shape=new T.Shape();shape.moveTo(-w/2,0);shape.lineTo(w/2,0);shape.lineTo(0,h);shape.closePath();
      const cloth=mesh(g,new T.ShapeGeometry(shape),'#eee1bc',x,y,.012);cloth.material.side=T.DoubleSide;
      box(g,.012,h,.01,gold,x,y+h/2,.025);
    }
    const bottle=ball(g,.35,'#c5e3df',0,.38,0);bottle.material=glassMaterial('#c5e3df');bottle.scale.set(1.25,.65,.66);bottle.castShadow=false;
    cylinder(g,.06,.055,.12,'#9b7653',0,.38,-.33,10).rotation.x=Math.PI/2;
  } else if(id==='bird'){
    const body=ball(g,.19,'#b28c4b',0,.29,0);body.material=material('#b28c4b',.58,'polished');body.scale.set(.8,.9,1);
    const breast=ball(g,.105,'#d8be7c',0,.28,.15);breast.scale.set(.85,.82,.45);
    const head=ball(g,.105,'#c5a364',0,.48,.02);head.material=material('#c5a364',.55,'polished');
    for(const x of [-.043,.043]){ball(g,.024,'#e9dcba',x,.49,.105);ball(g,.012,'#3c4039',x,.49,.124);}
    const beak=cone(g,.035,.1,'#c58b4f',0,.46,.16,6);beak.rotation.x=Math.PI/2;
    for(const side of [-1,1]){
      const wing=ball(g,.12,'#829b95',side*.15,.34,0);wing.material=material('#829b95',.42,'polished');wing.scale.set(.4,.9,.8);wing.rotation.z=side*.28;
      for(let i=0;i<3;i++){const feather=box(g,.025,.11,.025,'#d0b16d',side*(.15+i*.025),.31-i*.035,.06);feather.rotation.z=side*.35;}
      box(g,.08,.025,.13,'#b7794b',side*.09,.08,.025);
    }
    ring(g,.075,.014,gold,.15,.52,0).rotation.y=Math.PI/2;
    box(g,.12,.035,.03,'#756045',.19,.24,-.02);
  } else if(id==='egg'){
    const egg=ball(g,.29,'#789d8e',0,.33,0);egg.material=material('#789d8e',.1,'polished');egg.scale.set(.85,1.18,.82);
    for(let i=0;i<3;i++){
      const band=ring(g,.245-i*.035,.014,['#c4aa70','#d9ceb0','#d78563'][i]!,0,.25+i*.1,0);band.scale.y=.72;band.rotation.x=.2;
    }
    for(let i=0;i<5;i++){const scale=ball(g,.035,'#d8bc76',Math.sin(i*1.4)*.17,.23+i*.045,Math.cos(i*1.4)*.17);scale.scale.set(1,.55,.6);}
    const crack=box(g,.018,.19,.012,'#4f665c',.08,.43,.19);crack.rotation.z=.28;
    for(const y of [.35,.47])ball(g,.024,'#e9d8aa',.08,y,.2);
  }
  return g;
}
