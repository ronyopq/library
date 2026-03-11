PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS book_copies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  copy_number INTEGER NOT NULL,
  copy_code TEXT NOT NULL UNIQUE,
  barcode_value TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available',
  is_archived INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_book_copies_book ON book_copies(book_id);
CREATE INDEX IF NOT EXISTS idx_book_copies_code ON book_copies(copy_code);
CREATE INDEX IF NOT EXISTS idx_book_copies_status ON book_copies(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_book_copies_book_copy_number ON book_copies(book_id, copy_number);

ALTER TABLE loans ADD COLUMN book_copy_id INTEGER;
ALTER TABLE loans ADD COLUMN source TEXT NOT NULL DEFAULT 'admin';
CREATE INDEX IF NOT EXISTS idx_loans_copy ON loans(book_copy_id);

CREATE TABLE IF NOT EXISTS loan_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  requested_copy_id INTEGER REFERENCES book_copies(id) ON DELETE SET NULL,
  requester_name TEXT NOT NULL,
  requester_phone TEXT NOT NULL,
  requester_email TEXT,
  expected_return_at TEXT,
  note TEXT,
  admin_note TEXT,
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT,
  reviewed_by_user_id INTEGER,
  approved_loan_id INTEGER,
  status TEXT NOT NULL DEFAULT 'requested',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_loan_requests_book ON loan_requests(book_id);
CREATE INDEX IF NOT EXISTS idx_loan_requests_status ON loan_requests(status);
CREATE INDEX IF NOT EXISTS idx_loan_requests_requested_at ON loan_requests(requested_at);
CREATE INDEX IF NOT EXISTS idx_loan_requests_reviewed_by ON loan_requests(reviewed_by_user_id);

INSERT INTO book_copies (
  book_id,
  copy_number,
  copy_code,
  barcode_value,
  status,
  is_archived,
  created_at,
  updated_at
)
SELECT
  b.id,
  1,
  b.accession_code || '-C01',
  b.accession_code || '-C01',
  CASE
    WHEN b.status = 'lost' THEN 'lost'
    ELSE 'available'
  END,
  0,
  COALESCE(b.created_at, CURRENT_TIMESTAMP),
  COALESCE(b.updated_at, CURRENT_TIMESTAMP)
FROM books b
WHERE NOT EXISTS (
  SELECT 1
  FROM book_copies bc
  WHERE bc.book_id = b.id AND bc.copy_number = 1
);

UPDATE loans
SET book_copy_id = (
  SELECT bc.id
  FROM book_copies bc
  WHERE bc.book_id = loans.book_id
  ORDER BY bc.copy_number ASC
  LIMIT 1
)
WHERE book_copy_id IS NULL;

UPDATE book_copies
SET status = 'available',
    updated_at = CURRENT_TIMESTAMP
WHERE is_archived = 0;

UPDATE book_copies
SET status = 'lost',
    updated_at = CURRENT_TIMESTAMP
WHERE id IN (
  SELECT l.book_copy_id
  FROM loans l
  WHERE l.status = 'lost'
    AND l.book_copy_id IS NOT NULL
);

UPDATE book_copies
SET status = 'borrowed',
    updated_at = CURRENT_TIMESTAMP
WHERE id IN (
  SELECT l.book_copy_id
  FROM loans l
  WHERE l.status = 'borrowed'
    AND l.book_copy_id IS NOT NULL
);

INSERT OR IGNORE INTO book_copies (
  book_id,
  copy_number,
  copy_code,
  barcode_value,
  status,
  is_archived,
  created_at,
  updated_at
)
SELECT
  b.id,
  2,
  b.accession_code || '-C02',
  b.accession_code || '-C02',
  'available',
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM books b
WHERE b.accession_code IN ('LIB-2026-002001', 'LIB-2026-002009', 'LIB-2026-002029');

INSERT OR IGNORE INTO book_copies (
  book_id,
  copy_number,
  copy_code,
  barcode_value,
  status,
  is_archived,
  created_at,
  updated_at
)
SELECT
  b.id,
  3,
  b.accession_code || '-C03',
  b.accession_code || '-C03',
  'available',
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM books b
WHERE b.accession_code IN ('LIB-2026-002001');

INSERT INTO loans (
  book_id,
  book_copy_id,
  borrower_name,
  borrower_phone,
  borrower_email,
  borrowed_at,
  expected_return_at,
  status,
  note,
  source,
  override_double_lend,
  created_at,
  updated_at
)
SELECT
  b.id,
  bc.id,
  'Nayeem Islam',
  '01735550001',
  'nayeem@example.com',
  '2026-03-08T10:00:00.000Z',
  '2026-03-22T00:00:00.000Z',
  'borrowed',
  'Demo copy-wise loan (copy 2)',
  'admin',
  0,
  '2026-03-08T10:00:00.000Z',
  '2026-03-08T10:00:00.000Z'
FROM books b
JOIN book_copies bc ON bc.book_id = b.id AND bc.copy_number = 2
WHERE b.accession_code = 'LIB-2026-002001'
  AND NOT EXISTS (
    SELECT 1
    FROM loans l
    WHERE l.book_copy_id = bc.id
      AND l.status = 'borrowed'
  );

UPDATE book_copies
SET status = 'borrowed',
    updated_at = CURRENT_TIMESTAMP
WHERE id IN (
  SELECT l.book_copy_id
  FROM loans l
  WHERE l.status = 'borrowed'
    AND l.book_copy_id IS NOT NULL
);

UPDATE books
SET status = CASE
    WHEN EXISTS (
      SELECT 1 FROM book_copies bc
      WHERE bc.book_id = books.id
        AND bc.is_archived = 0
        AND bc.status = 'available'
    ) THEN 'available'
    WHEN EXISTS (
      SELECT 1 FROM book_copies bc
      WHERE bc.book_id = books.id
        AND bc.is_archived = 0
        AND bc.status = 'borrowed'
    ) THEN 'borrowed'
    WHEN EXISTS (
      SELECT 1 FROM book_copies bc
      WHERE bc.book_id = books.id
        AND bc.is_archived = 0
        AND bc.status = 'lost'
    ) THEN 'lost'
    ELSE 'available'
  END,
  updated_at = CURRENT_TIMESTAMP
WHERE EXISTS (
  SELECT 1 FROM book_copies bc WHERE bc.book_id = books.id
);
