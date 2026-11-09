// Brücke zwischen App-Oberfläche und Hauptprogramm (Update-Knopf, Amazon-Treffer für den Produktlink)
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  installNow: () => ipcRenderer.invoke('update:install'),
  amazonSearch: query => ipcRenderer.invoke('amazon:search', String(query || '')),
  onStatus: cb => {
    const h = (_e, s) => cb(s);
    ipcRenderer.on('update:status', h);
    return () => ipcRenderer.removeListener('update:status', h);
  }
});
