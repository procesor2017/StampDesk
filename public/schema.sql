-- StampDesk Schema v2.1 (SQLite) - s podporou obrázků v katalogu
PRAGMA foreign_keys = ON;

BEGIN;

-- =========================
-- 1) CATALOG (reference data)
-- =========================

CREATE TABLE IF NOT EXISTS country (
  id            INTEGER PRIMARY KEY,
  parent_id     INTEGER, 
  name          TEXT NOT NULL,
  iso2          TEXT,
  iso3          TEXT,
  valid_from    INTEGER, 
  valid_to      INTEGER, 
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(parent_id) REFERENCES country(id) ON DELETE SET NULL,
  UNIQUE(name),
  UNIQUE(iso2),
  UNIQUE(iso3)
);

CREATE TABLE IF NOT EXISTS issue (
  id            INTEGER PRIMARY KEY,
  country_id    INTEGER NOT NULL,
  title         TEXT NOT NULL,
  year          INTEGER,
  start_date    TEXT, 
  end_date      TEXT, 
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(country_id) REFERENCES country(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  UNIQUE(country_id, title, year)
);

CREATE TABLE IF NOT EXISTS stamp (
  id               INTEGER PRIMARY KEY,
  issue_id         INTEGER NOT NULL,
  name             TEXT NOT NULL,
  face_value       TEXT, 
  currency         TEXT, 
  catalog_no       TEXT, 
  design_desc      TEXT,
  notes            TEXT,
  main_image_path  TEXT, -- CESTA K OBRÁZKU PRO KATALOG (např. 'cat/at_1850_1kr.jpg')
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(issue_id) REFERENCES issue(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  UNIQUE(issue_id, name, face_value, currency, catalog_no)
);

CREATE TABLE IF NOT EXISTS stamp_variant (
  id            INTEGER PRIMARY KEY,
  stamp_id      INTEGER NOT NULL,
  variant_code  TEXT, 
  variant_name  TEXT NOT NULL,
  perforation   TEXT,
  paper         TEXT,
  watermark     TEXT,
  color         TEXT,
  printing      TEXT,
  gum           TEXT,
  notes         TEXT,
  image_path    TEXT, -- FOTO VARIANTY (např. detail papíru nebo barvy)
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(stamp_id) REFERENCES stamp(id) ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE(stamp_id, variant_name)
);

CREATE TABLE IF NOT EXISTS plate_flaw (
  id               INTEGER PRIMARY KEY,
  stamp_id         INTEGER NOT NULL,
  stamp_variant_id INTEGER,
  flaw_code        TEXT NOT NULL,
  title            TEXT NOT NULL,
  description      TEXT,
  position         TEXT,
  image_path       TEXT, -- FOTO DESKOVÉ VADY (např. makro detail vady)
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(stamp_id) REFERENCES stamp(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY(stamp_variant_id) REFERENCES stamp_variant(id) ON DELETE SET NULL ON UPDATE CASCADE,
  UNIQUE(stamp_id, stamp_variant_id, flaw_code)
);

CREATE TABLE IF NOT EXISTS catalog_price (
  id                INTEGER PRIMARY KEY,
  stamp_id          INTEGER,
  stamp_variant_id  INTEGER,
  plate_flaw_id     INTEGER,
  catalog_name      TEXT DEFAULT 'ANK', -- ANK, Michel, Scott...
  price_mint        REAL, -- Cena čisté (MNH/**)
  price_used        REAL, -- Cena použité (Used/o)
  price_on_cover    REAL, -- Cena na dopise
  currency          TEXT DEFAULT 'EUR',
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(stamp_id) REFERENCES stamp(id) ON DELETE CASCADE,
  FOREIGN KEY(stamp_variant_id) REFERENCES stamp_variant(id) ON DELETE CASCADE,
  FOREIGN KEY(plate_flaw_id) REFERENCES plate_flaw(id) ON DELETE CASCADE
);

-- =========================
-- 2) STORAGE & STATUS
-- =========================

CREATE TABLE IF NOT EXISTS storage_location (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE, 
  description TEXT
);

-- =========================
-- 3) LOOKUPS
-- =========================

CREATE TABLE IF NOT EXISTS item_form (
  id    INTEGER PRIMARY KEY,
  code  TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL
);

INSERT OR IGNORE INTO item_form(code, label) VALUES
  ('SINGLE','Single stamp'), ('COVER','Cover'), ('BLOCK','Block'),
  ('STRIP','Strip'), ('SHEET','Sheet'), ('OTHER','Other');

CREATE TABLE IF NOT EXISTS condition_grade (
  id    INTEGER PRIMARY KEY,
  code  TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL
);

INSERT OR IGNORE INTO condition_grade(code, label) VALUES
  ('MNH','Mint never hinged'), ('MLH','Mint lightly hinged'),
  ('MH','Mint hinged'), ('USED','Used'), ('CTO','CTO'), ('OTHER','Other');

-- =========================
-- 4) COLLECTION
-- =========================

CREATE TABLE IF NOT EXISTS collection_item (
  id                  INTEGER PRIMARY KEY,
  stamp_variant_id    INTEGER,
  plate_flaw_id       INTEGER,
  form_id             INTEGER NOT NULL,
  condition_id        INTEGER,
  storage_id          INTEGER, 
  status              TEXT NOT NULL DEFAULT 'OWNED', 
  cancellation_text   TEXT,
  quantity            INTEGER NOT NULL DEFAULT 1,
  note                TEXT,
  acquired_at         TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(stamp_variant_id) REFERENCES stamp_variant(id) ON DELETE SET NULL,
  FOREIGN KEY(storage_id) REFERENCES storage_location(id) ON DELETE SET NULL,
  FOREIGN KEY(form_id) REFERENCES item_form(id) ON DELETE RESTRICT,
  CHECK(status IN ('OWNED', 'WISH_LIST', 'SOLD')),
  CHECK(quantity >= 1)
);

CREATE TABLE IF NOT EXISTS item_photo (
  id                 INTEGER PRIMARY KEY,
  collection_item_id INTEGER NOT NULL,
  path               TEXT NOT NULL, -- FOTKA KONKRÉTNÍHO KUSU UŽIVATELE
  caption            TEXT,
  FOREIGN KEY(collection_item_id) REFERENCES collection_item(id) ON DELETE CASCADE
);

-- =========================
-- 5) TRANSACTIONS
-- =========================

CREATE TABLE IF NOT EXISTS party (
  id          INTEGER PRIMARY KEY,
  type        TEXT NOT NULL, 
  name        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK(type IN ('SHOP','AUCTION','PERSON','OTHER'))
);

CREATE TABLE IF NOT EXISTS tx (
  id            INTEGER PRIMARY KEY,
  tx_type       TEXT NOT NULL, 
  party_id      INTEGER,
  tx_date       TEXT NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'CZK',
  shipping_cost INTEGER NOT NULL DEFAULT 0,
  fee_cost      INTEGER NOT NULL DEFAULT 0,
  total_cost    INTEGER, 
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(party_id) REFERENCES party(id) ON DELETE SET NULL,
  CHECK(tx_type IN ('BUY','SELL'))
);

CREATE TABLE IF NOT EXISTS tx_line (
  id                 INTEGER PRIMARY KEY,
  tx_id              INTEGER NOT NULL,
  collection_item_id INTEGER NOT NULL,
  line_cost          INTEGER NOT NULL DEFAULT 0, 
  quantity           INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY(tx_id) REFERENCES tx(id) ON DELETE CASCADE,
  FOREIGN KEY(collection_item_id) REFERENCES collection_item(id) ON DELETE RESTRICT
);

-- =========================
-- 6) TRIGGERS
-- =========================

CREATE TRIGGER trg_country_updated AFTER UPDATE ON country BEGIN UPDATE country SET updated_at = datetime('now') WHERE id = OLD.id; END;
CREATE TRIGGER trg_issue_updated AFTER UPDATE ON issue BEGIN UPDATE issue SET updated_at = datetime('now') WHERE id = OLD.id; END;
CREATE TRIGGER trg_stamp_updated AFTER UPDATE ON stamp BEGIN UPDATE stamp SET updated_at = datetime('now') WHERE id = OLD.id; END;
CREATE TRIGGER trg_stamp_variant_updated AFTER UPDATE ON stamp_variant BEGIN UPDATE stamp_variant SET updated_at = datetime('now') WHERE id = OLD.id; END;
CREATE TRIGGER trg_plate_flaw_updated AFTER UPDATE ON plate_flaw BEGIN UPDATE plate_flaw SET updated_at = datetime('now') WHERE id = OLD.id; END;
CREATE TRIGGER trg_collection_item_updated AFTER UPDATE ON collection_item BEGIN UPDATE collection_item SET updated_at = datetime('now') WHERE id = OLD.id; END;
CREATE TRIGGER trg_tx_updated AFTER UPDATE ON tx BEGIN UPDATE tx SET updated_at = datetime('now') WHERE id = OLD.id; END;

-- =========================
-- 7) INDEXES
-- =========================

CREATE INDEX idx_issue_country ON issue(country_id);
CREATE INDEX idx_stamp_issue ON stamp(issue_id);
CREATE INDEX idx_item_status ON collection_item(status);

COMMIT;