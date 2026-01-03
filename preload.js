const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectTopicsFile: () => ipcRenderer.invoke('select-topics-file'),
  saveQrels: (content) => ipcRenderer.invoke('save-qrels', content),
  autosaveQrels: (content) => ipcRenderer.invoke('autosave-qrels', content),
  loadQrels: () => ipcRenderer.invoke('load-qrels')
});

