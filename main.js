// NeonRealm desktop app — runs the web game (the files in the app/ folder) in its own window.
// On top of the plain game it adds what a browser normally provides: camera/microphone permission,
// a screen picker for screen sharing in group calls, and a remembered window size.
const { app, BrowserWindow, protocol, net, session, shell, desktopCapturer, ipcMain, Menu, systemPreferences, dialog, screen } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const APP_DIR = path.join(__dirname, 'app');
const HOME = 'app://neonrealm/index.html';
// OPTIONAL: if your game is online (for example on Firebase Hosting), put its address here and the app will load it,
// so players always get your newest version without reinstalling. Leave it '' to use the copy inside the app.
// Example: const WEB_URL = 'https://your-project.web.app/index.html';
const WEB_URL = '';
const START = WEB_URL || HOME;

// app://neonrealm/… behaves like a normal secure website (needed for camera, microphone, storage and logins).
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
if (process.platform === 'win32') app.setAppUserModelId('com.neonrealm.game');

let win = null;
const ours = url => {
  try { if (url.startsWith('app://neonrealm/')) return true; return !!WEB_URL && new URL(url).origin === new URL(WEB_URL).origin; }
  catch (e) { return false; }
};
const openOutside = url => { if (/^(https?:|mailto:)/i.test(url)) shell.openExternal(url); };

// ---------- window (remembers its size and position) ----------
const stateFile = () => path.join(app.getPath('userData'), 'window.json');
function loadState() { try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch (e) { return {}; } }
function saveState() { if (!win || win.isDestroyed()) return; try { fs.writeFileSync(stateFile(), JSON.stringify({ ...win.getNormalBounds(), max: win.isMaximized() })); } catch (e) { } }
const visible = b => b && Number.isFinite(b.x) && screen.getAllDisplays().some(d => { const a = d.workArea; return b.x < a.x + a.width - 80 && b.x + b.width > a.x + 80 && b.y >= a.y - 20 && b.y < a.y + a.height - 80; });

function createWindow() {
  const st = loadState(), place = visible(st);
  win = new BrowserWindow({
    width: Math.max(900, st.width || 1400), height: Math.max(600, st.height || 880), x: place ? st.x : undefined, y: place ? st.y : undefined,
    minWidth: 900, minHeight: 600, backgroundColor: '#0a0f24', title: 'NeonRealm', show: false, autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false, backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required' }
  });
  if (st.max) win.maximize();
  win.once('ready-to-show', () => win.show());
  win.on('close', saveState);
  win.on('closed', () => { win = null; });
  // If your website can't be reached (offline), fall back to the copy inside the app.
  win.webContents.on('did-fail-load', (e, code, desc, url, mainFrame) => { if (mainFrame && WEB_URL && code !== -3 && !url.startsWith('app://')) win.loadURL(HOME); });
  win.loadURL(START);
}

// ---------- links: game pages stay in the app, other websites open in the normal browser ----------
app.on('web-contents-created', (e, wc) => {
  wc.setWindowOpenHandler(({ url }) => { if (ours(url) && win && wc === win.webContents) win.loadURL(url); else openOutside(url); return { action: 'deny' }; });
  wc.on('will-navigate', (ev, url) => { if (!ours(url)) { ev.preventDefault(); openOutside(url); } });
  wc.on('will-attach-webview', ev => ev.preventDefault());
});

// ---------- macOS privacy settings helper ----------
const asked = new Set();
function needAccess(kind) {
  if (process.platform !== 'darwin' || asked.has(kind) || !win) return; asked.add(kind);
  const label = { microphone: 'Microphone', camera: 'Camera', screen: 'Screen & System Audio Recording' }[kind];
  const pane = { microphone: 'Privacy_Microphone', camera: 'Privacy_Camera', screen: 'Privacy_ScreenCapture' }[kind];
  dialog.showMessageBox(win, {
    type: 'info', buttons: ['Open System Settings', 'Not now'], defaultId: 0, cancelId: 1,
    message: `NeonRealm needs ${label} access`,
    detail: `Turn on NeonRealm in System Settings → Privacy & Security → ${label}, then ${kind === 'screen' ? 'quit NeonRealm (⌘Q) and open it again' : 'try again'}.`
  }).then(r => { if (r.response === 0) shell.openExternal(`x-apple.systempreferences:com.apple.preference.security?${pane}`); }).catch(() => { });
}

// ---------- screen picker for screen sharing ----------
function pickSource(sources) {
  return new Promise(resolve => {
    const pk = new BrowserWindow({
      parent: win || undefined, modal: !!win, width: 860, height: 620, minWidth: 560, minHeight: 420, title: 'Share your screen',
      backgroundColor: '#0a0f24', autoHideMenuBar: true, show: false, minimizable: false, maximizable: false,
      webPreferences: { preload: path.join(__dirname, 'picker-preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
    });
    let settled = false;
    const end = v => { if (settled) return; settled = true; ipcMain.removeListener('nr-picked', onPick); resolve(v); if (!pk.isDestroyed()) pk.close(); };
    const onPick = (ev, v) => { if (!pk.isDestroyed() && ev.sender === pk.webContents) end(v && typeof v.id === 'string' ? v : null); };
    ipcMain.on('nr-picked', onPick);
    pk.on('closed', () => end(null));
    const list = sources.map(s => ({
      id: s.id, name: s.name, screen: s.id.startsWith('screen:'),
      thumb: s.thumbnail && !s.thumbnail.isEmpty() ? s.thumbnail.toDataURL() : '',
      icon: s.appIcon && !s.appIcon.isEmpty() ? s.appIcon.resize({ width: 32, height: 32 }).toDataURL() : ''
    }));
    pk.webContents.once('did-finish-load', () => pk.webContents.send('nr-sources', { list, platform: process.platform }));
    pk.once('ready-to-show', () => pk.show());
    pk.loadFile(path.join(__dirname, 'picker.html'));
  });
}

app.whenReady().then(() => {
  if (!gotLock) return;

  // Serve the game files from the app/ folder at app://neonrealm/…
  protocol.handle('app', async req => {
    const u = new URL(req.url);
    if (u.host !== 'neonrealm') return new Response('Not found', { status: 404 });
    let rel = decodeURIComponent(u.pathname); if (rel === '/' || !rel) rel = '/index.html';
    const file = path.join(APP_DIR, rel), inside = path.relative(APP_DIR, file);
    if (!inside || inside.startsWith('..') || path.isAbsolute(inside)) return new Response('Forbidden', { status: 403 });
    try { return await net.fetch(pathToFileURL(file).toString()); } catch (e) { return new Response('Not found', { status: 404 }); }
  });

  // Camera, microphone, notifications, fullscreen and mouse lock are allowed for the game's own pages only.
  const ALLOW = new Set(['media', 'display-capture', 'notifications', 'fullscreen', 'pointerLock', 'clipboard-sanitized-write', 'speaker-selection']);
  session.defaultSession.setPermissionRequestHandler(async (wc, permission, cb, details) => {
    if (!ALLOW.has(permission) || !ours((details && details.requestingUrl) || wc.getURL())) return cb(false);
    if (permission === 'media' && process.platform === 'darwin') {
      const want = (details && details.mediaTypes) || [];
      try {
        if (want.includes('audio') && !(await systemPreferences.askForMediaAccess('microphone'))) { needAccess('microphone'); return cb(false); }
        if (want.includes('video') && !(await systemPreferences.askForMediaAccess('camera'))) { needAccess('camera'); return cb(false); }
      } catch (e) { }
    }
    cb(true);
  });

  // Screen sharing: browsers show their own picker, the app shows picker.html.
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    let done = false;
    const finish = s => { if (done) return; done = true; try { callback(s); } catch (e) { } }; // callback({}) = cancelled
    try {
      if (!ours(request.securityOrigin ? request.securityOrigin + '/' : (request.frame && request.frame.url) || '')) return finish({});
      if (process.platform === 'darwin' && systemPreferences.getMediaAccessStatus('screen') === 'denied') { needAccess('screen'); return finish({}); }
      const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 400, height: 225 }, fetchWindowIcons: true });
      if (!sources.length) { if (process.platform === 'darwin') needAccess('screen'); return finish({}); }
      const choice = await pickSource(sources), src = choice && sources.find(s => s.id === choice.id);
      if (!src) return finish({});
      // Computer sound can be shared on Windows ("loopback"); other systems share the picture only.
      finish(choice.audio && process.platform === 'win32' ? { video: src, audio: 'loopback' } : { video: src });
    } catch (e) { console.error('screen share', e); finish({}); }
  });

  // Menu (F11 = full screen). No Ctrl+W "close", so holding Ctrl while walking with W can't close the game.
  const mac = process.platform === 'darwin';
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(mac ? [{ role: 'appMenu' }] : [{ label: 'File', submenu: [{ label: 'Home (hub)', click: () => win && win.loadURL(START) }, { type: 'separator' }, { role: 'quit' }] }]),
    { role: 'editMenu' },
    { label: 'View', submenu: [
      ...(mac ? [{ label: 'Home (hub)', click: () => win && win.loadURL(START) }, { type: 'separator' }] : []),
      { role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' }, { type: 'separator' },
      { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    ...(mac ? [{ role: 'windowMenu' }] : [])
  ]));

  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
