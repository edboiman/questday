import { useMemo, useState } from 'react';
import { BUILDINGS, rosterEntry, SEASON_LABEL, type Season } from '../domain/city';
import type { Building, ResidentId, ResidentRow } from '../domain/types';
import { WorldCanvas } from './world/WorldCanvas';
import type { WorldSpec } from './world/scenes';
import { BuildingArt, ResidentFace, RohldFace } from './CityArt';
interface Props {size:number;buildings:Building[];residents:ResidentRow[];season:Season;placing:boolean;rohldUnlocked:boolean;onTile:(x:number,y:number)=>void;onResident:(id:ResidentId)=>void;onRohld:()=>void;}
export function TownWorld({size,buildings,residents,season,placing,rohldUnlocked,onTile,onResident,onRohld}:Props){
  const [plots,setPlots]=useState(false);
  const spec=useMemo<WorldSpec>(()=>({kind:'town',size,buildings,residents,season,rohld:rohldUnlocked}),[size,buildings,residents,season,rohldUnlocked]);
  const byTile=new Map(buildings.map(b=>[`${b.x},${b.y}`,b]));
  const select=(target:string)=>{const [kind,a,b]=target.split(':');if(kind==='tile'){const x=Number(a),y=Number(b);if(Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0&&x<size&&y<size)onTile(x,y);}else if(kind==='resident'){const r=residents.find(r=>r.id===a);if(r)onResident(r.id);}else if(kind==='visitor'&&a==='rohld'&&rohldUnlocked)onRohld();};
  return <section className="town-world-section">
    <div className="world-heading"><div><span className="world-kicker">THE LITTLE THINGS BECOME A WORLD</span><h2>A place to come back to</h2><p>{SEASON_LABEL[season]} · {buildings.length} buildings · {residents.length} neighbors{rohldUnlocked?' · Rohld is visiting':''}</p></div><span className="world-badge">Your town</span></div>
    <WorldCanvas spec={spec} onSelect={select} label="Three-dimensional town with buildings, paths and residents"/>
    <div className="world-action-row"><p>{residents.length?'Meet a neighbor below, or select them in the town.':'Build a cottage and amenities to welcome your first neighbor.'}</p><button className="btn" type="button" aria-expanded={plots||placing} onClick={()=>setPlots(x=>!x)}>{plots?'Hide plots':'Build & manage plots'}</button></div>
    {(plots||placing)&&<div className="town-plots" role="group" aria-label={`Town plots, ${size} by ${size}`}>
      {Array.from({length:size*size},(_,i)=>{const x=i%size,y=Math.floor(i/size),b=byTile.get(`${x},${y}`);return <button className="town-plot-control" type="button" key={i} onClick={()=>onTile(x,y)} aria-label={`${b?BUILDINGS[b.type].name:'Empty tile'}, row ${y+1} column ${x+1}`}>
        {b?<BuildingArt type={b.type} size={36}/>:<span aria-hidden="true">＋</span>}<span>{x+1}, {y+1}</span>
      </button>;})}
    </div>}
    {!!residents.length||rohldUnlocked?<div className="neighbor-strip" aria-label="Talk to residents and visitors">{residents.map(r=><button className="neighbor-chip" type="button" key={r.id} onClick={()=>onResident(r.id)}><ResidentFace species={rosterEntry(r.id).species} size={32}/><span>{rosterEntry(r.id).name}</span></button>)}{rohldUnlocked&&<button className="neighbor-chip rohld-chip" type="button" onClick={onRohld}><RohldFace size={32}/><span>Rohld <small>visitor</small></span></button>}</div>:null}
  </section>;
}
