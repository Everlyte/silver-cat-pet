const {contextBridge,ipcRenderer}=require('electron');
const subscribe=(channel,callback)=>{const listener=(_event,data)=>callback(data);ipcRenderer.on(channel,listener);return()=>ipcRenderer.removeListener(channel,listener);};
contextBridge.exposeInMainWorld('silverCat',{
  interactive:value=>ipcRenderer.send('cat:interactive',value),
  preview:()=>ipcRenderer.send('cat:preview'),
  quit:()=>ipcRenderer.send('cat:quit'),
  onCursor:cb=>subscribe('cat:cursor',cb),
  onCommand:cb=>subscribe('cat:command',cb),
  onWorkArea:cb=>subscribe('cat:workarea',cb)
});
