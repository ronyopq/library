INSERT OR IGNORE INTO categories (name, name_normalized)
VALUES
  ('Literature', 'literature'),
  ('History', 'history'),
  ('Science', 'science'),
  ('Religion', 'religion'),
  ('Programming', 'programming');

INSERT OR IGNORE INTO languages (name, name_normalized)
VALUES
  ('Bangla', 'bangla'),
  ('English', 'english'),
  ('Arabic', 'arabic');

INSERT OR IGNORE INTO tags (name, name_normalized)
VALUES
  ('favorite', 'favorite'),
  ('new', 'new');

INSERT OR REPLACE INTO library_settings (
  id,
  library_name,
  date_format,
  public_visibility_mode,
  site_meta_title,
  site_meta_description,
  label_header_text,
  label_include_title,
  label_include_author,
  label_include_date,
  label_include_qr,
  label_columns,
  label_width_mm,
  label_height_mm
)
VALUES (1, 'My Library', 'yyyy-MM-dd', 'selected', 'My Library', 'Personal library catalog and barcode access.', 'My Library', 1, 1, 0, 1, 3, 50, 30);
