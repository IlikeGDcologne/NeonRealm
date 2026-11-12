// Bridge between the screen picker window (picker.html) and main.js. Nothing else is exposed.
const { contextBridge, ipcRenderer } = require('electron');
let data = null, listener = null;
ipcRenderer.on('nr-sources', (e, d) => { data = d; if (listener) listener(d); });
contextBridge.exposeInMainWorld('picker', {
  onSources: f => { listener = f; if (data) f(data); },
  choose: (id, audio) => ipcRenderer.send('nr-picked', { id: String(id), audio: !!audio }),
  cancel: () => ipcRenderer.send('nr-picked', null)
});
