PRAGMA foreign_keys = ON;

ALTER TABLE loans ADD COLUMN borrower_organization TEXT;
ALTER TABLE loans ADD COLUMN borrower_designation TEXT;
ALTER TABLE loans ADD COLUMN borrower_address TEXT;

ALTER TABLE loan_requests ADD COLUMN requester_organization TEXT;
ALTER TABLE loan_requests ADD COLUMN requester_designation TEXT;
ALTER TABLE loan_requests ADD COLUMN requester_address TEXT;
ALTER TABLE loan_requests ADD COLUMN borrowed_at TEXT;

UPDATE book_copies
SET copy_code = (
    SELECT printf('%02d-%05d-%02d', b.accession_year % 100, b.accession_serial, book_copies.copy_number)
    FROM books b
    WHERE b.id = book_copies.book_id
  ),
  barcode_value = (
    SELECT printf('%02d-%05d-%02d', b.accession_year % 100, b.accession_serial, book_copies.copy_number)
    FROM books b
    WHERE b.id = book_copies.book_id
  ),
  updated_at = CURRENT_TIMESTAMP
WHERE EXISTS (
  SELECT 1
  FROM books b
  WHERE b.id = book_copies.book_id
);
