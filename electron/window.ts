import {
  BrowserWindow,
  Menu,
  app,
  dialog,
  shell,
  type MenuItemConstructorOptions,
  type WebContents,
} from "electron";
import { join } from "path";
import { getAppVersion } from "./version";

let mainWindow: BrowserWindow | null = null;

export function createMainWindow(nextPort: number, startPath: string = ""): BrowserWindow {
  const version = getAppVersion();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 720,
    title: `UnstableLabs v${version}`,
    backgroundColor: "#141618",
    show: false,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      spellcheck: false,
      devTools: !app.isPackaged,
    },
  });

  lockDown(mainWindow.webContents, `http://127.0.0.1:${nextPort}`);
  mainWindow.loadURL(`http://127.0.0.1:${nextPort}${startPath}`);

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  buildMenu(version);

  return mainWindow;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

/** Hosts whose links may open in the player's default browser. */
const EXTERNAL_HOSTS = new Set(["phantom.app", "solscan.io", "explorer.solana.com"]);

function openExternalSafe(url: string): void {
  try {
    const u = new URL(url);
    if (u.protocol === "https:" && !u.username && !u.password && EXTERNAL_HOSTS.has(u.hostname)) {
      void shell.openExternal(u.toString());
    }
  } catch {
    // not a URL — ignore
  }
}

/**
 * The window only ever shows the bundled game server. Navigation elsewhere,
 * popups, webviews and every permission prompt (camera, mic, geolocation,
 * notifications, HID/USB/serial …) are refused; a short list of https links
 * opens in the default browser instead.
 */
function lockDown(contents: WebContents, appOrigin: string): void {
  const isApp = (url: string): boolean => {
    try {
      return new URL(url).origin === appOrigin;
    } catch {
      return false;
    }
  };
  contents.setWindowOpenHandler(({ url }) => {
    openExternalSafe(url);
    return { action: "deny" };
  });
  const guard = (event: Electron.Event, url: string): void => {
    if (isApp(url)) return;
    event.preventDefault();
    openExternalSafe(url);
  };
  contents.on("will-navigate", guard);
  contents.on("will-redirect", guard);
  contents.on("will-attach-webview", (event) => event.preventDefault());

  const ses = contents.session;
  const allowed = new Set(["fullscreen", "clipboard-sanitized-write"]);
  ses.setPermissionRequestHandler((wc, permission, callback) => {
    callback(allowed.has(permission) && isApp(wc.getURL()));
  });
  ses.setPermissionCheckHandler((_wc, permission, origin) => {
    return allowed.has(permission) && origin === appOrigin;
  });
}

function buildMenu(version: string) {
  const isMac = process.platform === "darwin";

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              {
                label: `About UnstableLabs v${version}`,
                click: () => showAbout(version),
              },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const },
            ],
          },
        ]
      : []),
    {
      label: "View",
      submenu: [
        { role: "reload" },
        ...(app.isPackaged
          ? []
          : [{ role: "forceReload" as const }, { role: "toggleDevTools" as const }]),
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "close" }],
    },
    ...(!isMac
      ? [
          {
            label: "Help",
            submenu: [
              {
                label: `About UnstableLabs v${version}`,
                click: () => showAbout(version),
              },
            ],
          },
        ]
      : []),
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function showAbout(version: string) {
  dialog.showMessageBox({
    type: "info",
    title: "About UnstableLabs",
    message: `UnstableLabs v${version}`,
    detail: [
      "Retro cyberpunk idle laboratory simulation.",
      "",
      `Version: ${version}`,
      `Electron: ${process.versions.electron}`,
      `Node: ${process.versions.node}`,
      `Platform: ${process.platform} ${process.arch}`,
    ].join("\n"),
  });
}
