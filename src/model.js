export const DEFAULTS = Object.freeze({size:240, interval:12, roam:true, sound:false, paused:false});
export const ACTIONS = Object.freeze({idle:'眨眼待机',walk:'散散步',wave:'挥爪招呼',annoyed:'小脾气',drag:'被提起来',sleep:'打个盹',jump:'跳一下'});
export function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
export function normalizeSettings(raw = {}) {
  if (!raw || typeof raw !== 'object') raw = {};
  const number = (key,min,max) => Number.isFinite(raw[key]) ? clamp(raw[key],min,max) : DEFAULTS[key];
  return {size:number('size',140,360),interval:number('interval',5,60),roam:typeof raw.roam==='boolean'?raw.roam:true,sound:raw.sound===true,paused:raw.paused===true};
}
export function constrainPosition(x,y,width,height,size) {
  return {x:clamp(Number.isFinite(x)?x:0,0,Math.max(0,width-size)),y:clamp(Number.isFinite(y)?y:0,0,Math.max(0,height-size*416/384))};
}
// Weighted frame durations preserve a long resting pose and a quick blink.
export function frameAt(elapsed, durations) {
  const total = durations.reduce((a,b)=>a+b,0);
  let time = ((elapsed % total) + total) % total;
  for(let i=0;i<durations.length;i++){if(time<durations[i])return i;time-=durations[i];}
  return durations.length-1;
}
export function walkStep(x,direction,dt,speed,minX,maxX) {
  const next=x+direction*speed*Math.min(Math.max(dt,0),0.05);
  return {x:clamp(next,minX,Math.max(minX,maxX)),direction:next>=maxX?-1:next<=minX?1:direction};
}
