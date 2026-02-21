import { ipcRenderer, contextBridge } from 'electron'

type Country = {
  id: number
  name: string
  valid_from: number
  valid_to: number | null
}

type Issue = {
  id: number
  country_id: number
  title: string
  year: number
}

type Stamp = {
  id: number
  issue_id: number
  name: string
  face_value: string
  currency: string
  catalog_no: string
  main_image_path: string | null
  price_mint: number | null
  owned_count: number
  design_desc?: string
  notes?: string
}

type LibraryItem = {
  collection_item_id: number
  quantity: number
  status: 'OWNED' | 'WISH_LIST' | 'SOLD'
  item_note: string | null
  acquired_at: string | null
  stamp_variant_id: number | null
  variant_name: string | null
  stamp_id: number | null
  stamp_name: string | null
  face_value: string | null
  currency: string | null
  catalog_no: string | null
  main_image_path: string | null
  stamp_notes: string | null
  price_mint: number | null
  issue_id: number | null
  issue_title: string | null
  issue_year: number | null
  country_id: number | null
  country_name: string | null
}

// Expose a minimal IPC surface to renderer.
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...rest) => listener(event, ...rest))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...rest] = args
    return ipcRenderer.off(channel, ...rest)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...rest] = args
    return ipcRenderer.send(channel, ...rest)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...rest] = args
    return ipcRenderer.invoke(channel, ...rest)
  },
})

contextBridge.exposeInMainWorld('api', {
  getCountries: (): Promise<Country[]> => ipcRenderer.invoke('get-countries'),
  addCountry: (name: string): Promise<Country> => ipcRenderer.invoke('add-country', name),
  getIssuesByCountry: (countryId: number): Promise<{ issues: Issue[]; stamps: Stamp[] }> =>
    ipcRenderer.invoke('get-issues-by-country', countryId),
  getMyLibrary: (): Promise<LibraryItem[]> => ipcRenderer.invoke('get-my-library'),
})
