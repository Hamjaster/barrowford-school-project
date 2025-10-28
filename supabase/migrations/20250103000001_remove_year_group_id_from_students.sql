-- Remove year_group_id column from students table and related constraints/indexes
-- This migration removes the old year_group_id column that has been replaced by current_year_group_id

-- Drop the foreign key constraint first
ALTER TABLE "public"."students" DROP CONSTRAINT IF EXISTS "students_year_group_id_fkey";

-- Drop the index that includes year_group_id
DROP INDEX IF EXISTS "idx_students_year_group_class";

-- Remove the year_group_id column
ALTER TABLE "public"."students" DROP COLUMN IF EXISTS "year_group_id";

-- Recreate the index with current_year_group_id instead
CREATE INDEX "idx_students_current_year_group_class" ON "public"."students" USING "btree" ("current_year_group_id", "class_id");
