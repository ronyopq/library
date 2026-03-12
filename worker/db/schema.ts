import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestampColumns = {
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP")
};

export const counters = sqliteTable("counters", {
  name: text("name").primaryKey(),
  value: integer("value").notNull().default(0)
});

export const people = sqliteTable(
  "people",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    nameNormalized: text("name_normalized").notNull().unique(),
    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP")
  },
  (table) => ({
    nameIdx: index("idx_people_name").on(table.name)
  })
);

export const publishers = sqliteTable(
  "publishers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    nameNormalized: text("name_normalized").notNull().unique(),
    ...timestampColumns
  },
  (table) => ({
    nameIdx: index("idx_publishers_name").on(table.name)
  })
);

export const categories = sqliteTable(
  "categories",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    nameNormalized: text("name_normalized").notNull().unique(),
    ...timestampColumns
  },
  (table) => ({
    nameIdx: index("idx_categories_name").on(table.name)
  })
);

export const languages = sqliteTable(
  "languages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    nameNormalized: text("name_normalized").notNull().unique(),
    ...timestampColumns
  },
  (table) => ({
    nameIdx: index("idx_languages_name").on(table.name)
  })
);

export const tags = sqliteTable(
  "tags",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    nameNormalized: text("name_normalized").notNull().unique(),
    ...timestampColumns
  },
  (table) => ({
    nameIdx: index("idx_tags_name").on(table.name)
  })
);

export const books = sqliteTable(
  "books",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accessionCode: text("accession_code").notNull().unique(),
    accessionYear: integer("accession_year").notNull(),
    accessionSerial: integer("accession_serial").notNull(),
    publicSerial: integer("public_serial").notNull().unique(),
    publicCode: text("public_code").notNull().unique(),
    title: text("title"),
    titleSearch: text("title_search"),
    subtitle: text("subtitle"),
    originalTitle: text("original_title"),
    publisherId: integer("publisher_id").references(() => publishers.id),
    imprint: text("imprint"),
    isbn10: text("isbn10"),
    isbn13: text("isbn13"),
    edition: text("edition"),
    printingNumber: text("printing_number"),
    publicationYear: integer("publication_year"),
    publicationCountry: text("publication_country"),
    languageId: integer("language_id").references(() => languages.id),
    categoryId: integer("category_id").references(() => categories.id),
    subcategory: text("subcategory"),
    series: text("series"),
    volume: text("volume"),
    pageCount: integer("page_count"),
    format: text("format"),
    condition: text("condition"),
    room: text("room"),
    cabinet: text("cabinet"),
    rack: text("rack"),
    shelf: text("shelf"),
    positionNote: text("position_note"),
    summary: text("summary"),
    personalNotes: text("personal_notes"),
    publicNotes: text("public_notes"),
    metadataSource: text("metadata_source"),
    metadataSourceDetails: text("metadata_source_details"),
    coverImageKey: text("cover_image_key"),
    isPublic: integer("is_public", { mode: "boolean" }).notNull().default(false),
    isArchived: integer("is_archived", { mode: "boolean" }).notNull().default(false),
    isFavorite: integer("is_favorite", { mode: "boolean" }).notNull().default(false),
    status: text("status").notNull().default("available"),
    dateAdded: text("date_added").notNull().default("CURRENT_TIMESTAMP"),
    archivedAt: text("archived_at"),
    ...timestampColumns
  },
  (table) => ({
    yearSerialIdx: uniqueIndex("idx_books_year_serial").on(table.accessionYear, table.accessionSerial),
    titleIdx: index("idx_books_title_search").on(table.titleSearch),
    isbn10Idx: index("idx_books_isbn10").on(table.isbn10),
    isbn13Idx: index("idx_books_isbn13").on(table.isbn13),
    statusIdx: index("idx_books_status").on(table.status),
    archiveIdx: index("idx_books_archived").on(table.isArchived),
    publicCodeIdx: index("idx_books_public_code").on(table.publicCode),
    categoryIdx: index("idx_books_category").on(table.categoryId),
    languageIdx: index("idx_books_language").on(table.languageId)
  })
);

export const bookPeople = sqliteTable(
  "book_people",
  {
    bookId: integer("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    sortOrder: integer("sort_order").notNull().default(0)
  },
  (table) => ({
    pk: primaryKey({ columns: [table.bookId, table.personId, table.role] }),
    bookRoleIdx: index("idx_book_people_book_role").on(table.bookId, table.role),
    personIdx: index("idx_book_people_person").on(table.personId)
  })
);

export const bookTags = sqliteTable(
  "book_tags",
  {
    bookId: integer("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" })
  },
  (table) => ({
    pk: primaryKey({ columns: [table.bookId, table.tagId] }),
    tagIdx: index("idx_book_tags_tag").on(table.tagId)
  })
);

export const acquisitions = sqliteTable(
  "acquisitions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bookId: integer("book_id")
      .notNull()
      .unique()
      .references(() => books.id, { onDelete: "cascade" }),
    acquisitionType: text("acquisition_type").notNull().default("other"),
    storeName: text("store_name"),
    purchaseDate: text("purchase_date"),
    price: real("price"),
    giftDate: text("gift_date"),
    giverName: text("giver_name"),
    giftNote: text("gift_note"),
    acquisitionNote: text("acquisition_note"),
    ...timestampColumns
  },
  (table) => ({
    typeIdx: index("idx_acquisitions_type").on(table.acquisitionType)
  })
);

export const loans = sqliteTable(
  "loans",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bookId: integer("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    bookCopyId: integer("book_copy_id"),
    borrowerName: text("borrower_name").notNull(),
    borrowerOrganization: text("borrower_organization"),
    borrowerDesignation: text("borrower_designation"),
    borrowerAddress: text("borrower_address"),
    borrowerPhone: text("borrower_phone"),
    borrowerEmail: text("borrower_email"),
    borrowedAt: text("borrowed_at").notNull().default("CURRENT_TIMESTAMP"),
    expectedReturnAt: text("expected_return_at"),
    returnedAt: text("returned_at"),
    status: text("status").notNull().default("borrowed"),
    source: text("source").notNull().default("admin"),
    note: text("note"),
    overrideDoubleLend: integer("override_double_lend", { mode: "boolean" }).notNull().default(false),
    ...timestampColumns
  },
  (table) => ({
    bookIdx: index("idx_loans_book").on(table.bookId),
    copyIdx: index("idx_loans_copy").on(table.bookCopyId),
    statusIdx: index("idx_loans_status").on(table.status),
    expectedIdx: index("idx_loans_expected_return").on(table.expectedReturnAt)
  })
);

export const bookCopies = sqliteTable(
  "book_copies",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bookId: integer("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    copyNumber: integer("copy_number").notNull(),
    copyCode: text("copy_code").notNull().unique(),
    barcodeValue: text("barcode_value").notNull(),
    status: text("status").notNull().default("available"),
    isArchived: integer("is_archived", { mode: "boolean" }).notNull().default(false),
    note: text("note"),
    ...timestampColumns
  },
  (table) => ({
    bookIdx: index("idx_book_copies_book").on(table.bookId),
    copyCodeIdx: index("idx_book_copies_code").on(table.copyCode),
    statusIdx: index("idx_book_copies_status").on(table.status),
    uniqueBookCopyNumberIdx: uniqueIndex("idx_book_copies_book_copy_number").on(table.bookId, table.copyNumber)
  })
);

export const loanRequests = sqliteTable(
  "loan_requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bookId: integer("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    requestedCopyId: integer("requested_copy_id").references(() => bookCopies.id, { onDelete: "set null" }),
    requesterName: text("requester_name").notNull(),
    requesterOrganization: text("requester_organization"),
    requesterDesignation: text("requester_designation"),
    requesterAddress: text("requester_address"),
    requesterPhone: text("requester_phone").notNull(),
    requesterEmail: text("requester_email"),
    borrowedAt: text("borrowed_at"),
    expectedReturnAt: text("expected_return_at"),
    note: text("note"),
    adminNote: text("admin_note"),
    requestedAt: text("requested_at").notNull().default("CURRENT_TIMESTAMP"),
    reviewedAt: text("reviewed_at"),
    reviewedByUserId: integer("reviewed_by_user_id"),
    approvedLoanId: integer("approved_loan_id"),
    status: text("status").notNull().default("requested"),
    ...timestampColumns
  },
  (table) => ({
    bookIdx: index("idx_loan_requests_book").on(table.bookId),
    statusIdx: index("idx_loan_requests_status").on(table.status),
    requestedAtIdx: index("idx_loan_requests_requested_at").on(table.requestedAt),
    reviewedByIdx: index("idx_loan_requests_reviewed_by").on(table.reviewedByUserId)
  })
);

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    username: text("username").notNull().unique(),
    usernameNormalized: text("username_normalized").notNull().unique(),
    fullName: text("full_name"),
    phone: text("phone"),
    role: text("role").notNull().default("librarian"),
    passwordHash: text("password_hash").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    ...timestampColumns
  },
  (table) => ({
    roleIdx: index("idx_users_role").on(table.role),
    activeIdx: index("idx_users_active").on(table.isActive)
  })
);

export const authSessions = sqliteTable(
  "auth_sessions",
  {
    token: text("token").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: text("expires_at").notNull(),
    lastSeenAt: text("last_seen_at"),
    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP")
  },
  (table) => ({
    userIdx: index("idx_auth_sessions_user").on(table.userId),
    expiryIdx: index("idx_auth_sessions_expiry").on(table.expiresAt)
  })
);

export const bookReviews = sqliteTable(
  "book_reviews",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bookId: integer("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    reviewerName: text("reviewer_name").notNull(),
    reviewerPhone: text("reviewer_phone").notNull(),
    rating: integer("rating").notNull(),
    comment: text("comment").notNull(),
    isHidden: integer("is_hidden", { mode: "boolean" }).notNull().default(false),
    ...timestampColumns
  },
  (table) => ({
    bookIdx: index("idx_book_reviews_book").on(table.bookId),
    ratingIdx: index("idx_book_reviews_rating").on(table.rating),
    createdIdx: index("idx_book_reviews_created").on(table.createdAt)
  })
);

export const metadataSources = sqliteTable(
  "metadata_sources",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bookId: integer("book_id").references(() => books.id, { onDelete: "set null" }),
    isbn: text("isbn"),
    sourceName: text("source_name").notNull(),
    rawPayload: text("raw_payload"),
    normalizedPayload: text("normalized_payload"),
    success: integer("success", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP")
  },
  (table) => ({
    isbnIdx: index("idx_metadata_sources_isbn").on(table.isbn),
    sourceIdx: index("idx_metadata_sources_source").on(table.sourceName)
  })
);

export const activityLogs = sqliteTable(
  "activity_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(),
    message: text("message").notNull(),
    payload: text("payload"),
    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP")
  },
  (table) => ({
    entityIdx: index("idx_activity_entity").on(table.entityType, table.entityId),
    actionIdx: index("idx_activity_action").on(table.action),
    createdIdx: index("idx_activity_created").on(table.createdAt)
  })
);

export const librarySettings = sqliteTable("library_settings", {
  id: integer("id").primaryKey().default(1),
  libraryName: text("library_name").notNull().default("My Library"),
  logoImageKey: text("logo_image_key"),
  publicBaseUrl: text("public_base_url"),
  dateFormat: text("date_format").notNull().default("yyyy-MM-dd"),
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  contactAddress: text("contact_address"),
  siteMetaTitle: text("site_meta_title"),
  siteMetaDescription: text("site_meta_description"),
  defaultLanguage: text("default_language"),
  defaultCategory: text("default_category"),
  publicVisibilityMode: text("public_visibility_mode").notNull().default("selected"),
  labelHeaderText: text("label_header_text"),
  labelIncludeTitle: integer("label_include_title", { mode: "boolean" }).notNull().default(true),
  labelIncludeAuthor: integer("label_include_author", { mode: "boolean" }).notNull().default(true),
  labelIncludeDate: integer("label_include_date", { mode: "boolean" }).notNull().default(false),
  labelIncludeQr: integer("label_include_qr", { mode: "boolean" }).notNull().default(true),
  labelColumns: integer("label_columns").notNull().default(3),
  labelWidthMm: integer("label_width_mm").notNull().default(50),
  labelHeightMm: integer("label_height_mm").notNull().default(30),
  ...timestampColumns
});

export const drafts = sqliteTable(
  "drafts",
  {
    id: text("id").primaryKey(),
    formType: text("form_type").notNull(),
    payload: text("payload").notNull(),
    updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP")
  },
  (table) => ({
    formIdx: index("idx_drafts_form_type").on(table.formType)
  })
);

export type BookRow = typeof books.$inferSelect;
export type NewBookRow = typeof books.$inferInsert;
