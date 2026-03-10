export const contributorRoles = ["author", "editor", "translator", "illustrator"] as const;
export const bookStatuses = ["available", "borrowed", "lost"] as const;
export const loanStatuses = ["borrowed", "returned", "lost"] as const;
export const acquisitionTypes = ["purchase", "gift", "other"] as const;

export const defaultCategories = [
  "Literature",
  "History",
  "Science",
  "Religion",
  "Programming",
  "Philosophy",
  "Biography"
] as const;

// Kept for backward compatibility with previous imports.
export const defaultBanglaCategories = [...defaultCategories];

export const defaultLanguages = ["Bangla", "English", "Arabic", "Hindi"] as const;
