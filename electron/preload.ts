import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("__ELECTRON_CONFIG__", {
  isDesktop: true,
  version: ipcRenderer.sendSync("get-version"),
  supabaseUrl: ipcRenderer.sendSync("get-supabase-url"),
  supabaseAnonKey: ipcRenderer.sendSync("get-supabase-anon-key"),
});
