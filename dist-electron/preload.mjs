"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args) {
    const [channel, listener] = args;
    return electron.ipcRenderer.on(channel, (event, ...rest) => listener(event, ...rest));
  },
  off(...args) {
    const [channel, ...rest] = args;
    return electron.ipcRenderer.off(channel, ...rest);
  },
  send(...args) {
    const [channel, ...rest] = args;
    return electron.ipcRenderer.send(channel, ...rest);
  },
  invoke(...args) {
    const [channel, ...rest] = args;
    return electron.ipcRenderer.invoke(channel, ...rest);
  }
});
electron.contextBridge.exposeInMainWorld("api", {
  getCountries: () => electron.ipcRenderer.invoke("get-countries"),
  addCountry: (name) => electron.ipcRenderer.invoke("add-country", name),
  getIssuesByCountry: (countryId) => electron.ipcRenderer.invoke("get-issues-by-country", countryId),
  getMyLibrary: () => electron.ipcRenderer.invoke("get-my-library")
});
