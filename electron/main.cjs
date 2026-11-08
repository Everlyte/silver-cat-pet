// Transparent overlay and pointer passthrough inspired by DeepSeek-Pet.
// This shell uses its own namespace and never reads or migrates upstream data.
const {app,BrowserWindow,ipcMain,screen,Tray,Menu,nativeImage}=require('electron');
const path=require('node:path');
const ROOT=path.join(__dirname,'..');
const TEST=process.argv.includes('--smoke-test');
app.setName('Silver Cat Pet');
app.setPath('userData',path.join(app.getPath('appData'),TEST?'SilverCatPet-Test':'SilverCatPet'));
let pet,preview,tray,poll;
function union(){const ds=screen.getAllDisplays().map(d=>d.workArea);const x=Math.min(...ds.map(d=>d.x)),y=Math.min(...ds.map(d=>d.y));return{x,y,width:Math.max(...ds.map(d=>d.x+d.width))-x,height:Math.max(...ds.map(d=>d.y+d.height))-y};}
function secure(win){
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',e=>e.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_w,_p,cb)=>cb(false));
}
function sendArea(){const b=pet.getBounds(),p=screen.getPrimaryDisplay().workArea;pet.webContents.send('cat:workarea',{x:p.x-b.x,y:p.y-b.y,width:p.width,height:p.height});}
function showPreview(){
  if(preview&&!preview.isDestroyed()){preview.show();preview.focus();return;}
  preview=new BrowserWindow({width:1220,height:850,title:'Silver Cat Pet · 动作预览',backgroundColor:'#f4f5ef',webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
  secure(preview);preview.loadFile(path.join(ROOT,'index.html'));preview.on('closed',()=>preview=null);
}
function authorized(event){return pet&&!pet.isDestroyed()&&event.sender===pet.webContents&&event.senderFrame===pet.webContents.mainFrame;}
if(!app.requestSingleInstanceLock()){app.quit();}else{
app.on('second-instance',()=>{if(pet){pet.showInactive();pet.webContents.send('cat:command','center');}});
app.whenReady().then(async()=>{
  pet=new BrowserWindow({...union(),transparent:true,backgroundColor:'#00000000',frame:false,hasShadow:false,resizable:false,movable:false,minimizable:false,maximizable:false,fullscreenable:false,focusable:false,skipTaskbar:true,show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
  secure(pet);pet.setAlwaysOnTop(true,'floating');pet.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});pet.setIgnoreMouseEvents(true,{forward:true});
  ipcMain.on('cat:interactive',(event,value)=>{if(authorized(event)&&typeof value==='boolean')pet.setIgnoreMouseEvents(!value,{forward:true});});
  ipcMain.on('cat:preview',event=>{if(authorized(event))showPreview();});
  ipcMain.on('cat:quit',event=>{if(authorized(event))app.quit();});
  await pet.loadFile(path.join(ROOT,'index.html'));sendArea();
  if(!TEST)pet.showInactive();
  poll=setInterval(()=>{if(pet.isDestroyed())return;const c=screen.getCursorScreenPoint(),b=pet.getBounds();pet.webContents.send('cat:cursor',{x:c.x-b.x,y:c.y-b.y});},60);
  const resize=()=>{if(!pet.isDestroyed()){pet.setBounds(union());sendArea();}};
  screen.on('display-added',resize);screen.on('display-removed',resize);screen.on('display-metrics-changed',resize);
  tray=new Tray(nativeImage.createFromPath(path.join(ROOT,'assets/icon.png')).resize({width:22,height:22}));
  tray.setToolTip('银渐层桌宠');tray.setContextMenu(Menu.buildFromTemplate([
    {label:'银渐层 · Silver Cat Pet',enabled:false},
    {label:'找回猫咪',click:()=>{pet.showInactive();pet.webContents.send('cat:command','center');}},
    {label:'暂停 / 继续',click:()=>pet.webContents.send('cat:command','pause')},
    {label:'打开动作预览',click:showPreview},
    {type:'separator'},{label:'退出',click:()=>app.quit()}
  ]));
  if(process.platform==='darwin'&&!TEST)app.dock.hide();
  if(TEST){
    const deadline=Date.now()+15000;let state;
    do{state=await pet.webContents.executeJavaScript('window.petDebug?.getState()');if(state?.ready)break;await new Promise(r=>setTimeout(r,100));}while(Date.now()<deadline);
    if(!state?.ready){console.error('SMOKE FAIL: renderer did not initialize');app.exit(1);return;}
    console.log('SMOKE PASS: sandboxed transparent window loaded all animations',JSON.stringify(state));app.quit();
  }
}).catch(error=>{console.error(error);app.exit(1);});
app.on('before-quit',()=>clearInterval(poll));
app.on('window-all-closed',()=>app.quit());
}
