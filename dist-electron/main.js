import { ipcMain, app, BrowserWindow } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
const require$1 = createRequire(import.meta.url);
const Database = require$1("better-sqlite3");
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let db;
function initDb() {
  if (!db) {
    const dbPath = path.join(app.getPath("userData"), "stampdesk.db");
    db = new Database(dbPath);
  }
  const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='country'").get();
  if (!tableCheck) {
    try {
      const schemaPath = path.join(process.env.VITE_PUBLIC, "schema.sql");
      console.log("Načítám schéma z:", schemaPath);
      const schema = fs.readFileSync(schemaPath, "utf8");
      db.exec(schema);
      console.log("Databáze byla úspěšně inicializována.");
    } catch (err) {
      console.error("Kritická chyba: Nelze načíst schema.sql z public složky:", err);
    }
  }
}
ipcMain.handle("get-countries", async () => {
  return db.prepare(`
    SELECT id, name, valid_from, valid_to 
    FROM country 
    ORDER BY name ASC
  `).all();
});
ipcMain.handle("add-country", async (_, name) => {
  const trimmedName = name == null ? void 0 : name.trim();
  if (!trimmedName) {
    throw new Error("Country name is required");
  }
  const year = (/* @__PURE__ */ new Date()).getFullYear();
  const insert = db.prepare(`
    INSERT INTO country (name, valid_from)
    VALUES (?, ?)
  `);
  const result = insert.run(trimmedName, year);
  return db.prepare(`
    SELECT id, name, valid_from, valid_to
    FROM country
    WHERE id = ?
  `).get(result.lastInsertRowid);
});
ipcMain.handle("get-issues-by-country", async (_, countryId) => {
  const issues = db.prepare(`SELECT * FROM issue WHERE country_id = ? ORDER BY year ASC`).all(countryId);
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
  `).all(countryId);
  return { issues, stamps };
});
ipcMain.handle("get-my-library", async () => {
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
  `).all();
});
let win;
function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs")
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(() => {
  initDb();
  createWindow();
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
