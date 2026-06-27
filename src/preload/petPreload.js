import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('desktopPet', {
  getState: () => ipcRenderer.invoke('state:get'),
  setPreference: (key, value) => ipcRenderer.invoke('state:setPreference', key, value),
  triggerEvent: (type) => ipcRenderer.invoke('event:trigger', type),
  openPetMenu: () => ipcRenderer.invoke('pet:openMenu'),
  beginDrag: () => ipcRenderer.send('pet:beginDrag'),
  dragBy: (dx, dy) => ipcRenderer.send('pet:dragBy', dx, dy),
  onState: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on('state:changed', handler);
    return () => ipcRenderer.removeListener('state:changed', handler);
  }
});
