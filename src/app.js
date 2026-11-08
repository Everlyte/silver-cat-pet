import {ACTIONS,normalizeSettings,constrainPosition,frameAt,walkStep,clamp} from './model.js';
const desktop=window.silverCat;
if(desktop)document.documentElement.classList.add('desktop');
const $=id=>document.getElementById(id);
const stage=$('stage'),canvas=$('pet'),ctx=canvas.getContext('2d',{willReadFrequently:true}),menu=$('pet-menu'),menuToggle=$('menu-toggle');
let settings=normalizeSettings();
try{settings=normalizeSettings(JSON.parse(localStorage.getItem('silver-cat.settings')));}catch{}
let manifest,images={},position={x:0,y:0},action='idle',started=0,last=0,direction=1,autoAt=0,drag=null,menuOpen=false,frame=-1,ready=false,workArea=null;
let lastInteractive=null,audioContext;
const save=()=>{try{localStorage.setItem('silver-cat.settings',JSON.stringify(settings));}catch{}};
function bounds(){return {width:stage.clientWidth,height:stage.clientHeight};}
function place(){
  const b=bounds();position=constrainPosition(position.x,position.y,b.width,b.height,settings.size);
  Object.assign(canvas.style,{left:position.x+'px',top:position.y+'px',width:settings.size+'px',height:settings.size*416/384+'px'});
  Object.assign(menuToggle.style,{left:clamp(position.x+settings.size-28,0,b.width-32)+'px',top:clamp(position.y+settings.size*.18,0,b.height-30)+'px'});
  if(menuOpen){Object.assign(menu.style,{left:clamp(position.x+settings.size-20,8,Math.max(8,b.width-202))+'px',top:clamp(position.y+settings.size*.3,8,Math.max(8,b.height-menu.offsetHeight-8))+'px'});}
}
function center(){
  const b=workArea||{x:0,y:0,...bounds()};
  position={x:b.x+(b.width-settings.size)/2,y:b.y+(b.height-settings.size*416/384)/2};place();
}
function updateControls(){
  $('size').value=settings.size;$('size-value').value=settings.size+' px';
  $('interval').value=settings.interval;$('interval-value').value=settings.interval+' 秒';
  $('roam').checked=settings.roam;$('sound').checked=settings.sound;$('pause').textContent=settings.paused?'继续':'暂停';
  $('status').textContent=settings.paused?'暂停中 · 随时继续':ACTIONS[action];
  document.querySelectorAll('[data-action]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.action===action)));
}
function play(name,{force=false}={}){
  if(!ready||!ACTIONS[name]||drag&&!force)return;
  action=name;started=performance.now();frame=-1;autoAt=started+settings.interval*1000;
  updateControls();draw(0);
  window.dispatchEvent(new CustomEvent('pet-action',{detail:name}));
}
function draw(elapsed){
  if(!manifest)return;
  const state=manifest.states[action],i=frameAt(elapsed,state.durations);
  if(i===frame&&action!=='walk')return;
  frame=i;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.save();
  if(action==='walk'&&direction<0){ctx.translate(canvas.width,0);ctx.scale(-1,1);}
  ctx.drawImage(images[action],i*manifest.cellWidth,0,manifest.cellWidth,manifest.cellHeight,0,0,canvas.width,canvas.height);ctx.restore();
}
function tick(now){
  const dt=last?Math.min((now-last)/1000,.05):0;last=now;
  if(!ready){requestAnimationFrame(tick);return;}
  if(settings.paused){started+=dt*1000;autoAt+=dt*1000;}else{
    if(action==='walk'&&!drag&&!menuOpen){const b=bounds();const s=walkStep(position.x,direction,dt,settings.size*.24,0,b.width-settings.size);position.x=s.x;direction=s.direction;place();}
    draw(now-started);
    const spec=manifest.states[action];
    if(!drag&&!menuOpen){
      if(action!=='idle'&&now-started>spec.hold){play('idle');}
      else if(action==='idle'&&now>autoAt){const pool=settings.roam?['walk','wave','sleep','jump']:['wave','sleep','annoyed'];play(pool[Math.floor(Math.random()*pool.length)]);}
    }
  }
  requestAnimationFrame(tick);
}
function meow(){
  if(!settings.sound)return;
  try{
    audioContext ||= new (window.AudioContext||window.webkitAudioContext)();audioContext.resume();
    const t=audioContext.currentTime,o=audioContext.createOscillator(),g=audioContext.createGain();
    o.type='sine';o.frequency.setValueAtTime(660,t);o.frequency.exponentialRampToValueAtTime(440,t+.16);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.07,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+.22);
    o.connect(g).connect(audioContext.destination);o.start(t);o.stop(t+.24);
  }catch{}
}
function setPaused(value){settings.paused=value;save();updateControls();}
function changeSize(value){const previous=settings.size;settings.size=clamp(value,140,360);position.y+=(previous-settings.size)*416/384;place();save();updateControls();}
function setMenu(open){
  menuOpen=open;menu.hidden=!open;
  if(open){
    menu.replaceChildren();
    const add=(label,fn)=>{const b=document.createElement('button');b.textContent=label;b.setAttribute('role','menuitem');b.onclick=()=>{fn();setMenu(false);};menu.append(b);};
    for(const [name,label]of Object.entries(ACTIONS))if(name!=='drag')add(label,()=>play(name));
    menu.append(document.createElement('hr'));
    add(settings.paused?'继续陪伴':'暂停动作',()=>setPaused(!settings.paused));
    add(settings.roam?'关闭自动漫游':'开启自动漫游',()=>{settings.roam=!settings.roam;if(!settings.roam&&action==='walk')play('idle');save();updateControls();});
    add(settings.sound?'关闭点击音效':'开启点击音效',()=>{settings.sound=!settings.sound;save();updateControls();});
    add('放大一点',()=>changeSize(settings.size+20));add('缩小一点',()=>changeSize(settings.size-20));
    add('动作间隔：'+settings.interval+'秒',()=>{settings.interval=settings.interval>=30?5:settings.interval+5;autoAt=performance.now()+settings.interval*1000;save();updateControls();});
    add('回到中央',center);
    if(desktop){add('打开动作预览',()=>desktop.preview());add('退出桌宠',()=>desktop.quit());}
    place();
  }
}
function hit(x,y){
  if(!ready)return false;
  const p=canvas.getBoundingClientRect();
  if(x<p.left||y<p.top||x>=p.right||y>=p.bottom)return false;
  const px=Math.floor((x-p.left)*canvas.width/p.width),py=Math.floor((y-p.top)*canvas.height/p.height);
  return ctx.getImageData(px,py,1,1).data[3]>30;
}
function nativeHit(x,y){
  const inRect=el=>{const r=el.getBoundingClientRect();return x>=r.left&&x<r.right&&y>=r.top&&y<r.bottom;};
  const r=canvas.getBoundingClientRect();const near=x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;
  menuToggle.classList.toggle('visible',near||menuOpen||inRect(menuToggle));
  const value=!!drag||hit(x,y)||inRect(menuToggle)||(menuOpen&&inRect(menu));
  if(value!==lastInteractive){lastInteractive=value;desktop?.interactive(value);}
}
canvas.addEventListener('pointerdown',e=>{
  if(e.button!==0||!hit(e.clientX,e.clientY))return;
  setMenu(false);drag={id:e.pointerId,startX:e.clientX,startY:e.clientY,x:position.x,y:position.y,moved:false};canvas.setPointerCapture(e.pointerId);e.preventDefault();
});
canvas.addEventListener('pointermove',e=>{
  if(!drag)return;
  const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;
  if(!drag.moved&&Math.hypot(dx,dy)>5){drag.moved=true;canvas.classList.add('dragging');play('drag',{force:true});}
  if(drag.moved){position={x:drag.x+dx,y:drag.y+dy};place();}
});
function release(e){if(!drag)return;const moved=drag.moved;drag=null;canvas.classList.remove('dragging');if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(moved)play('idle');else{play(Math.random()<.5?'wave':'annoyed');meow();}}
canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',e=>{if(drag){drag=null;canvas.classList.remove('dragging');play('idle');}});
canvas.addEventListener('contextmenu',e=>{e.preventDefault();setMenu(!menuOpen);});
canvas.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();play('wave');meow();}});
menuToggle.onclick=e=>{e.stopPropagation();setMenu(!menuOpen);};
document.addEventListener('pointerdown',e=>{if(menuOpen&&!menu.contains(e.target)&&e.target!==menuToggle)setMenu(false);});
document.addEventListener('keydown',e=>{if(e.key==='Escape')setMenu(false);});
for(const [name,label]of Object.entries(ACTIONS)){const b=document.createElement('button');b.textContent=label;b.dataset.action=name;b.onclick=()=>play(name);$('actions').append(b);}
$('size').oninput=e=>changeSize(+e.target.value);
$('interval').oninput=e=>{settings.interval=+e.target.value;autoAt=performance.now()+settings.interval*1000;save();updateControls();};
$('roam').onchange=e=>{settings.roam=e.target.checked;if(!settings.roam&&action==='walk')play('idle');save();};
$('sound').onchange=e=>{settings.sound=e.target.checked;save();};
$('pause').onclick=()=>setPaused(!settings.paused);$('center').onclick=center;
new ResizeObserver(()=>{if(ready)place();}).observe(stage);
desktop?.onCursor(({x,y})=>nativeHit(x,y));
desktop?.onCommand(name=>{if(name==='center')center();else if(name==='pause')setPaused(!settings.paused);else play(name);});
desktop?.onWorkArea(rect=>{workArea=rect;if(ready)center();});
try{
  const response=await fetch('assets/animations/manifest.json');if(!response.ok)throw Error('动画清单加载失败');manifest=await response.json();
  await Promise.all(Object.entries(manifest.states).map(async([name,spec])=>{const image=new Image();image.src='assets/animations/'+spec.file;await image.decode();images[name]=image;}));
  ready=true;center();play('idle');updateControls();
  window.petDebug=Object.freeze({play,center,getState:()=>({action,frame,position:{...position},settings:{...settings},ready}),hit});
}catch(error){$('error').hidden=false;$('error').textContent='猫咪加载失败：'+error.message+'。请通过本地预览服务器或桌面应用打开。';console.error(error);}
requestAnimationFrame(tick);
