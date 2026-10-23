-- =============================================================================
-- Migration 017: Phase 9A — Threat States, Ambush & Landmark Scene System
-- Data-driven danger zone profiles and major landmark scene definitions
-- =============================================================================

CREATE TABLE IF NOT EXISTS danger_zone_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    zone_key TEXT NOT NULL UNIQUE,
    zone_name TEXT NOT NULL,
    danger_level TEXT NOT NULL,
    encounter_rate REAL NOT NULL DEFAULT 0.18,
    ambush_share REAL NOT NULL DEFAULT 0.30,
    min_steps_between_combats INTEGER NOT NULL DEFAULT 1,
    streak_dampening_per_event REAL NOT NULL DEFAULT 0.08,
    monster_pool_json TEXT NOT NULL DEFAULT '[]',
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS landmark_scene_definitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scene_key TEXT NOT NULL UNIQUE,
    landmark_type TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'MAJOR_LANDMARK',
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    artwork_url TEXT NOT NULL,
    is_major_landmark INTEGER NOT NULL DEFAULT 1,
    auto_open_on_arrival INTEGER NOT NULL DEFAULT 1,
    actions_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_danger_zone_profiles_key
    ON danger_zone_profiles(zone_key);

CREATE INDEX IF NOT EXISTS idx_landmark_scene_defs_type
    ON landmark_scene_definitions(landmark_type);
