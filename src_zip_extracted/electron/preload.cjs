const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('storyAPI', {
  fetchChapter: (url) => ipcRenderer.invoke('story:fetch-chapter', url),
  geminiGenerate: (payload) => ipcRenderer.invoke('story:gemini-generate', payload),
  geminiListModels: (payload) => ipcRenderer.invoke('story:gemini-list-models', payload)
});
