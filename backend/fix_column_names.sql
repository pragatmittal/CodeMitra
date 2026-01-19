-- Fix column names to match Prisma schema (@map directives)
-- This migration renames camelCase columns to snake_case

-- Fix users table
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'createdAt') THEN
        ALTER TABLE "users" RENAME COLUMN "createdAt" TO "created_at";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'updatedAt') THEN
        ALTER TABLE "users" RENAME COLUMN "updatedAt" TO "updated_at";
    END IF;
END $$;

-- Fix rooms table (if columns exist with old names)
DO $$ 
BEGIN
    -- Check and rename if exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rooms' AND column_name = 'createdAt') THEN
        ALTER TABLE "rooms" RENAME COLUMN "createdAt" TO "created_at";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rooms' AND column_name = 'updatedAt') THEN
        ALTER TABLE "rooms" RENAME COLUMN "updatedAt" TO "updated_at";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rooms' AND column_name = 'ownerId') THEN
        ALTER TABLE "rooms" RENAME COLUMN "ownerId" TO "creator_id";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rooms' AND column_name = 'isPublic') THEN
        ALTER TABLE "rooms" RENAME COLUMN "isPublic" TO "visibility";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rooms' AND column_name = 'maxUsers') THEN
        ALTER TABLE "rooms" RENAME COLUMN "maxUsers" TO "max_capacity";
    END IF;
END $$;

-- Fix room_participants table (if it exists as room_users)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'room_users') THEN
        -- Rename table if needed
        ALTER TABLE "room_users" RENAME TO "room_participants";
        
        -- Rename columns
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'room_participants' AND column_name = 'userId') THEN
            ALTER TABLE "room_participants" RENAME COLUMN "userId" TO "user_id";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'room_participants' AND column_name = 'roomId') THEN
            ALTER TABLE "room_participants" RENAME COLUMN "roomId" TO "room_id";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'room_participants' AND column_name = 'joinedAt') THEN
            ALTER TABLE "room_participants" RENAME COLUMN "joinedAt" TO "joined_at";
        END IF;
        
        -- Add missing columns if they don't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'room_participants' AND column_name = 'cursor_line') THEN
            ALTER TABLE "room_participants" ADD COLUMN "cursor_line" INTEGER NOT NULL DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'room_participants' AND column_name = 'cursor_column') THEN
            ALTER TABLE "room_participants" ADD COLUMN "cursor_column" INTEGER NOT NULL DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'room_participants' AND column_name = 'status') THEN
            ALTER TABLE "room_participants" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'room_participants' AND column_name = 'last_activity') THEN
            ALTER TABLE "room_participants" ADD COLUMN "last_activity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
        END IF;
        
        -- Remove role column if it exists (not in current schema)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'room_participants' AND column_name = 'role') THEN
            ALTER TABLE "room_participants" DROP COLUMN "role";
        END IF;
    END IF;
END $$;

-- Fix code_executions table (handle both execution_logs and code_executions)
DO $$
BEGIN
    -- If execution_logs exists, rename it to code_executions
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'execution_logs') THEN
        ALTER TABLE "execution_logs" RENAME TO "code_executions";
    END IF;
    
    -- Fix code_executions columns (whether it was renamed or already exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'code_executions') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'code_executions' AND column_name = 'userId') THEN
            ALTER TABLE "code_executions" RENAME COLUMN "userId" TO "user_id";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'code_executions' AND column_name = 'roomId') THEN
            ALTER TABLE "code_executions" RENAME COLUMN "roomId" TO "room_id";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'code_executions' AND column_name = 'createdAt') THEN
            ALTER TABLE "code_executions" RENAME COLUMN "createdAt" TO "created_at";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'code_executions' AND column_name = 'executionTime') THEN
            ALTER TABLE "code_executions" RENAME COLUMN "executionTime" TO "execution_time";
        END IF;
        
        -- Remove columns not in current schema
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'code_executions' AND column_name = 'memoryUsed') THEN
            ALTER TABLE "code_executions" DROP COLUMN "memoryUsed";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'code_executions' AND column_name = 'compilationTime') THEN
            ALTER TABLE "code_executions" DROP COLUMN "compilationTime";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'code_executions' AND column_name = 'success') THEN
            ALTER TABLE "code_executions" DROP COLUMN "success";
        END IF;
    END IF;
END $$;

-- Add missing columns to rooms table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rooms' AND column_name = 'last_activity') THEN
        ALTER TABLE "rooms" ADD COLUMN "last_activity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rooms' AND column_name = 'input') THEN
        ALTER TABLE "rooms" ADD COLUMN "input" TEXT NOT NULL DEFAULT '';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rooms' AND column_name = 'output') THEN
        ALTER TABLE "rooms" ADD COLUMN "output" TEXT NOT NULL DEFAULT '';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rooms' AND column_name = 'password' AND is_nullable = 'NO') THEN
        ALTER TABLE "rooms" ALTER COLUMN "password" DROP NOT NULL;
    END IF;
END $$;

-- Drop chat_messages table if it exists (not in current schema)
DROP TABLE IF EXISTS "chat_messages";
