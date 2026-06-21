const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('storyAPI', {
  fetchChapter: (url, bookTitle) => ipcRenderer.invoke('story:fetch-chapter', url, bookTitle),
  appendTitleDebugLog: (message) => ipcRenderer.invoke('story:append-title-debug-log', message),
  fetchHtml: (url) => ipcRenderer.invoke('story:fetch-html', url),
  geminiGenerate: (payload) => ipcRenderer.invoke('story:gemini-generate', payload),
  geminiListModels: (payload) => ipcRenderer.invoke('story:gemini-list-models', payload),
  logError: (msg) => ipcRenderer.invoke('story:log-error', msg),
  saveChapterContent: (payload) => ipcRenderer.invoke('story:save-chapter-content', payload),
  loadChapterContent: (payload) => ipcRenderer.invoke('story:load-chapter-content', payload),
  deleteBookChapters: (payload) => ipcRenderer.invoke('story:delete-book-chapters', payload),
  saveSettings: (data) => ipcRenderer.invoke('story:save-settings', data),
  loadSettings: () => ipcRenderer.invoke('story:load-settings'),
  openDownloadsFolder: () => ipcRenderer.invoke('story:open-downloads-folder')
});
