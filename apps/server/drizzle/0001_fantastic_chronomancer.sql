CREATE TYPE "public"."completion_status" AS ENUM('pending', 'approved');--> statement-breakpoint
ALTER TABLE "completions" ADD COLUMN "status" "completion_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
UPDATE "completions" SET "status" = 'approved' WHERE "status" = 'pending';