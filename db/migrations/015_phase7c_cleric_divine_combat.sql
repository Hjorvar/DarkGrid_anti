-- 015_phase7c_cleric_divine_combat.sql
-- Phase 7C: Cleric Divine Combat System (Divine Charges Resource & Persistence)

ALTER TABLE characters ADD COLUMN divine_charges INTEGER DEFAULT NULL;

-- Safely initialize existing heroes:
-- Living Clerics receive their canonical starting capacity: max(1, 6 + level + floor((wisdom - 10) / 2))
-- Non-Clerics and fallen characters receive 0.
UPDATE characters
SET divine_charges = CASE
  WHEN UPPER(class) = 'CLERIC' AND is_alive = 1 THEN
    MAX(1, 6 + COALESCE(level, 1) + CASE
      WHEN COALESCE(wisdom, 10) >= 10 THEN (COALESCE(wisdom, 10) - 10) / 2
      ELSE -((11 - COALESCE(wisdom, 10)) / 2)
    END)
  ELSE 0
END
WHERE divine_charges IS NULL;
