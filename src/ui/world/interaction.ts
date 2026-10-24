/** Prevent a touch scroll or drag from spending gems on a plot. */
export function isSceneTap(start: {x:number;y:number}|null, end: {x:number;y:number}) {
  return start !== null && Number.isFinite(end.x) && Number.isFinite(end.y) && Math.hypot(end.x-start.x,end.y-start.y)<=6;
}
export function cameraAngle(angle:number, room:boolean) {return room?Math.max(-Math.PI/4,Math.min(Math.PI/4,angle)):angle;}
