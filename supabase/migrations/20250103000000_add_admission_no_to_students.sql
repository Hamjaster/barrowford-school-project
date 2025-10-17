-- Add admission_no field to students table
ALTER TABLE "public"."students" ADD COLUMN "admission_no" text;

-- Add unique constraint for admission_no
ALTER TABLE "public"."students" ADD CONSTRAINT "students_admission_no_key" UNIQUE ("admission_no");

-- Add index for admission_no for better performance
CREATE INDEX "idx_students_admission_no" ON "public"."students" USING "btree" ("admission_no");
