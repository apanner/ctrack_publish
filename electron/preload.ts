import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(channel: string, listener: (event: unknown, ...args: unknown[]) => void): () => void {
    const wrapper = (event: unknown, ...args: unknown[]) => listener(event, ...args)
    ipcRenderer.on(channel, wrapper)
    return () => ipcRenderer.off(channel, wrapper)
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  removeListener(...args: Parameters<typeof ipcRenderer.off>) {
    return ipcRenderer.off(...args)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },

  // You can expose other APTs you need here.
  // ...
})
