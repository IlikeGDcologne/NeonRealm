# NeonRealm Desktop

NeonRealm as a downloadable app for Windows, Mac and Linux, built with Electron. It's the same game as the
website, with group calls (mic, face cam and screen share) working inside the app.

## What's in this folder

| File / folder | What it does |
|---|---|
| `app/` | The game itself: the same files as your website (`index.html`, `game.js`, `call.js`, …) |
| `main.js` | Opens the game window and allows camera/mic. Shows the screen picker and remembers the window size |
| `picker.html`, `picker-preload.js` | The "Share your screen" picker window |
| `build/icon.png` | App icon (1024×1024). Replace it with your own PNG if you like |
| `package.json` | App name, version and installer settings |
| `.github/workflows/release.yml` | Builds the Windows + Mac + Linux installers on GitHub |

## 1. One-time setup

Install **Node.js 22 or newer** from https://nodejs.org (the "LTS" button). Check it in a terminal:

```
node -v
```

## 2. Run the app on your computer

Open a terminal in this folder (Windows: right-click the folder → "Open in Terminal"; Mac: drag the folder onto
Terminal), then:

```
npm install
npm start
```

`npm install` is only needed the first time. After that, `npm start` opens the app.

## 3. Make an installer

```
npm run dist
```

The installer appears in the `dist/` folder:

- Windows: `NeonRealm-Setup-1.0.0.exe`
- Mac: `NeonRealm-1.0.0-mac.dmg` (works on Intel and Apple Silicon)
- Linux: `NeonRealm-1.0.0-linux-x86_64.AppImage` and `NeonRealm-1.0.0-linux-amd64.deb`

Each computer can only build its own kind of installer. To get all three at once, use GitHub (step 4).

## 4. Build Windows + Mac + Linux on GitHub (free) and share a download link

1. Create a new repository at https://github.com/new (for example `neonrealm-desktop`).
2. In a terminal in this folder (replace `YOUR-NAME`):

   ```
   git init
   git add .
   git commit -m "NeonRealm desktop app"
   git branch -M main
   git remote add origin https://github.com/YOUR-NAME/neonrealm-desktop.git
   git push -u origin main
   ```

3. Start a build by pushing a version tag:

   ```
   git tag v1.0.0
   git push origin v1.0.0
   ```

4. Wait about 10–15 minutes. You can watch it run in the repository's **Actions** tab.
5. Open the repository's **Releases** page. "NeonRealm v1.0.0" has all the installers. Send friends that link.
   If the repository is private, friends can't open it. Make it public, or download the installers and share them
   another way (Google Drive, itch.io, …).

## 5. Updating the game later

1. Copy your changed game files into `app/`, replacing the old ones.
2. In `package.json`, raise `"version"` (for example `1.0.0` → `1.0.1`).
3. Run:

   ```
   git add .
   git commit -m "Update"
   git push
   git tag v1.0.1
   git push origin v1.0.1
   ```

Players download and install the new version over the old one. Their login and settings are kept.

*Optional:* if your game is hosted online (for example Firebase Hosting), put its address in `WEB_URL` at the top of
`main.js`. The app will then always load your newest version without a reinstall, and it falls back to the copy in
`app/` when offline.

## First launch on your friends' computers

The app isn't signed with a paid certificate, so the operating system warns once:

- **Windows** shows "Windows protected your PC". Click **More info** → **Run anyway**.
- **Mac** says "Apple could not verify NeonRealm". Open **System Settings → Privacy & Security**, scroll down and
  click **Open Anyway**. On macOS 14 or older you can instead right-click the app → **Open**.
- **Linux AppImage**: run `chmod +x NeonRealm-*.AppImage`, then double-click it. Ubuntu 22.04+ needs
  `sudo apt install libfuse2`. If it closes right away on Ubuntu 24.04+, use the `.deb` instead:
  `sudo apt install ./NeonRealm-1.0.0-linux-amd64.deb`

These warnings only go away with paid code signing: the Apple Developer Program ($99/year) plus a Windows
code-signing certificate.

## Camera, microphone and screen sharing

- **Mac:** the first call asks for Microphone and Camera access; click Allow. For screen sharing, turn NeonRealm
  on in **System Settings → Privacy & Security → Screen & System Audio Recording**, then quit (⌘Q) and reopen
  the app.
- **Windows:** if the mic or camera doesn't work, open **Settings → Privacy & security → Camera** (and
  **Microphone**) and turn on **"Let desktop apps access your camera/microphone"**. When you share your screen
  on Windows you can tick "Share computer sound too".

## Firebase

- Publish the new `database.rules.json` (Firebase console → Realtime Database → Rules → paste → **Publish**).
  Group calls need it.
- Email/password login works in the app with no extra setup. If you ever restricted your Firebase API key to
  certain websites in Google Cloud, remove that restriction or the app can't log in.

## Troubleshooting

- **`npm install` fails:** update Node.js to 22 or newer.
- **Blank window:** in the app's menu pick **View → Toggle Developer Tools** and read the red errors in Console.
- **Calls connect for some friends but not others:** some school/office networks block direct connections. Add a
  TURN relay in `app/firebase-config.js` (see the note at the top of `app/call.js`).
