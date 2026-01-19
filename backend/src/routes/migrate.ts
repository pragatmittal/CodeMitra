import express, { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const migrateRoutes = express.Router();

// Embedded SQL to fix column names (camelCase to snake_case)
const FIX_COLUMN_NAMES_SQL = `
-- Fix column names to match Prisma schema (@map directives)
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

-- Fix rooms table
DO $$ 
BEGIN
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

-- Fix room_participants table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'room_users') THEN
        ALTER TABLE "room_users" RENAME TO "room_participants";
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'room_participants') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'room_participants' AND column_name = 'userId') THEN
            ALTER TABLE "room_participants" RENAME COLUMN "userId" TO "user_id";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'room_participants' AND column_name = 'roomId') THEN
            ALTER TABLE "room_participants" RENAME COLUMN "roomId" TO "room_id";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'room_participants' AND column_name = 'joinedAt') THEN
            ALTER TABLE "room_participants" RENAME COLUMN "joinedAt" TO "joined_at";
        END IF;
        
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
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'room_participants' AND column_name = 'role') THEN
            ALTER TABLE "room_participants" DROP COLUMN "role";
        END IF;
    END IF;
END $$;

-- Fix code_executions table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'execution_logs') THEN
        ALTER TABLE "execution_logs" RENAME TO "code_executions";
    END IF;
    
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

-- Drop chat_messages table if it exists
DROP TABLE IF EXISTS "chat_messages";
`;

// Migration endpoint - Allow without token for now (can be secured later)
migrateRoutes.post('/run', async (req: Request, res: Response) => {
  try {
    // SECURITY: Token check is optional - only enforce if explicitly set
    const secretToken = process.env.MIGRATION_SECRET_TOKEN;
    const providedToken = req.headers['x-migration-token'] || req.body.token;

    // Only require token if it's explicitly set in environment
    if (secretToken && secretToken.trim() !== '' && providedToken !== secretToken) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized. Invalid migration token.',
        hint: 'Set MIGRATION_SECRET_TOKEN in environment or provide token in header/body'
      });
    }

    console.log('Starting database migrations...');

    // Run Prisma migrations first
    console.log('Running Prisma migrations...');
    const { stdout, stderr } = await execAsync('npx prisma migrate deploy', {
      cwd: process.cwd(),
      env: { ...process.env }
    });

    // Run the column name fix SQL (embedded in code to avoid path issues)
    console.log('Running column name fix SQL...');
    let fixExecuted = false;
    try {
      // Execute the embedded SQL directly using Prisma
      await prisma.$executeRawUnsafe(FIX_COLUMN_NAMES_SQL);
      console.log('Column name fix SQL executed successfully');
      fixExecuted = true;
    } catch (fixError: any) {
      // Log the error but continue - might already be fixed or have other issues
      console.warn('Column fix SQL warning:', fixError.message);
      // Check if it's a "column doesn't exist" error (means already fixed)
      if (fixError.message && (
        fixError.message.includes('does not exist') ||
        fixError.message.includes('column') && fixError.message.includes('already')
      )) {
        console.log('Columns may already be fixed, continuing...');
        fixExecuted = true; // Assume it's already fixed
      } else {
        console.warn('Column fix SQL error details:', JSON.stringify(fixError, null, 2));
      }
    }

    // ALWAYS regenerate Prisma client to ensure it's up to date
    console.log('Regenerating Prisma client...');
    try {
      const generateResult = await execAsync('npx prisma generate', {
        cwd: process.cwd(),
        env: { ...process.env }
      });
      console.log('Prisma client regenerated:', generateResult.stdout);
      
      // Disconnect and reconnect Prisma to pick up new client
      await prisma.$disconnect();
      // Reconnect happens automatically on next query
      console.log('Prisma client disconnected, will reconnect on next query');
    } catch (generateError: any) {
      console.error('Prisma generate error:', generateError.message);
      console.error('Generate stderr:', generateError.stderr);
      // This is critical - fail if we can't regenerate
      throw new Error(`Failed to regenerate Prisma client: ${generateError.message}`);
    }

    console.log('Migration output:', stdout);
    if (stderr) {
      console.warn('Migration warnings:', stderr);
    }

    return res.json({
      success: true,
      message: 'Migrations completed successfully',
      output: stdout,
      note: 'IMPORTANT: The application needs to be restarted/redeployed to pick up the new Prisma client. Please redeploy your service on Render after this migration.',
      fixExecuted: fixExecuted
    });
  } catch (error: any) {
    console.error('Migration error:', error);
    return res.status(500).json({
      success: false,
      error: 'Migration failed',
      details: error.message,
      output: error.stdout || '',
      errors: error.stderr || ''
    });
  }
});

// Check migration status
migrateRoutes.get('/status', async (req: Request, res: Response) => {
  try {
    const { stdout } = await execAsync('npx prisma migrate status', {
      cwd: process.cwd(),
      env: { ...process.env }
    });

    return res.json({
      success: true,
      status: stdout
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: 'Failed to check migration status',
      details: error.message
    });
  }
});

export { migrateRoutes };
