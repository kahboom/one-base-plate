/** localStorage / legacy keys — keep stable for migration and tests that clear LS. */
export const STORAGE_KEY = "onebaseplate_households";
export const SEEDED_KEY = "onebaseplate_seeded";
export const MIGRATION_KEY = "onebaseplate_migrated_v1";
export const RECIPE_REF_MIGRATION_KEY = "onebaseplate_migrated_v2";
/** One-time: remove stored `whole-meal` tags after defaults were removed from import/migration. */
export const STRIP_WHOLE_MEAL_TAGS_KEY = "onebaseplate_strip_whole_meal_tags_v1";
/** One-time: remove theme tags (taco, pizza, pasta) from recipes and base meals. */
export const STRIP_THEME_RECIPE_TAGS_KEY = "onebaseplate_strip_theme_recipe_tags_v1";
export const DEFAULT_HOUSEHOLD_KEY = "onebaseplate_default_household_id";
/** Legacy: households blob lived in idb `kv` when localStorage quota was exceeded. */
export const HOUSEHOLDS_IDB_META = "onebaseplate_households_in_idb";

/** IndexedDB (Dexie) database name — separate from legacy `onebaseplate` idb v1 KV store. */
export const DEXIE_DB_NAME = "onebaseplate_app";

/** Dexie `meta` row keys (string primary key). */
export const META_HOUSEHOLDS = "households";
export const META_PAPRIKA_SESSION = "paprika_import_session";
/** One-time: copy legacy localStorage + legacy idb KV into Dexie; idempotent. */
export const META_STORAGE_LAYER_MIGRATED_V3 = "storage_layer_migrated_v3";

/** Paprika session — was localStorage; migrated into Dexie. */
export const PAPRIKA_SESSION_LS_KEY = "onebaseplate_paprika_session";

export const LEGACY_IDB_NAME = "onebaseplate";
export const LEGACY_IDB_STORE = "kv";
