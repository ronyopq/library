PRAGMA foreign_keys = OFF;

DELETE FROM auth_sessions;
DELETE FROM loan_requests;
DELETE FROM loans;
DELETE FROM book_reviews;
DELETE FROM metadata_sources;
DELETE FROM activity_logs;
DELETE FROM acquisitions;
DELETE FROM book_tags;
DELETE FROM book_people;
DELETE FROM book_copies;
DELETE FROM books;
DELETE FROM drafts;
DELETE FROM people;
DELETE FROM publishers;
DELETE FROM categories;
DELETE FROM languages;
DELETE FROM tags;
DELETE FROM users;
DELETE FROM counters;

INSERT INTO counters (name, value) VALUES ('accession', 0), ('public', 0);

DELETE FROM library_settings;
INSERT INTO library_settings (
  id,
  library_name,
  date_format,
  public_visibility_mode,
  label_include_title,
  label_include_author,
  label_include_date,
  label_include_qr,
  label_columns,
  label_width_mm,
  label_height_mm,
  created_at,
  updated_at
) VALUES (
  1,
  'Personal Library',
  'yyyy-MM-dd',
  'selected',
  1,
  1,
  0,
  1,
  3,
  50,
  30,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

DELETE FROM sqlite_sequence
WHERE name IN (
  'people',
  'publishers',
  'categories',
  'languages',
  'tags',
  'books',
  'acquisitions',
  'book_copies',
  'loans',
  'loan_requests',
  'book_reviews',
  'metadata_sources',
  'activity_logs',
  'users'
);

PRAGMA foreign_keys = ON;
