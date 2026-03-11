PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  username_normalized TEXT NOT NULL UNIQUE,
  full_name TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'librarian',
  password_hash TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions(expires_at);

CREATE TABLE IF NOT EXISTS book_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  reviewer_name TEXT NOT NULL,
  reviewer_phone TEXT NOT NULL,
  rating INTEGER NOT NULL,
  comment TEXT NOT NULL,
  is_hidden INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_book_reviews_book ON book_reviews(book_id);
CREATE INDEX IF NOT EXISTS idx_book_reviews_rating ON book_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_book_reviews_created ON book_reviews(created_at);

INSERT OR IGNORE INTO users (
  username,
  username_normalized,
  full_name,
  phone,
  role,
  password_hash,
  is_active
)
VALUES
  (
    'admin',
    'admin',
    'Primary Admin',
    '01700000001',
    'admin',
    'pbkdf2$100000$P8qWyrQEE5j5XbVdRAcpIA==$eD0lg1MLk2KyRO9m2egzgyg0weR1iDxDABINoXuSvpM=',
    1
  ),
  (
    'librarian',
    'librarian',
    'Library Staff',
    '01700000002',
    'librarian',
    'pbkdf2$100000$1kpGSKT26Oh6YRQhf4pJyA==$max/d7E8GeTQQXi5IaVGQIrmgmuzLpgr521+dRgC7BQ=',
    1
  );

INSERT OR IGNORE INTO categories (name, name_normalized)
VALUES
  ('Classic Fiction', 'classic fiction'),
  ('Dystopian Fiction', 'dystopian fiction'),
  ('Fantasy', 'fantasy'),
  ('Mystery Thriller', 'mystery thriller'),
  ('Inspirational Fiction', 'inspirational fiction'),
  ('Cosmology', 'cosmology'),
  ('World History', 'world history'),
  ('Self Help', 'self help'),
  ('Programming', 'programming'),
  ('Data Science', 'data science'),
  ('Artificial Intelligence', 'artificial intelligence'),
  ('Algorithms', 'algorithms'),
  ('Evolutionary Biology', 'evolutionary biology'),
  ('Genetics', 'genetics'),
  ('Medicine', 'medicine'),
  ('Personal Finance', 'personal finance'),
  ('Entrepreneurship', 'entrepreneurship'),
  ('Leadership', 'leadership'),
  ('Psychology', 'psychology'),
  ('Stoicism', 'stoicism'),
  ('Political Philosophy', 'political philosophy'),
  ('Memoir', 'memoir'),
  ('Autobiography', 'autobiography'),
  ('Biography', 'biography'),
  ('Epic Poetry', 'epic poetry'),
  ('Drama', 'drama'),
  ('Poetry', 'poetry'),
  ('Travel Adventure', 'travel adventure'),
  ('Childrens Literature', 'childrens literature'),
  ('Religion', 'religion');

INSERT OR IGNORE INTO languages (name, name_normalized)
VALUES
  ('English', 'english'),
  ('Bangla', 'bangla'),
  ('Arabic', 'arabic'),
  ('Hindi', 'hindi');

INSERT OR IGNORE INTO publishers (name, name_normalized)
VALUES
  ('Harper Perennial', 'harper perennial'),
  ('Signet Classics', 'signet classics'),
  ('Mariner Books', 'mariner books'),
  ('Anchor Books', 'anchor books'),
  ('HarperOne', 'harperone'),
  ('Bantam', 'bantam'),
  ('Harper', 'harper'),
  ('Avery', 'avery'),
  ('Prentice Hall', 'prentice hall'),
  ('O Reilly Media', 'o reilly media'),
  ('Pearson', 'pearson'),
  ('MIT Press', 'mit press'),
  ('Oxford University Press', 'oxford university press'),
  ('Scribner', 'scribner'),
  ('Plata Publishing', 'plata publishing'),
  ('Crown Business', 'crown business'),
  ('Free Press', 'free press'),
  ('Farrar Straus and Giroux', 'farrar straus and giroux'),
  ('Modern Library', 'modern library'),
  ('Penguin Classics', 'penguin classics'),
  ('Bantam Books', 'bantam books'),
  ('Little Brown and Company', 'little brown and company'),
  ('Simon and Schuster', 'simon and schuster'),
  ('HarperCollins', 'harpercollins'),
  ('Nilgiri Press', 'nilgiri press');

INSERT OR IGNORE INTO people (name, name_normalized)
VALUES
  ('Harper Lee', 'harper lee'),
  ('George Orwell', 'george orwell'),
  ('J R R Tolkien', 'j r r tolkien'),
  ('Dan Brown', 'dan brown'),
  ('Paulo Coelho', 'paulo coelho'),
  ('Stephen Hawking', 'stephen hawking'),
  ('Yuval Noah Harari', 'yuval noah harari'),
  ('James Clear', 'james clear'),
  ('Robert C Martin', 'robert c martin'),
  ('Wes McKinney', 'wes mckinney'),
  ('Stuart Russell and Peter Norvig', 'stuart russell and peter norvig'),
  ('Thomas H Cormen', 'thomas h cormen'),
  ('Richard Dawkins', 'richard dawkins'),
  ('Siddhartha Mukherjee', 'siddhartha mukherjee'),
  ('Robert T Kiyosaki', 'robert t kiyosaki'),
  ('Eric Ries', 'eric ries'),
  ('Stephen R Covey', 'stephen r covey'),
  ('Daniel Kahneman', 'daniel kahneman'),
  ('Marcus Aurelius', 'marcus aurelius'),
  ('Plato', 'plato'),
  ('Anne Frank', 'anne frank'),
  ('Nelson Mandela', 'nelson mandela'),
  ('David McCullough', 'david mccullough'),
  ('Homer', 'homer'),
  ('William Shakespeare', 'william shakespeare'),
  ('Walt Whitman', 'walt whitman'),
  ('Jules Verne', 'jules verne'),
  ('E B White', 'e b white'),
  ('Eknath Easwaran', 'eknath easwaran'),
  ('Jane Austen', 'jane austen');

INSERT OR IGNORE INTO books (
  accession_code,
  accession_year,
  accession_serial,
  public_serial,
  public_code,
  title,
  title_search,
  publisher_id,
  isbn13,
  publication_year,
  language_id,
  category_id,
  summary,
  room,
  cabinet,
  rack,
  shelf,
  position_note,
  cover_image_key,
  is_public,
  is_archived,
  status,
  date_added,
  created_at,
  updated_at
)
VALUES
  ('LIB-2026-002001', 2026, 2001, 2001, 'r2001', 'To Kill a Mockingbird', 'to kill a mockingbird', (SELECT id FROM publishers WHERE name_normalized = 'harper perennial'), '9780061120084', 1960, (SELECT id FROM languages WHERE name_normalized = 'english'), (SELECT id FROM categories WHERE name_normalized = 'classic fiction'), 'A moral coming of age novel set in the American South.', 'Room 1', 'Cabinet A', 'Rack 1', 'Shelf A', 'Front row', 'https://covers.openlibrary.org/b/isbn/9780061120084-L.jpg', 1, 0, 'available', '2026-02-01T09:00:00.000Z', '2026-02-01T09:00:00.000Z', '2026-02-01T09:00:00.000Z'),
  ('LIB-2026-002002', 2026, 2002, 2002, 'r2002', '1984', '1984', (SELECT id FROM publishers WHERE name_normalized = 'signet classics'), '9780451524935', 1949, (SELECT id FROM languages WHERE name_normalized = 'english'), (SELECT id FROM categories WHERE name_normalized = 'dystopian fiction'), 'A surveillance state dystopia and political warning.', 'Room 1', 'Cabinet A', 'Rack 1', 'Shelf B', 'Front row', 'https://covers.openlibrary.org/b/isbn/9780451524935-L.jpg', 1, 0, 'available', '2026-02-01T09:05:00.000Z', '2026-02-01T09:05:00.000Z', '2026-02-01T09:05:00.000Z'),
  ('LIB-2026-002003', 2026, 2003, 2003, 'r2003', 'The Hobbit', 'the hobbit', (SELECT id FROM publishers WHERE name_normalized = 'mariner books'), '9780547928227', 1937, (SELECT id FROM languages WHERE name_normalized = 'english'), (SELECT id FROM categories WHERE name_normalized = 'fantasy'), 'A classic fantasy quest before the Lord of the Rings.', 'Room 1', 'Cabinet A', 'Rack 1', 'Shelf C', 'Front row', 'https://covers.openlibrary.org/b/isbn/9780547928227-L.jpg', 1, 0, 'available', '2026-02-01T09:10:00.000Z', '2026-02-01T09:10:00.000Z', '2026-02-01T09:10:00.000Z'),
  ('LIB-2026-002004', 2026, 2004, 2004, 'r2004', 'The Da Vinci Code', 'the da vinci code', (SELECT id FROM publishers WHERE name_normalized = 'anchor books'), '9780307474278', 2003, (SELECT id FROM languages WHERE name_normalized = 'english'), (SELECT id FROM categories WHERE name_normalized = 'mystery thriller'), 'A fast paced mystery involving history and secret societies.', 'Room 1', 'Cabinet A', 'Rack 2', 'Shelf A', 'Front row', 'https://covers.openlibrary.org/b/isbn/9780307474278-L.jpg', 1, 0, 'available', '2026-02-01T09:15:00.000Z', '2026-02-01T09:15:00.000Z', '2026-02-01T09:15:00.000Z'),
  ('LIB-2026-002005', 2026, 2005, 2005, 'r2005', 'The Alchemist', 'the alchemist', (SELECT id FROM publishers WHERE name_normalized = 'harperone'), '9780061122415', 1988, (SELECT id FROM languages WHERE name_normalized = 'english'), (SELECT id FROM categories WHERE name_normalized = 'inspirational fiction'), 'A philosophical story about purpose and personal legend.', 'Room 1', 'Cabinet A', 'Rack 2', 'Shelf B', 'Front row', 'https://covers.openlibrary.org/b/isbn/9780061122415-L.jpg', 1, 0, 'available', '2026-02-01T09:20:00.000Z', '2026-02-01T09:20:00.000Z', '2026-02-01T09:20:00.000Z'),
  ('LIB-2026-002006', 2026, 2006, 2006, 'r2006', 'A Brief History of Time', 'a brief history of time', (SELECT id FROM publishers WHERE name_normalized = 'bantam'), '9780553380163', 1988, (SELECT id FROM languages WHERE name_normalized = 'english'), (SELECT id FROM categories WHERE name_normalized = 'cosmology'), 'Popular science overview of the universe and black holes.', 'Room 1', 'Cabinet B', 'Rack 1', 'Shelf A', 'Front row', 'https://covers.openlibrary.org/b/isbn/9780553380163-L.jpg', 1, 0, 'available', '2026-02-01T09:25:00.000Z', '2026-02-01T09:25:00.000Z', '2026-02-01T09:25:00.000Z'),
  ('LIB-2026-002007', 2026, 2007, 2007, 'r2007', 'Sapiens', 'sapiens', (SELECT id FROM publishers WHERE name_normalized = 'harper'), '9780062316097', 2011, (SELECT id FROM languages WHERE name_normalized = 'english'), (SELECT id FROM categories WHERE name_normalized = 'world history'), 'A narrative history of humankind from ancient to modern times.', 'Room 1', 'Cabinet B', 'Rack 1', 'Shelf B', 'Front row', 'https://covers.openlibrary.org/b/isbn/9780062316097-L.jpg', 1, 0, 'available', '2026-02-01T09:30:00.000Z', '2026-02-01T09:30:00.000Z', '2026-02-01T09:30:00.000Z'),
  ('LIB-2026-002008', 2026, 2008, 2008, 'r2008', 'Atomic Habits', 'atomic habits', (SELECT id FROM publishers WHERE name_normalized = 'avery'), '9780735211292', 2018, (SELECT id FROM languages WHERE name_normalized = 'english'), (SELECT id FROM categories WHERE name_normalized = 'self help'), 'Practical framework for habit formation and improvement.', 'Room 1', 'Cabinet B', 'Rack 1', 'Shelf C', 'Front row', 'https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg', 1, 0, 'available', '2026-02-01T09:35:00.000Z', '2026-02-01T09:35:00.000Z', '2026-02-01T09:35:00.000Z'),
  ('LIB-2026-002009', 2026, 2009, 2009, 'r2009', 'Clean Code', 'clean code', (SELECT id FROM publishers WHERE name_normalized = 'prentice hall'), '9780132350884', 2008, (SELECT id FROM languages WHERE name_normalized = 'english'), (SELECT id FROM categories WHERE name_normalized = 'programming'), 'A handbook of agile craftsmanship for writing maintainable code.', 'Room 2', 'Cabinet A', 'Rack 1', 'Shelf A', 'Front row', 'https://covers.openlibrary.org/b/isbn/9780132350884-L.jpg', 1, 0, 'available', '2026-02-01T09:40:00.000Z', '2026-02-01T09:40:00.000Z', '2026-02-01T09:40:00.000Z'),
  ('LIB-2026-002010', 2026, 2010, 2010, 'r2010', 'Python for Data Analysis', 'python for data analysis', (SELECT id FROM publishers WHERE name_normalized = 'o reilly media'), '9781098104039', 2022, (SELECT id FROM languages WHERE name_normalized = 'english'), (SELECT id FROM categories WHERE name_normalized = 'data science'), 'Hands on guide to pandas and practical data wrangling.', 'Room 2', 'Cabinet A', 'Rack 1', 'Shelf B', 'Front row', 'https://covers.openlibrary.org/b/isbn/9781098104039-L.jpg', 1, 0, 'available', '2026-02-01T09:45:00.000Z', '2026-02-01T09:45:00.000Z', '2026-02-01T09:45:00.000Z'),
  ('LIB-2026-002011', 2026, 2011, 2011, 'r2011', 'Artificial Intelligence: A Modern Approach', 'artificial intelligence a modern approach', (SELECT id FROM publishers WHERE name_normalized = 'pearson'), '9780134610993', 2021, (SELECT id FROM languages WHERE name_normalized = 'english'), (SELECT id FROM categories WHERE name_normalized = 'artificial intelligence'), 'Comprehensive textbook covering modern AI principles and methods.', 'Room 2', 'Cabinet A', 'Rack 1', 'Shelf C', 'Front row', 'https://covers.openlibrary.org/b/isbn/9780134610993-L.jpg', 1, 0, 'available', '2026-02-01T09:50:00.000Z', '2026-02-01T09:50:00.000Z', '2026-02-01T09:50:00.000Z'),
  ('LIB-2026-002012', 2026, 2012, 2012, 'r2012', 'Introduction to Algorithms', 'introduction to algorithms', (SELECT id FROM publishers WHERE name_normalized = 'mit press'), '9780262046305', 2022, (SELECT id FROM languages WHERE name_normalized = 'english'), (SELECT id FROM categories WHERE name_normalized = 'algorithms'), 'Foundational algorithm design and analysis reference.', 'Room 2', 'Cabinet A', 'Rack 2', 'Shelf A', 'Front row', 'https://covers.openlibrary.org/b/isbn/9780262046305-L.jpg', 1, 0, 'available', '2026-02-01T09:55:00.000Z', '2026-02-01T09:55:00.000Z', '2026-02-01T09:55:00.000Z'),
  ('LIB-2026-002013', 2026, 2013, 2013, 'r2013', 'The Selfish Gene', 'the selfish gene', (SELECT id FROM publishers WHERE name_normalized = 'oxford university press'), '9780192860926', 1976, (SELECT id FROM languages WHERE name_normalized = 'english'), (SELECT id FROM categories WHERE name_normalized = 'evolutionary biology'), 'Seminal work on gene centered view of evolution.', 'Room 2', 'Cabinet A', 'Rack 2', 'Shelf B', 'Front row', 'https://covers.openlibrary.org/b/isbn/9780192860926-L.jpg', 1, 0, 'available', '2026-02-01T10:00:00.000Z', '2026-02-01T10:00:00.000Z', '2026-02-01T10:00:00.000Z'),
  ('LIB-2026-002014', 2026, 2014, 2014, 'r2014', 'The Gene', 'the gene', (SELECT id FROM publishers WHERE name_normalized = 'scribner'), '9781476733523', 2016, (SELECT id FROM languages WHERE name_normalized = 'english'), (SELECT id FROM categories WHERE name_normalized = 'genetics'), 'A history of genetics and its social impact.', 'Room 2', 'Cabinet A', 'Rack 2', 'Shelf C', 'Front row', 'https://covers.openlibrary.org/b/isbn/9781476733523-L.jpg', 1, 0, 'available', '2026-02-01T10:05:00.000Z', '2026-02-01T10:05:00.000Z', '2026-02-01T10:05:00.000Z'),
  ('LIB-2026-002015', 2026, 2015, 2015, 'r2015', 'The Emperor of All Maladies', 'the emperor of all maladies', (SELECT id FROM publishers WHERE name_normalized = 'scribner'), '9781439170914', 2010, (SELECT id FROM languages WHERE name_normalized = 'english'), (SELECT id FROM categories WHERE name_normalized = 'medicine'), 'Biography of cancer and evolution of oncology treatment.', 'Room 2', 'Cabinet B', 'Rack 1', 'Shelf A', 'Front row', 'https://covers.openlibrary.org/b/isbn/9781439170914-L.jpg', 1, 0, 'available', '2026-02-01T10:10:00.000Z', '2026-02-01T10:10:00.000Z', '2026-02-01T10:10:00.000Z'),
  ('LIB-2026-002016', 2026, 2016, 2016, 'r2016', 'Rich Dad Poor Dad', 'rich dad poor dad', (SELECT id FROM publishers WHERE name_normalized = 'plata publishing'), '9781612680194', 1997, (SELECT id FROM languages WHERE name_normalized = 'english'), (SELECT id FROM categories WHERE name_normalized = 'personal finance'), 'Personal finance lessons about assets and liabilities.', 'Room 2', 'Cabinet B', 'Rack 1', 'Shelf B', 'Front row', 'https://covers.openlibrary.org/b/isbn/9781612680194-L.jpg', 1, 0, 'available', '2026-02-01T10:15:00.000Z', '2026-02-01T10:15:00.000Z', '2026-02-01T10:15:00.000Z'),
  ('LIB-2026-002017', 2026, 2017, 2017, 'r2017', 'The Lean Startup', 'the lean startup', (SELECT id FROM publishers WHERE name_normalized = 'crown business'), '9780307887894', 2011, (SELECT id FROM languages WHERE name_normalized = 'english'), (SELECT id FROM categories WHERE name_normalized = 'entrepreneurship'), 'Method for building products through iterative learning.', 'Room 2', 'Cabinet B', 'Rack 1', 'Shelf C', 'Front row', 'https://covers.openlibrary.org/b/isbn/9780307887894-L.jpg', 1, 0, 'available', '2026-02-01T10:20:00.000Z', '2026-02-01T10:20:00.000Z', '2026-02-01T10:20:00.000Z'),
  ('LIB-2026-002018', 2026, 2018, 2018, 'r2018', 'The 7 Habits of Highly Effective People', 'the 7 habits of highly effective people', (SELECT id FROM publishers WHERE name_normalized = 'free press'), '9781451639612', 1989, (SELECT id FROM languages WHERE name_normalized = 'english'), (SELECT id FROM categories WHERE name_normalized = 'leadership'), 'Framework for principles based leadership and productivity.', 'Room 2', 'Cabinet B', 'Rack 2', 'Shelf A', 'Front row', 'https://covers.openlibrary.org/b/isbn/9781451639612-L.jpg', 1, 0, 'available', '2026-02-01T10:25:00.000Z', '2026-02-01T10:25:00.000Z', '2026-02-01T10:25:00.000Z'),
  ('LIB-2026-002019', 2026, 2019, 2019, 'r2019', 'Thinking, Fast and Slow', 'thinking fast and slow', (SELECT id FROM publishers WHERE name_normalized = 'farrar straus and giroux'), '9780374533557', 2011, (SELECT id FROM languages WHERE name_normalized = 'english'), (SELECT id FROM categories WHERE name_normalized = 'psychology'), 'Behavioral psychology on human judgment and decision making.', 'Room 2', 'Cabinet B', 'Rack 2', 'Shelf B', 'Front row', 'https://covers.openlibrary.org/b/isbn/9780374533557-L.jpg', 1, 0, 'available', '2026-02-01T10:30:00.000Z', '2026-02-01T10:30:00.000Z', '2026-02-01T10:30:00.000Z'),
  ('LIB-2026-002020', 2026, 2020, 2020, 'r2020', 'Meditations', 'meditations', (SELECT id FROM publishers WHERE name_normalized = 'modern library'), '9780812968255', 2002, (SELECT id FROM languages WHERE name_normalized = 'english'), (SELECT id FROM categories WHERE name_normalized = 'stoicism'), 'Personal reflections on duty virtue and self discipline.', 'Room 3', 'Cabinet A', 'Rack 1', 'Shelf A', 'Front row', 'https://covers.openlibrary.org/b/isbn/9780812968255-L.jpg', 1, 0, 'available', '2026-02-01T10:35:00.000Z', '2026-02-01T10:35:00.000Z', '2026-02-01T10:35:00.000Z'),
  ('LIB-2026-002021', 2026, 2021, 2021, 'r2021', 'The Republic', 'the republic', (SELECT id FROM publishers WHERE name_normalized = 'penguin classics'), '9780140455113', 2007, (SELECT id FROM languages WHERE name_normalized = 'english'), (SELECT id FROM categories WHERE name_normalized = 'political philosophy'), 'Dialogues on justice governance and ideal society.', 'Room 3', 'Cabinet A', 'Rack 1', 'Shelf B', 'Front row', 'https://covers.openlibrary.org/b/isbn/9780140455113-L.jpg', 1, 0, 'available', '2026-02-01T10:40:00.000Z', '2026-02-01T10:40:00.000Z', '2026-02-01T10:40:00.000Z'),
  ('LIB-2026-002022', 2026, 2022, 2022, 'r2022', 'The Diary of a Young Girl', 'the diary of a young girl', (SELECT id FROM publishers WHERE name_normalized = 'bantam books'), '9780553296983', 1947, (SELECT id FROM languages WHERE name_normalized = 'english'), (SELECT id FROM categories WHERE name_normalized = 'memoir'), 'Diary of Anne Frank during World War II.', 'Room 3', 'Cabinet A', 'Rack 1', 'Shelf C', 'Front row', 'https://covers.openlibrary.org/b/isbn/9780553296983-L.jpg', 1, 0, 'available', '2026-02-01T10:45:00.000Z', '2026-02-01T10:45:00.000Z', '2026-02-01T10:45:00.000Z'),
  ('LIB-2026-002023', 2026, 2023, 2023, 'r2023', 'Long Walk to Freedom', 'long walk to freedom', (SELECT id FROM publishers WHERE name_normalized = 'little brown and company'), '9780316548182', 1994, (SELECT id FROM languages WHERE name_normalized = 'english'), (SELECT id FROM categories WHERE name_normalized = 'autobiography'), 'Nelson Mandela memoir of struggle and leadership.', 'Room 3', 'Cabinet A', 'Rack 2', 'Shelf A', 'Front row', 'https://covers.openlibrary.org/b/isbn/9780316548182-L.jpg', 1, 0, 'available', '2026-02-01T10:50:00.000Z', '2026-02-01T10:50:00.000Z', '2026-02-01T10:50:00.000Z'),
  ('LIB-2026-002024', 2026, 2024, 2024, 'r2024', 'The Wright Brothers', 'the wright brothers', (SELECT id FROM publishers WHERE name_normalized = 'simon and schuster'), '9781476728758', 2015, (SELECT id FROM languages WHERE name_normalized = 'english'), (SELECT id FROM categories WHERE name_normalized = 'biography'), 'Story of innovation and flight by the Wright brothers.', 'Room 3', 'Cabinet A', 'Rack 2', 'Shelf B', 'Front row', 'https://covers.openlibrary.org/b/isbn/9781476728758-L.jpg', 1, 0, 'available', '2026-02-01T10:55:00.000Z', '2026-02-01T10:55:00.000Z', '2026-02-01T10:55:00.000Z'),
  ('LIB-2026-002025', 2026, 2025, 2025, 'r2025', 'The Odyssey', 'the odyssey', (SELECT id FROM publishers WHERE name_normalized = 'penguin classics'), '9780140268866', 1996, (SELECT id FROM languages WHERE name_normalized = 'english'), (SELECT id FROM categories WHERE name_normalized = 'epic poetry'), 'Epic tale of Odysseus journey back home.', 'Room 3', 'Cabinet B', 'Rack 1', 'Shelf A', 'Front row', 'https://covers.openlibrary.org/b/isbn/9780140268866-L.jpg', 1, 0, 'available', '2026-02-01T11:00:00.000Z', '2026-02-01T11:00:00.000Z', '2026-02-01T11:00:00.000Z'),
  ('LIB-2026-002026', 2026, 2026, 2026, 'r2026', 'Hamlet', 'hamlet', (SELECT id FROM publishers WHERE name_normalized = 'simon and schuster'), '9780743477122', 1603, (SELECT id FROM languages WHERE name_normalized = 'english'), (SELECT id FROM categories WHERE name_normalized = 'drama'), 'Shakespeare tragedy exploring revenge and morality.', 'Room 3', 'Cabinet B', 'Rack 1', 'Shelf B', 'Front row', 'https://covers.openlibrary.org/b/isbn/9780743477122-L.jpg', 1, 0, 'available', '2026-02-01T11:05:00.000Z', '2026-02-01T11:05:00.000Z', '2026-02-01T11:05:00.000Z'),
  ('LIB-2026-002027', 2026, 2027, 2027, 'r2027', 'Leaves of Grass', 'leaves of grass', (SELECT id FROM publishers WHERE name_normalized = 'penguin classics'), '9780143039272', 1855, (SELECT id FROM languages WHERE name_normalized = 'english'), (SELECT id FROM categories WHERE name_normalized = 'poetry'), 'Poetry collection celebrating individual and democracy.', 'Room 3', 'Cabinet B', 'Rack 1', 'Shelf C', 'Front row', 'https://covers.openlibrary.org/b/isbn/9780143039272-L.jpg', 1, 0, 'available', '2026-02-01T11:10:00.000Z', '2026-02-01T11:10:00.000Z', '2026-02-01T11:10:00.000Z'),
  ('LIB-2026-002028', 2026, 2028, 2028, 'r2028', 'Around the World in Eighty Days', 'around the world in eighty days', (SELECT id FROM publishers WHERE name_normalized = 'penguin classics'), '9780140449067', 1873, (SELECT id FROM languages WHERE name_normalized = 'english'), (SELECT id FROM categories WHERE name_normalized = 'travel adventure'), 'Adventure race around the globe in eighty days.', 'Room 3', 'Cabinet B', 'Rack 2', 'Shelf A', 'Front row', 'https://covers.openlibrary.org/b/isbn/9780140449067-L.jpg', 1, 0, 'available', '2026-02-01T11:15:00.000Z', '2026-02-01T11:15:00.000Z', '2026-02-01T11:15:00.000Z'),
  ('LIB-2026-002029', 2026, 2029, 2029, 'r2029', 'Charlotte''s Web', 'charlottes web', (SELECT id FROM publishers WHERE name_normalized = 'harpercollins'), '9780061124952', 1952, (SELECT id FROM languages WHERE name_normalized = 'english'), (SELECT id FROM categories WHERE name_normalized = 'childrens literature'), 'Beloved children story of friendship and courage.', 'Room 3', 'Cabinet B', 'Rack 2', 'Shelf B', 'Front row', 'https://covers.openlibrary.org/b/isbn/9780061124952-L.jpg', 1, 0, 'available', '2026-02-01T11:20:00.000Z', '2026-02-01T11:20:00.000Z', '2026-02-01T11:20:00.000Z'),
  ('LIB-2026-002030', 2026, 2030, 2030, 'r2030', 'The Bhagavad Gita', 'the bhagavad gita', (SELECT id FROM publishers WHERE name_normalized = 'nilgiri press'), '9781586380198', 2007, (SELECT id FROM languages WHERE name_normalized = 'english'), (SELECT id FROM categories WHERE name_normalized = 'religion'), 'Foundational spiritual dialogue from Indian philosophy.', 'Room 3', 'Cabinet B', 'Rack 2', 'Shelf C', 'Front row', 'https://covers.openlibrary.org/b/isbn/9781586380198-L.jpg', 1, 0, 'available', '2026-02-01T11:25:00.000Z', '2026-02-01T11:25:00.000Z', '2026-02-01T11:25:00.000Z');

WITH author_map(accession_code, author_key) AS (
  VALUES
    ('LIB-2026-002001', 'harper lee'),
    ('LIB-2026-002002', 'george orwell'),
    ('LIB-2026-002003', 'j r r tolkien'),
    ('LIB-2026-002004', 'dan brown'),
    ('LIB-2026-002005', 'paulo coelho'),
    ('LIB-2026-002006', 'stephen hawking'),
    ('LIB-2026-002007', 'yuval noah harari'),
    ('LIB-2026-002008', 'james clear'),
    ('LIB-2026-002009', 'robert c martin'),
    ('LIB-2026-002010', 'wes mckinney'),
    ('LIB-2026-002011', 'stuart russell and peter norvig'),
    ('LIB-2026-002012', 'thomas h cormen'),
    ('LIB-2026-002013', 'richard dawkins'),
    ('LIB-2026-002014', 'siddhartha mukherjee'),
    ('LIB-2026-002015', 'siddhartha mukherjee'),
    ('LIB-2026-002016', 'robert t kiyosaki'),
    ('LIB-2026-002017', 'eric ries'),
    ('LIB-2026-002018', 'stephen r covey'),
    ('LIB-2026-002019', 'daniel kahneman'),
    ('LIB-2026-002020', 'marcus aurelius'),
    ('LIB-2026-002021', 'plato'),
    ('LIB-2026-002022', 'anne frank'),
    ('LIB-2026-002023', 'nelson mandela'),
    ('LIB-2026-002024', 'david mccullough'),
    ('LIB-2026-002025', 'homer'),
    ('LIB-2026-002026', 'william shakespeare'),
    ('LIB-2026-002027', 'walt whitman'),
    ('LIB-2026-002028', 'jules verne'),
    ('LIB-2026-002029', 'e b white'),
    ('LIB-2026-002030', 'eknath easwaran')
)
INSERT OR IGNORE INTO book_people (book_id, person_id, role, sort_order)
SELECT b.id, p.id, 'author', 0
FROM author_map map
JOIN books b ON b.accession_code = map.accession_code
JOIN people p ON p.name_normalized = map.author_key;

WITH review_map(accession_code, reviewer_name, reviewer_phone, rating, comment, created_at) AS (
  VALUES
    ('LIB-2026-002001', 'Anik Hasan', '01711110001', 5, 'Excellent classic and highly readable.', '2026-03-01T10:00:00.000Z'),
    ('LIB-2026-002001', 'Mitu Rahman', '01711110002', 4, 'Great story with strong characters.', '2026-03-01T10:10:00.000Z'),
    ('LIB-2026-002003', 'Shahid Iqbal', '01711110003', 5, 'Adventure from start to finish.', '2026-03-01T10:20:00.000Z'),
    ('LIB-2026-002006', 'Sadia Akter', '01711110004', 4, 'Science explained in simple language.', '2026-03-01T10:30:00.000Z'),
    ('LIB-2026-002009', 'Rafiul Karim', '01711110005', 5, 'Very useful for better coding standards.', '2026-03-01T10:40:00.000Z'),
    ('LIB-2026-002010', 'Nabila Islam', '01711110006', 4, 'Helpful examples for data analysis tasks.', '2026-03-01T10:50:00.000Z'),
    ('LIB-2026-002016', 'Saif Hossain', '01711110007', 4, 'Motivating finance mindset lessons.', '2026-03-01T11:00:00.000Z'),
    ('LIB-2026-002019', 'Farhana Kabir', '01711110008', 5, 'Insightful book on thinking and bias.', '2026-03-01T11:10:00.000Z'),
    ('LIB-2026-002022', 'Sabbir Ahamed', '01711110009', 5, 'Powerful real life memoir.', '2026-03-01T11:20:00.000Z'),
    ('LIB-2026-002029', 'Taniya Noor', '01711110010', 5, 'Lovely children story and easy to read.', '2026-03-01T11:30:00.000Z')
)
INSERT INTO book_reviews (
  book_id,
  reviewer_name,
  reviewer_phone,
  rating,
  comment,
  is_hidden,
  created_at,
  updated_at
)
SELECT
  b.id,
  map.reviewer_name,
  map.reviewer_phone,
  map.rating,
  map.comment,
  0,
  map.created_at,
  map.created_at
FROM review_map map
JOIN books b ON b.accession_code = map.accession_code
WHERE NOT EXISTS (
  SELECT 1
  FROM book_reviews r
  WHERE r.book_id = b.id
    AND r.reviewer_name = map.reviewer_name
    AND r.reviewer_phone = map.reviewer_phone
    AND r.comment = map.comment
);

WITH loan_map(
  accession_code,
  borrower_name,
  borrower_phone,
  borrower_email,
  borrowed_at,
  expected_return_at,
  returned_at,
  status,
  note
) AS (
  VALUES
    ('LIB-2026-002003', 'Rahim Uddin', '01720000001', 'rahim@example.com', '2026-03-02T10:00:00.000Z', '2026-03-20T00:00:00.000Z', NULL, 'borrowed', 'Borrowed for weekend reading'),
    ('LIB-2026-002009', 'Nusrat Jahan', '01720000002', 'nusrat@example.com', '2026-03-03T11:00:00.000Z', '2026-03-25T00:00:00.000Z', NULL, 'borrowed', 'For software engineering study'),
    ('LIB-2026-002016', 'Aminul Islam', '01720000003', 'aminul@example.com', '2026-02-20T09:00:00.000Z', '2026-03-05T00:00:00.000Z', NULL, 'borrowed', 'Overdue example record'),
    ('LIB-2026-002022', 'Labiba Noor', '01720000004', 'labiba@example.com', '2026-02-18T10:30:00.000Z', '2026-03-01T00:00:00.000Z', '2026-02-28T09:00:00.000Z', 'returned', 'Returned in good condition'),
    ('LIB-2026-002024', 'Karim Mia', '01720000005', 'karim@example.com', '2026-02-25T08:45:00.000Z', '2026-03-10T00:00:00.000Z', '2026-03-10T00:00:00.000Z', 'lost', 'Marked as lost after follow up')
)
INSERT INTO loans (
  book_id,
  borrower_name,
  borrower_phone,
  borrower_email,
  borrowed_at,
  expected_return_at,
  returned_at,
  status,
  note,
  override_double_lend,
  created_at,
  updated_at
)
SELECT
  b.id,
  map.borrower_name,
  map.borrower_phone,
  map.borrower_email,
  map.borrowed_at,
  map.expected_return_at,
  map.returned_at,
  map.status,
  map.note,
  0,
  map.borrowed_at,
  COALESCE(map.returned_at, map.borrowed_at)
FROM loan_map map
JOIN books b ON b.accession_code = map.accession_code
WHERE NOT EXISTS (
  SELECT 1
  FROM loans l
  WHERE l.book_id = b.id
    AND l.borrower_name = map.borrower_name
    AND l.borrowed_at = map.borrowed_at
);

UPDATE books
SET status = 'borrowed',
    updated_at = '2026-03-03T12:00:00.000Z'
WHERE accession_code IN ('LIB-2026-002003', 'LIB-2026-002009', 'LIB-2026-002016');

UPDATE books
SET status = 'lost',
    updated_at = '2026-03-10T00:00:00.000Z'
WHERE accession_code = 'LIB-2026-002024';
