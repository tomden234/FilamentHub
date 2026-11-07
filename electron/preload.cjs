// Brücke zwischen App-Oberfläche und Hauptprogramm (nur für Update-Knopf)
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  installNow: () => ipcRenderer.invoke('update:install'),
  onStatus: cb => {
    const h = (_e, s) => cb(s);
    ipcRenderer.on('update:status', h);
    return () => ipcRenderer.removeListener('update:status', h);
  }
});
