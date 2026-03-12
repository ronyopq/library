ALTER TABLE library_settings ADD COLUMN contact_address TEXT;
ALTER TABLE library_settings ADD COLUMN site_meta_title TEXT;
ALTER TABLE library_settings ADD COLUMN site_meta_description TEXT;
ALTER TABLE library_settings ADD COLUMN label_header_text TEXT;

UPDATE library_settings
SET
  site_meta_title = COALESCE(site_meta_title, library_name),
  label_header_text = COALESCE(label_header_text, library_name)
WHERE id = 1;
