PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS counters (
  name TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO counters (name, value) VALUES ("accession", 0), ("public", 0);

CREATE TABLE IF NOT EXISTS people (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_normalized TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_people_name ON people(name);

CREATE TABLE IF NOT EXISTS publishers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_normalized TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_publishers_name ON publishers(name);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_normalized TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);

CREATE TABLE IF NOT EXISTS languages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_normalized TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_languages_name ON languages(name);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_normalized TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  accession_code TEXT NOT NULL UNIQUE,
  accession_year INTEGER NOT NULL,
  accession_serial INTEGER NOT NULL,
  public_serial INTEGER NOT NULL UNIQUE,
  public_code TEXT NOT NULL UNIQUE,
  title TEXT,
  title_search TEXT,
  subtitle TEXT,
  original_title TEXT,
  publisher_id INTEGER REFERENCES publishers(id) ON DELETE SET NULL,
  imprint TEXT,
  isbn10 TEXT,
  isbn13 TEXT,
  edition TEXT,
  printing_number TEXT,
  publication_year INTEGER,
  publication_country TEXT,
  language_id INTEGER REFERENCES languages(id) ON DELETE SET NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  subcategory TEXT,
  series TEXT,
  volume TEXT,
  page_count INTEGER,
  format TEXT,
  condition TEXT,
  room TEXT,
  cabinet TEXT,
  rack TEXT,
  shelf TEXT,
  position_note TEXT,
  summary TEXT,
  personal_notes TEXT,
  public_notes TEXT,
  metadata_source TEXT,
  metadata_source_details TEXT,
  cover_image_key TEXT,
  is_public INTEGER NOT NULL DEFAULT 0,
  is_archived INTEGER NOT NULL DEFAULT 0,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'available',
  date_added TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_books_year_serial ON books(accession_year, accession_serial);
CREATE INDEX IF NOT EXISTS idx_books_title_search ON books(title_search);
CREATE INDEX IF NOT EXISTS idx_books_isbn10 ON books(isbn10);
CREATE INDEX IF NOT EXISTS idx_books_isbn13 ON books(isbn13);
CREATE INDEX IF NOT EXISTS idx_books_status ON books(status);
CREATE INDEX IF NOT EXISTS idx_books_archived ON books(is_archived);
CREATE INDEX IF NOT EXISTS idx_books_public_code ON books(public_code);
CREATE INDEX IF NOT EXISTS idx_books_category ON books(category_id);
CREATE INDEX IF NOT EXISTS idx_books_language ON books(language_id);

CREATE TABLE IF NOT EXISTS book_people (
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (book_id, person_id, role)
);
CREATE INDEX IF NOT EXISTS idx_book_people_book_role ON book_people(book_id, role);
CREATE INDEX IF NOT EXISTS idx_book_people_person ON book_people(person_id);

CREATE TABLE IF NOT EXISTS book_tags (
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (book_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_book_tags_tag ON book_tags(tag_id);

CREATE TABLE IF NOT EXISTS acquisitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL UNIQUE REFERENCES books(id) ON DELETE CASCADE,
  acquisition_type TEXT NOT NULL DEFAULT 'other',
  store_name TEXT,
  purchase_date TEXT,
  price REAL,
  gift_date TEXT,
  giver_name TEXT,
  gift_note TEXT,
  acquisition_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_acquisitions_type ON acquisitions(acquisition_type);

CREATE TABLE IF NOT EXISTS loans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  borrower_name TEXT NOT NULL,
  borrower_phone TEXT,
  borrower_email TEXT,
  borrowed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expected_return_at TEXT,
  returned_at TEXT,
  status TEXT NOT NULL DEFAULT 'borrowed',
  note TEXT,
  override_double_lend INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_loans_book ON loans(book_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_loans_expected_return ON loans(expected_return_at);

CREATE TABLE IF NOT EXISTS metadata_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER REFERENCES books(id) ON DELETE SET NULL,
  isbn TEXT,
  source_name TEXT NOT NULL,
  raw_payload TEXT,
  normalized_payload TEXT,
  success INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_metadata_sources_isbn ON metadata_sources(isbn);
CREATE INDEX IF NOT EXISTS idx_metadata_sources_source ON metadata_sources(source_name);

CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  message TEXT NOT NULL,
  payload TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at);

CREATE TABLE IF NOT EXISTS library_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  library_name TEXT NOT NULL DEFAULT 'My Library',
  logo_image_key TEXT,
  public_base_url TEXT,
  date_format TEXT NOT NULL DEFAULT 'yyyy-MM-dd',
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  contact_address TEXT,
  site_meta_title TEXT,
  site_meta_description TEXT,
  default_language TEXT,
  default_category TEXT,
  public_visibility_mode TEXT NOT NULL DEFAULT 'selected',
  label_header_text TEXT,
  label_include_title INTEGER NOT NULL DEFAULT 1,
  label_include_author INTEGER NOT NULL DEFAULT 1,
  label_include_date INTEGER NOT NULL DEFAULT 0,
  label_include_qr INTEGER NOT NULL DEFAULT 1,
  label_columns INTEGER NOT NULL DEFAULT 3,
  label_width_mm INTEGER NOT NULL DEFAULT 50,
  label_height_mm INTEGER NOT NULL DEFAULT 30,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO library_settings (id, library_name, public_visibility_mode)
VALUES (1, 'My Library', 'selected');

CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  form_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_drafts_form_type ON drafts(form_type);
