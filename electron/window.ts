import { BrowserWindow, Menu, app, dialog, type MenuItemConstructorOptions } from "electron";
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
    },
  });

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
        { role: "forceReload" },
        { role: "toggleDevTools" },
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
