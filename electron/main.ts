import { app, BrowserWindow, ipcMain } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const require = createRequire(import.meta.url)
const Database = require('better-sqlite3')

type CatalogManifest = {
  version: string
  created_at?: string
  files?: string[]
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let db: any

function initDb() {
  if (!db) {
    const dbPath = path.join(app.getPath('userData'), 'stampdesk.db')
    db = new Database(dbPath)
  }

  const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='country'").get()

  if (!tableCheck) {
    const schemaPath = path.join(process.env.VITE_PUBLIC, 'schema.sql')
    const schema = fs.readFileSync(schemaPath, 'utf8')
    db.exec(schema)
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)
}

function parseVersion(version: string): number[] {
  return version.split('.').map((part) => Number(part) || 0)
}

function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  const max = Math.max(pa.length, pb.length)

  for (let i = 0; i < max; i += 1) {
    const av = pa[i] ?? 0
    const bv = pb[i] ?? 0
    if (av > bv) return 1
    if (av < bv) return -1
  }
  return 0
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let value = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === '"') {
      const next = line[i + 1]
      if (inQuotes && next === '"') {
        value += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === ',' && !inQuotes) {
      result.push(value)
      value = ''
      continue
    }
    value += ch
  }

  result.push(value)
  return result
}

function parseCsv(content: string): Record<string, string>[] {
  const lines = content
    .replace(/\r/g, '')
    .split('\n')
    .filter((line) => line.trim().length > 0)

  if (lines.length === 0) return []

  const headers = parseCsvLine(lines[0]).map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const columns = parseCsvLine(line)
    const row: Record<string, string> = {}
    headers.forEach((header, idx) => {
      row[header] = (columns[idx] ?? '').trim()
    })
    return row
  })
}

function loadCsvRows(catalogDir: string, fileName: string): Record<string, string>[] {
  const filePath = path.join(catalogDir, fileName)
  if (!fs.existsSync(filePath)) return []
  return parseCsv(fs.readFileSync(filePath, 'utf8'))
}

function toNullableText(value: string | undefined): string | null {
  if (!value) return null
  return value.trim() === '' ? null : value.trim()
}

function toNullableInt(value: string | undefined): number | null {
  const text = toNullableText(value)
  if (text === null) return null
  const n = Number(text)
  return Number.isFinite(n) ? n : null
}

function toNullableNumber(value: string | undefined): number | null {
  const text = toNullableText(value)
  if (text === null) return null
  const n = Number(text)
  return Number.isFinite(n) ? n : null
}

function toRequiredInt(value: string | undefined, field: string): number {
  const n = toNullableInt(value)
  if (n === null) {
    throw new Error(`Missing or invalid required integer field: ${field}`)
  }
  return n
}

function getBundledCatalog(): { version: string; dir: string } | null {
  const root = process.env.VITE_PUBLIC
  const dirs = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('catalog_'))

  if (dirs.length === 0) return null

  let best: { version: string; dir: string } | null = null

  for (const dir of dirs) {
    const fullPath = path.join(root, dir.name)
    const manifestPath = path.join(fullPath, 'manifest.json')
    if (!fs.existsSync(manifestPath)) continue

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as CatalogManifest
    if (!manifest.version) continue

    if (!best || compareVersions(manifest.version, best.version) > 0) {
      best = { version: manifest.version, dir: fullPath }
    }
  }

  return best
}

function importCatalog(catalogDir: string) {
  const countries = loadCsvRows(catalogDir, 'country.csv')
  const issues = loadCsvRows(catalogDir, 'issue.csv')
  const stamps = loadCsvRows(catalogDir, 'stamp.csv')
  const variants = loadCsvRows(catalogDir, 'stamp_variant.csv')
  const prices = loadCsvRows(catalogDir, 'catalog_price.csv')

  const upsertCountry = db.prepare(`
    INSERT INTO country (id, parent_id, name, iso2, iso3, valid_from, valid_to)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      parent_id = excluded.parent_id,
      name = excluded.name,
      iso2 = excluded.iso2,
      iso3 = excluded.iso3,
      valid_from = excluded.valid_from,
      valid_to = excluded.valid_to
  `)

  const upsertIssue = db.prepare(`
    INSERT INTO issue (id, country_id, title, year, start_date, end_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      country_id = excluded.country_id,
      title = excluded.title,
      year = excluded.year,
      start_date = excluded.start_date,
      end_date = excluded.end_date,
      notes = excluded.notes
  `)

  const upsertStamp = db.prepare(`
    INSERT INTO stamp (id, issue_id, name, face_value, currency, catalog_no, design_desc, notes, main_image_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      issue_id = excluded.issue_id,
      name = excluded.name,
      face_value = excluded.face_value,
      currency = excluded.currency,
      catalog_no = excluded.catalog_no,
      design_desc = excluded.design_desc,
      notes = excluded.notes,
      main_image_path = excluded.main_image_path
  `)

  const upsertVariant = db.prepare(`
    INSERT INTO stamp_variant (id, stamp_id, variant_code, variant_name, perforation, paper, watermark, color, printing, gum, notes, image_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      stamp_id = excluded.stamp_id,
      variant_code = excluded.variant_code,
      variant_name = excluded.variant_name,
      perforation = excluded.perforation,
      paper = excluded.paper,
      watermark = excluded.watermark,
      color = excluded.color,
      printing = excluded.printing,
      gum = excluded.gum,
      notes = excluded.notes,
      image_path = excluded.image_path
  `)

  const upsertPrice = db.prepare(`
    INSERT INTO catalog_price (id, stamp_id, stamp_variant_id, plate_flaw_id, catalog_name, price_mint, price_used, price_on_cover, currency)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      stamp_id = excluded.stamp_id,
      stamp_variant_id = excluded.stamp_variant_id,
      plate_flaw_id = excluded.plate_flaw_id,
      catalog_name = excluded.catalog_name,
      price_mint = excluded.price_mint,
      price_used = excluded.price_used,
      price_on_cover = excluded.price_on_cover,
      currency = excluded.currency
  `)

  const tx = db.transaction(() => {
    for (const row of countries) {
      upsertCountry.run(
        toRequiredInt(row.id, 'country.id'),
        toNullableInt(row.parent_id),
        toNullableText(row.name),
        toNullableText(row.iso2),
        toNullableText(row.iso3),
        toNullableInt(row.valid_from),
        toNullableInt(row.valid_to),
      )
    }

    for (const row of issues) {
      upsertIssue.run(
        toRequiredInt(row.id, 'issue.id'),
        toRequiredInt(row.country_id, 'issue.country_id'),
        toNullableText(row.title),
        toNullableInt(row.year),
        toNullableText(row.start_date),
        toNullableText(row.end_date),
        toNullableText(row.notes),
      )
    }

    for (const row of stamps) {
      upsertStamp.run(
        toRequiredInt(row.id, 'stamp.id'),
        toRequiredInt(row.issue_id, 'stamp.issue_id'),
        toNullableText(row.name),
        toNullableText(row.face_value),
        toNullableText(row.currency),
        toNullableText(row.catalog_no),
        toNullableText(row.design_desc),
        toNullableText(row.notes),
        toNullableText(row.main_image_path),
      )
    }

    for (const row of variants) {
      upsertVariant.run(
        toRequiredInt(row.id, 'stamp_variant.id'),
        toRequiredInt(row.stamp_id, 'stamp_variant.stamp_id'),
        toNullableText(row.variant_code),
        toNullableText(row.variant_name),
        toNullableText(row.perforation),
        toNullableText(row.paper),
        toNullableText(row.watermark),
        toNullableText(row.color),
        toNullableText(row.printing),
        toNullableText(row.gum),
        toNullableText(row.notes),
        toNullableText(row.image_path),
      )
    }

    for (const row of prices) {
      upsertPrice.run(
        toRequiredInt(row.id, 'catalog_price.id'),
        toNullableInt(row.stamp_id),
        toNullableInt(row.stamp_variant_id),
        toNullableInt(row.plate_flaw_id),
        toNullableText(row.catalog_name) ?? 'ANK',
        toNullableNumber(row.price_mint),
        toNullableNumber(row.price_used),
        toNullableNumber(row.price_on_cover),
        toNullableText(row.currency) ?? 'EUR',
      )
    }
  })

  tx()
}

function applyCatalogUpdateIfNeeded() {
  const bundled = getBundledCatalog()
  if (!bundled) return

  const stored = db.prepare("SELECT value FROM app_meta WHERE key = 'catalog_version'").get() as
    | { value: string }
    | undefined
  const currentVersion = stored?.value ?? '0.0.0'

  if (compareVersions(bundled.version, currentVersion) <= 0) return

  importCatalog(bundled.dir)
  db.prepare(`
    INSERT INTO app_meta (key, value)
    VALUES ('catalog_version', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(bundled.version)
}

ipcMain.handle('get-countries', async () => {
  return db.prepare(`
    SELECT id, name, valid_from, valid_to
    FROM country
    ORDER BY name ASC
  `).all()
})

ipcMain.handle('add-country', async (_, name: string) => {
  const trimmedName = name?.trim()
  if (!trimmedName) {
    throw new Error('Country name is required')
  }

  const year = new Date().getFullYear()
  const insert = db.prepare(`
    INSERT INTO country (name, valid_from)
    VALUES (?, ?)
  `)
  const result = insert.run(trimmedName, year)

  return db.prepare(`
    SELECT id, name, valid_from, valid_to
    FROM country
    WHERE id = ?
  `).get(result.lastInsertRowid)
})

ipcMain.handle('get-issues-by-country', async (_, countryId) => {
  const issues = db.prepare('SELECT * FROM issue WHERE country_id = ? ORDER BY year ASC').all(countryId)

  const stamps = db.prepare(`
    SELECT s.*,
           cp.price_mint,
           (SELECT COUNT(*) FROM collection_item ci
            JOIN stamp_variant sv ON ci.stamp_variant_id = sv.id
            WHERE sv.stamp_id = s.id) as owned_count
    FROM stamp s
    LEFT JOIN catalog_price cp ON s.id = cp.stamp_id
    JOIN issue i ON s.issue_id = i.id
    WHERE i.country_id = ?
  `).all(countryId)

  return { issues, stamps }
})

ipcMain.handle('get-my-library', async () => {
  return db.prepare(`
    SELECT
      ci.id AS collection_item_id,
      ci.quantity,
      ci.status,
      ci.note AS item_note,
      ci.acquired_at,
      sv.id AS stamp_variant_id,
      sv.variant_name,
      s.id AS stamp_id,
      s.name AS stamp_name,
      s.face_value,
      s.currency,
      s.catalog_no,
      s.main_image_path,
      s.notes AS stamp_notes,
      cp.price_mint,
      i.id AS issue_id,
      i.title AS issue_title,
      i.year AS issue_year,
      c.id AS country_id,
      c.name AS country_name
    FROM collection_item ci
    LEFT JOIN stamp_variant sv ON ci.stamp_variant_id = sv.id
    LEFT JOIN stamp s ON sv.stamp_id = s.id
    LEFT JOIN issue i ON s.issue_id = i.id
    LEFT JOIN country c ON i.country_id = c.id
    LEFT JOIN catalog_price cp ON cp.stamp_variant_id = sv.id
    WHERE ci.status = 'OWNED'
    ORDER BY c.name ASC, i.year ASC, s.catalog_no ASC, s.name ASC, ci.id ASC
  `).all()
})

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  initDb()
  applyCatalogUpdateIfNeeded()
  createWindow()
})
