export interface Env {
  DB: D1Database;
  LIBRARY_KV: KVNamespace;
  ASSETS: Fetcher;
  APP_ENV?: string;
  ADMIN_TOKEN?: string;
  OCR_SPACE_API_KEY?: string;
  PUBLIC_BASE_URL?: string;
}

export type AppBindings = {
  Bindings: Env;
};