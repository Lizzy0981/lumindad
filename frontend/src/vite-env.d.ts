/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL:          string;
  readonly VITE_WS_URL:           string;
  readonly VITE_USE_SEED_DATA:    string;
  readonly VITE_ML_SERVICE_URL:   string;
  readonly VITE_APP_VERSION:      string;
  readonly VITE_ENV:              string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
