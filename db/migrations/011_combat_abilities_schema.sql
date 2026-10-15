-- 011_combat_abilities_schema.sql: Add combat_state_json to encounters for tracking monster special abilities and status effects

ALTER TABLE encounters ADD COLUMN combat_state_json TEXT NOT NULL DEFAULT '{}';
