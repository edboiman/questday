import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import { createWorld, type WorldSpec } from './scenes';
import { isSceneTap, cameraAngle } from './interaction';
import { clearMaterials } from './models';

interface Props {spec:WorldSpec;onSelect:(target:string)=>void; label:string;}
export function WorldCanvas({spec,onSelect,label}:Props) {
  const host=useRef<HTMLDivElement>(null), callback=useRef(onSelect);
  callback.current=onSelect;
  const [retry,setRetry]=useState(0);
  const [failed,setFailed]=useState(false),[paused,setPaused]=useState(false),[dusk,setDusk]=useState(false),[angle,setAngle]=useState(0),[zoom,setZoom]=useState(1);
  const controls=useRef({paused,dusk,angle,zoom}); controls.current={paused,dusk,angle,zoom};
  useEffect(()=>{
    const container=host.current;if(!container)return;
    let renderer:T.WebGLRenderer;
    try {renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});}catch{setFailed(true);return;}
    setFailed(false);
    const scene=new T.Scene();scene.background=new T.Color('#e6e8d7');
    const world=createWorld(spec);scene.add(world.root);
    const camera=new T.OrthographicCamera(-8,8,6,-6,.1,100);
    const ambient=new T.HemisphereLight('#fff6df','#617569',2.4);scene.add(ambient);
    const sun=new T.DirectionalLight('#fff1d4',3.1);sun.position.set(-5,12,8);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-15;sun.shadow.camera.right=15;sun.shadow.camera.top=15;sun.shadow.camera.bottom=-15;sun.shadow.normalBias=.04;scene.add(sun);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;
    const canvas=renderer.domElement;canvas.setAttribute('aria-label',label);canvas.setAttribute('role','img');container.appendChild(canvas);
    let running=true,intersecting=true,frame=0,last=0,time=0,dirty=true;
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');
    const resize=()=>{const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);const aspect=w/h;const span=world.radius/controls.current.zoom;camera.left=-span*aspect;camera.right=span*aspect;camera.top=span;camera.bottom=-span;camera.updateProjectionMatrix();dirty=true;};
    const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(container);
    const observer=new IntersectionObserver(([e])=>{intersecting=e.isIntersecting;last=0;dirty=true;});observer.observe(container);
    let start:{x:number;y:number}|null=null;
    const down=(e:PointerEvent)=>{start=e.isPrimary?{x:e.clientX,y:e.clientY}:null;};
    const cancel=()=>{start=null;};
    const ray=new T.Raycaster();const pointer=new T.Vector2();
    const select=(event:PointerEvent)=>{const tap=isSceneTap(start,{x:event.clientX,y:event.clientY});start=null;if(event.button!==0||!running||!tap)return;const r=canvas.getBoundingClientRect();pointer.set(((event.clientX-r.left)/r.width)*2-1,-((event.clientY-r.top)/r.height)*2+1);ray.setFromCamera(pointer,camera);for(const hit of ray.intersectObjects(world.root.children,true)){let node:T.Object3D|null=hit.object;while(node){if(typeof node.userData.target==='string'){callback.current(node.userData.target);return;}node=node.parent;}}};
    canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointercancel',cancel);canvas.addEventListener('pointerup',select);
    const lost=(e:Event)=>{e.preventDefault();running=false;cancelAnimationFrame(frame);setFailed(true);};canvas.addEventListener('webglcontextlost',lost);
    const visibility=()=>{last=0;dirty=true;};document.addEventListener('visibilitychange',visibility);media.addEventListener('change',visibility);
    let prev='';
    function tick(now:number){
      if(!running)return;frame=requestAnimationFrame(tick);
      if(document.hidden||!intersecting){last=0;return;}
      const c=controls.current,signature=`${c.paused}:${c.dusk}:${c.angle}:${c.zoom}`;
      if(prev!==signature){prev=signature;resize();dirty=true;}
      const move=spec.kind==='town'&&!c.paused&&!media.matches;
      if(!dirty&&!move)return;
      if(last&&now-last<33)return;
      const dt=last?Math.min((now-last)/1000,.05):0;last=now;if(move)time+=dt;
      world.update(time);
      const a=Math.PI/4+c.angle;camera.position.set(Math.sin(a)*18,16,Math.cos(a)*18);camera.lookAt(0,spec.kind==='museum'?.5:0,0);
      scene.background=new T.Color(c.dusk?'#263e49':'#e6e8d7');ambient.intensity=c.dusk?1.2:2.4;sun.intensity=c.dusk?1.4:3.1;sun.color.set(c.dusk?'#efb78c':'#fff1d4');
      try {renderer.render(scene,camera);dirty=false;} catch {running=false;cancelAnimationFrame(frame);setFailed(true);}
    }
    resize();frame=requestAnimationFrame(tick);
    return ()=>{
      running=false;cancelAnimationFrame(frame);resizeObserver.disconnect();observer.disconnect();document.removeEventListener('visibilitychange',visibility);media.removeEventListener('change',visibility);canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointercancel',cancel);canvas.removeEventListener('pointerup',select);canvas.removeEventListener('webglcontextlost',lost);
      const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();
      world.root.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
      geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());clearMaterials();sun.shadow.map?.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();
    };
  },[spec,label,retry]);
  return <div className="world-frame">
    <div className="world-toolbar" role="group" aria-label="Scene controls">
      <button className="btn small" type="button" onClick={()=>setAngle(a=>cameraAngle(a-Math.PI/4,spec.kind==='museum'))} aria-label="Rotate view left">↶</button>
      <button className="btn small" type="button" onClick={()=>setAngle(a=>cameraAngle(a+Math.PI/4,spec.kind==='museum'))} aria-label="Rotate view right">↷</button>
      <button className="btn small" type="button" onClick={()=>setZoom(z=>z===1?1.35:1)} aria-pressed={zoom!==1}>Zoom</button>
      <button className="btn small" type="button" onClick={()=>setDusk(x=>!x)} aria-pressed={dusk}>Evening</button>
      <button className="btn small" type="button" onClick={()=>setPaused(x=>!x)} aria-pressed={paused}>{paused?'Resume':'Pause'}</button>
      <button className="btn small" type="button" onClick={()=>{setAngle(0);setZoom(1);}}>Reset view</button>
    </div>
    <div ref={host} className={`world-canvas${failed?' world-unavailable':''}`}/>
    {failed&&<p className="world-fallback" role="status">3D is unavailable on this device. Use the controls outside the scene to continue. <button className="btn small" type="button" onClick={()=>setRetry(x=>x+1)}>Retry 3D</button></p>}
    <div className="world-legend"><span>{spec.kind==='town'?spec.rohld?'Select a building, neighbor or Rohld':'Select a building or a neighbor':spec.kind==='museum'?'Select a display case':'Rotate the view to inspect this piece'}</span><span>Local 3D · reduced motion supported</span></div>
  </div>;
}
