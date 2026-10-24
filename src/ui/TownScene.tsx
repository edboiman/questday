import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { BUILDINGS, SEASON_LABEL, rosterEntry, type Season } from '../domain/city';
import type { Building, ResidentRow, ResidentId } from '../domain/types';
import { BuildingArt, ResidentFace } from './CityArt';

export function townPoint(x: number, y: number, size: number) {
  return { x: 110 + size * 48 + (x - y) * 48, y: 86 + (x + y) * 30 };
}

function Tree({ x, y, autumn }: { x: number; y: number; autumn: boolean }) {
  return <g transform={`translate(${x} ${y})`} className="town-tree">
    <ellipse cy="7" rx="19" ry="7" fill="#163c39" opacity=".13" />
    <path d="M0 7V-38" stroke="#77523b" strokeWidth="6" strokeLinecap="round" />
    <path d="M-25-20Q-34-40-15-48Q-19-72 0-74Q22-75 19-51Q40-41 26-20Q4-8-25-20" fill={autumn ? '#c87945' : '#4d8665'} />
    <path d="M-22-35Q-29-48-11-53Q-10-72 4-69Q18-68 15-51Q29-43 20-34Z" fill={autumn ? '#e6aa61' : '#79a77a'} />
  </g>;
}

export function Villager({ id, index = 0 }: { id: ResidentId; index?: number }) {
  const entry = rosterEntry(id);
  const coat = ['#527e88', '#b66e72', '#686ba0', '#cb934c', '#63916f'][index % 5];
  return <g className="town-villager-body">
    <ellipse cx="0" cy="0" rx="12" ry="4" fill="#173f32" opacity=".24" />
    <g className="town-step"><path d="M-5-10L-6-1M5-10L6-1" stroke="#493f42" strokeWidth="6" strokeLinecap="round" /></g>
    <path d="M-8-24Q0-29 8-24L10-8Q0-4-10-8Z" fill={coat} stroke="#fff6d9" strokeWidth="1" />
    <path d="M-9-22L-14-13M9-22L14-13" stroke={coat} strokeWidth="5" strokeLinecap="round" />
    <svg x="-17" y="-52" width="34" height="34" viewBox="0 0 40 40"><ResidentFace species={entry.species} size={40} /></svg>
    <path d="M-7-22Q0-18 7-22" fill="none" stroke="#f3d492" strokeWidth="3" />
  </g>;
}

interface Props {
  size: number; buildings: Building[]; residents: ResidentRow[]; season: Season;
  placing: boolean; onTile: (x: number, y: number) => void; onResident: (id: ResidentId) => void;
}

export function TownScene({ size, buildings, residents, season, placing, onTile, onResident }: Props) {
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [grid, setGrid] = useState(false);
  const [zoom, setZoom] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let intersecting = true;
    const update = () => setVisible(intersecting && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => { intersecting = entry.isIntersecting; update(); });
    if (ref.current) observer.observe(ref.current);
    document.addEventListener('visibilitychange', update);
    update();
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', update); };
  }, []);
  const width = 220 + size * 96;
  const height = 180 + size * 60;
  const corner = (x: number, y: number) => { const p = townPoint(x, y, size); return `${p.x},${p.y}`; };
  const tiles = new Map(buildings.map(b => [`${b.x},${b.y}`, b]));
  const keyboard = (event: React.KeyboardEvent<SVGGElement>, action: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); action(); }
  };
  return <div ref={ref} className={`living-town season-${season}${paused || !visible ? ' town-paused' : ''}${grid || placing ? ' show-plots' : ''}`}>
    <div className="town-toolbar">
      <div><span className="town-eyebrow">A LITTLE WORLD OF YOUR OWN</span><strong>{SEASON_LABEL[season]} in your town</strong></div>
      <div className="town-controls">
        <button className="btn small" type="button" aria-pressed={grid} onClick={() => setGrid(!grid)}>Plots</button>
        <button className="btn small" type="button" aria-pressed={zoom} onClick={() => setZoom(!zoom)}>Zoom</button>
        <button className="btn small" type="button" aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? 'Resume motion' : 'Pause motion'}</button>
      </div>
    </div>
    <div className={`town-viewport${zoom ? ' town-zoomed' : ''}`}>
      <svg className="town-world" style={{ minWidth: width }} viewBox={`0 0 ${width} ${height}`} role="group" aria-label={`Town map, ${size} by ${size}`}>
        <defs>
          <linearGradient id="town-water" x2="1" y2="1"><stop stopColor="#77bec0"/><stop offset="1" stopColor="#4a929e"/></linearGradient>
          <linearGradient id="town-grass" x2="0" y2="1"><stop stopColor="var(--town-grass-top)"/><stop offset="1" stopColor="var(--town-grass-bottom)"/></linearGradient>
        </defs>
        <ellipse cx={width / 2} cy={height - 62} rx={width * .36} ry="27" fill="#264f3a" opacity=".09" />
        <g aria-hidden="true">
          <path d={`M0 ${height * .61} Q${width * .23} ${height * .7} ${width * .3} ${height}H0Z`} fill="url(#town-water)"/>
          <path className="town-ripple" d={`M10 ${height * .79}q35-9 67 0m-35 22q25-7 48 0m-70 22q35-9 67 0`} fill="none" stroke="#d5f2e5" strokeWidth="3" opacity=".65"/>
          {Array.from({length: 7}, (_,i) => <Tree key={i} x={70 + i * (width - 140) / 6} y={57 + Math.abs(i-3)*17} autumn={season === 'autumn'} />)}
          <polygon points={`${corner(0, size)} ${corner(size, size)} ${corner(size, 0)} ${corner(size, 0).split(',')[0]},${townPoint(size,0,size).y+18} ${townPoint(size,size,size).x},${townPoint(size,size,size).y+18} ${townPoint(0,size,size).x},${townPoint(0,size,size).y+18}`} fill="#71936a" />
          <polygon points={`${corner(0,0)} ${corner(size,0)} ${corner(size,size)} ${corner(0,size)}`} fill="#d8cba5" stroke="#ecdfb6" strokeWidth="6" strokeLinejoin="round" />
        </g>
        {Array.from({ length: size * size }, (_,i) => ({ x:i%size, y:Math.floor(i/size) })).sort((a,b)=>(a.x+a.y)-(b.x+b.y)).map(({x,y})=>{
          const p = townPoint(x+.5,y+.5,size);
          const b = tiles.get(`${x},${y}`);
          return <g key={`${x},${y}`} className={`town-plot${b ? ' occupied' : ''}`} role="button" tabIndex={0}
            aria-label={b ? `${BUILDINGS[b.type].name}, row ${y+1} column ${x+1}` : `Empty tile, row ${y+1} column ${x+1}`}
            onClick={()=>onTile(x,y)} onKeyDown={e=>keyboard(e,()=>onTile(x,y))}>
            <title>{b ? BUILDINGS[b.type].name : 'Build here'}</title>
            <path className="town-tile" d={`M${p.x} ${p.y-25}l40 25-40 25-40-25Z`} fill="url(#town-grass)" />
            {!b && <><path className="town-grass-tuft" d={`M${p.x-14} ${p.y+7}l-3-6m3 6 4-5m19-3-2-5m2 5 4-4`} stroke="#5f8d61" strokeWidth="1.5" fill="none"/><path className="town-plot-plus" d={`M${p.x-6} ${p.y}h12m-6-6v12`} stroke="#fff9df" strokeWidth="2"/></>}
            {b && <g className="town-building" transform={`translate(${p.x-35} ${p.y-53})`}><BuildingArt type={b.type} size={70}/>{['cottage','bakery','cafe'].includes(b.type) && <g className="town-smoke" fill="#fff9eb" opacity=".6"><circle cx="48" cy="11" r="3"/><circle cx="51" cy="3" r="4"/><circle cx="48" cy="-6" r="5"/></g>}</g>}
          </g>;
        })}
        <g aria-hidden="true"><Tree x={width - 75} y={height-100} autumn={season==='autumn'} /><Tree x={width-43} y={height-77} autumn={season==='autumn'} /></g>
        {residents.map((resident,i)=>{
          const entry=rosterEntry(resident.id);
          const favorite=buildings.find(b=>b.type===entry.fav);
          const x=favorite?.x ?? i%size; const y=favorite?.y ?? Math.floor(i/size)%size;
          const a=townPoint(x,y,size), b=townPoint(x+1,y,size), c=townPoint(x+1,y+1,size), d=townPoint(x,y+1,size);
          const style={ '--ax':`${a.x}px`, '--ay':`${a.y}px`, '--bx':`${b.x}px`, '--by':`${b.y}px`, '--cx':`${c.x}px`, '--cy':`${c.y}px`, '--dx':`${d.x}px`, '--dy':`${d.y}px`, animationDuration:`${22+i*2}s`, animationDelay:`-${i*4}s` } as CSSProperties;
          return <g key={resident.id} style={style} className="town-walker" role="button" tabIndex={0} aria-label={`Talk to ${entry.name}`} onClick={()=>onResident(resident.id)} onKeyDown={e=>keyboard(e,()=>onResident(resident.id))}>
            <title>{entry.name} · {entry.title}</title><rect className="town-resident-hit" x="-24" y="-54" width="48" height="56" rx="12" fill="transparent"/><Villager id={resident.id} index={i}/>
          </g>;
        })}
        <g className="town-cloud" aria-hidden="true" fill="#fffdf3" opacity=".6"><ellipse cx={width*.32} cy="40" rx="38" ry="10"/><ellipse cx={width*.32-10} cy="34" rx="18" ry="12"/></g>
      </svg>
    </div>
    <div className="town-caption"><span><i className="town-live-dot"/>{residents.length ? `${residents.length} residents · tap a friend to say hello` : 'Your next chapter starts with a cottage'}</span><span>Scroll to explore · tap a plot to build</span></div>
    <p className="town-motion-note">Your device’s reduced-motion setting is respected.</p>
  </div>;
}
