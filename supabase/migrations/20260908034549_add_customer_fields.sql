/*
# Add whatsapp_number and city columns to customers

## Changes
1. Adds `whatsapp_number` (text, nullable) to the customers table.
2. Adds `city` (text, nullable) to the customers table.
3. Backfills `city` from existing `address` where possible (best-effort extraction).

## Security
- No policy changes. Existing RLS policies already allow full CRUD for anon+authenticated.

## Notes
1. Both columns are nullable so existing rows remain valid.
2. The `company` column is retained for backward compatibility with Jobs, Payments, Reports, and Dashboard pages that reference it.
*/

ALTER TABLE customers ADD COLUMN IF NOT EXISTS whatsapp_number text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS city text;

-- Best-effort: extract city from address (last comma-separated segment)
UPDATE customers
SET city = TRIM(SPLIT_PART(address, ',', GREATEST(ARRAY_LENGTH(STRING_TO_ARRAY(address, ','), 1), 2)))
WHERE city IS NULL AND address IS NOT NULL AND address LIKE '%,%';