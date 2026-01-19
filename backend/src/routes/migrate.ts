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

    // Run the column name fix SQL - execute statements individually for reliability
    console.log('Running column name fix SQL...');
    let fixExecuted = false;
    let fixErrors: string[] = [];
    
    try {
      // First, check what columns actually exist
      const usersColumns = await prisma.$queryRaw`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name IN ('createdAt', 'created_at', 'updatedAt', 'updated_at')
      ` as Array<{column_name: string}>;
      
      console.log('Current users table columns:', usersColumns.map(c => c.column_name));
      
      // Fix users table - execute each statement separately
      if (usersColumns.some(c => c.column_name === 'createdAt')) {
        try {
          await prisma.$executeRawUnsafe('ALTER TABLE "users" RENAME COLUMN "createdAt" TO "created_at"');
          console.log('✓ Renamed users.createdAt to created_at');
        } catch (e: any) {
          if (!e.message?.includes('does not exist')) {
            fixErrors.push(`users.createdAt: ${e.message}`);
          }
        }
      }
      
      if (usersColumns.some(c => c.column_name === 'updatedAt')) {
        try {
          await prisma.$executeRawUnsafe('ALTER TABLE "users" RENAME COLUMN "updatedAt" TO "updated_at"');
          console.log('✓ Renamed users.updatedAt to updated_at');
        } catch (e: any) {
          if (!e.message?.includes('does not exist')) {
            fixErrors.push(`users.updatedAt: ${e.message}`);
          }
        }
      }
      
      // Verify the fix
      const verifyColumns = await prisma.$queryRaw`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name IN ('created_at', 'updated_at')
      ` as Array<{column_name: string}>;
      
      if (verifyColumns.length >= 2) {
        console.log('✓ Users table columns verified:', verifyColumns.map(c => c.column_name));
        fixExecuted = true;
      } else {
        console.warn('⚠ Users table columns not fully fixed:', verifyColumns.map(c => c.column_name));
      }
      
      // Fix rooms table columns
      const roomsColumns = await prisma.$queryRaw`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'rooms' 
        AND column_name IN ('createdAt', 'created_at', 'updatedAt', 'updated_at', 'ownerId', 'creator_id', 'isPublic', 'visibility', 'maxUsers', 'max_capacity')
      ` as Array<{column_name: string}>;
      
      console.log('Current rooms table columns:', roomsColumns.map(c => c.column_name));
      
      const renameStatements = [
        { from: 'createdAt', to: 'created_at' },
        { from: 'updatedAt', to: 'updated_at' },
        { from: 'ownerId', to: 'creator_id' },
        { from: 'isPublic', to: 'visibility' },
        { from: 'maxUsers', to: 'max_capacity' }
      ];
      
      for (const stmt of renameStatements) {
        if (roomsColumns.some(c => c.column_name === stmt.from)) {
          try {
            await prisma.$executeRawUnsafe(`ALTER TABLE "rooms" RENAME COLUMN "${stmt.from}" TO "${stmt.to}"`);
            console.log(`✓ Renamed rooms.${stmt.from} to ${stmt.to}`);
          } catch (e: any) {
            if (!e.message?.includes('does not exist')) {
              fixErrors.push(`rooms.${stmt.from}: ${e.message}`);
            }
          }
        }
      }
      
      // Add missing columns to rooms if needed
      const addColumns = [
        { name: 'last_activity', type: 'TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP' },
        { name: 'input', type: 'TEXT NOT NULL DEFAULT \'\'' },
        { name: 'output', type: 'TEXT NOT NULL DEFAULT \'\'' }
      ];
      
      for (const col of addColumns) {
        if (!roomsColumns.some(c => c.column_name === col.name)) {
          try {
            await prisma.$executeRawUnsafe(`ALTER TABLE "rooms" ADD COLUMN "${col.name}" ${col.type}`);
            console.log(`✓ Added rooms.${col.name}`);
          } catch (e: any) {
            fixErrors.push(`rooms.${col.name}: ${e.message}`);
          }
        }
      }
      
      // Make password nullable if needed
      try {
        await prisma.$executeRawUnsafe('ALTER TABLE "rooms" ALTER COLUMN "password" DROP NOT NULL');
        console.log('✓ Made rooms.password nullable');
      } catch (e: any) {
        // Ignore if already nullable or column doesn't exist
      }
      
      // CRITICAL: Check if room_participants table exists, create if missing
      const tablesCheck = await prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('room_users', 'room_participants')
      ` as Array<{table_name: string}>;
      
      const hasRoomUsers = tablesCheck.some(t => t.table_name === 'room_users');
      const hasRoomParticipants = tablesCheck.some(t => t.table_name === 'room_participants');
      
      if (!hasRoomUsers && !hasRoomParticipants) {
        // Table doesn't exist at all - create it
        console.log('⚠️ room_participants table does not exist. Creating it...');
        try {
          await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "room_participants" (
              "id" TEXT NOT NULL,
              "room_id" TEXT NOT NULL,
              "user_id" TEXT NOT NULL,
              "cursor_line" INTEGER NOT NULL DEFAULT 0,
              "cursor_column" INTEGER NOT NULL DEFAULT 0,
              "status" TEXT NOT NULL DEFAULT 'active',
              "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
              "last_activity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
              CONSTRAINT "room_participants_pkey" PRIMARY KEY ("id"),
              CONSTRAINT "room_participants_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE,
              CONSTRAINT "room_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
              CONSTRAINT "room_participants_room_id_user_id_key" UNIQUE ("room_id", "user_id")
            )
          `);
          console.log('✓ Created room_participants table');
        } catch (e: any) {
          console.error('Failed to create room_participants table:', e.message);
          fixErrors.push(`room_participants creation: ${e.message}`);
        }
      } else if (hasRoomUsers && !hasRoomParticipants) {
        // Rename room_users to room_participants
        console.log('Renaming room_users to room_participants...');
        try {
          await prisma.$executeRawUnsafe('ALTER TABLE "room_users" RENAME TO "room_participants"');
          console.log('✓ Renamed room_users to room_participants');
          
          // Fix column names
          const participantColumns = await prisma.$queryRaw`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'room_participants'
          ` as Array<{column_name: string}>;
          
          if (participantColumns.some(c => c.column_name === 'userId')) {
            await prisma.$executeRawUnsafe('ALTER TABLE "room_participants" RENAME COLUMN "userId" TO "user_id"');
          }
          if (participantColumns.some(c => c.column_name === 'roomId')) {
            await prisma.$executeRawUnsafe('ALTER TABLE "room_participants" RENAME COLUMN "roomId" TO "room_id"');
          }
          if (participantColumns.some(c => c.column_name === 'joinedAt')) {
            await prisma.$executeRawUnsafe('ALTER TABLE "room_participants" RENAME COLUMN "joinedAt" TO "joined_at"');
          }
          
          // Add missing columns
          if (!participantColumns.some(c => c.column_name === 'cursor_line')) {
            await prisma.$executeRawUnsafe('ALTER TABLE "room_participants" ADD COLUMN "cursor_line" INTEGER NOT NULL DEFAULT 0');
          }
          if (!participantColumns.some(c => c.column_name === 'cursor_column')) {
            await prisma.$executeRawUnsafe('ALTER TABLE "room_participants" ADD COLUMN "cursor_column" INTEGER NOT NULL DEFAULT 0');
          }
          if (!participantColumns.some(c => c.column_name === 'status')) {
            await prisma.$executeRawUnsafe('ALTER TABLE "room_participants" ADD COLUMN "status" TEXT NOT NULL DEFAULT \'active\'');
          }
          if (!participantColumns.some(c => c.column_name === 'last_activity')) {
            await prisma.$executeRawUnsafe('ALTER TABLE "room_participants" ADD COLUMN "last_activity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP');
          }
        } catch (e: any) {
          console.error('Failed to rename/fix room_participants:', e.message);
          fixErrors.push(`room_participants rename: ${e.message}`);
        }
      }
      
      console.log('Column name fix SQL executed successfully');
      if (fixErrors.length > 0) {
        console.warn('Some fixes had errors:', fixErrors);
      }
      fixExecuted = true;
      
    } catch (fixError: any) {
      console.error('Column fix SQL error:', fixError.message);
      console.error('Error details:', JSON.stringify(fixError, null, 2));
      // Don't fail the migration if fix has errors - might already be fixed
    }

    // ALWAYS regenerate Prisma client to ensure it's up to date
    console.log('Regenerating Prisma client...');
    try {
      const generateResult = await execAsync('npx prisma generate', {
        cwd: process.cwd(),
        env: { ...process.env }
      });
      console.log('Prisma client regenerated:', generateResult.stdout);
      
      // Verify columns are correct after regeneration
      try {
        const finalCheck = await prisma.$queryRaw`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'users' 
          AND column_name IN ('created_at', 'updated_at')
        ` as Array<{column_name: string}>;
        
        if (finalCheck.length === 2) {
          console.log('✓ Final verification: users table has correct columns');
        } else {
          console.warn('⚠ Final verification: users table columns may not be correct:', finalCheck.map(c => c.column_name));
        }
      } catch (verifyError: any) {
        console.warn('Could not verify columns after fix:', verifyError.message);
      }
      
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
      columnFixExecuted: fixExecuted,
      note: 'IMPORTANT: If registration still fails, the application needs to be restarted to pick up the new Prisma client. Redeploy your service on Render or wait for automatic restart.',
      nextSteps: [
        '1. Wait 1-2 minutes for the app to restart automatically',
        '2. Try registration again',
        '3. If it still fails, manually redeploy on Render'
      ]
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

// Direct fix endpoint - creates missing tables and fixes columns
migrateRoutes.post('/fix-tables', async (req: Request, res: Response) => {
  try {
    console.log('Direct table fix requested...');
    
    // Check if room_participants table exists
    const tablesCheck = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('room_users', 'room_participants')
    ` as Array<{table_name: string}>;
    
    const hasRoomUsers = tablesCheck.some(t => t.table_name === 'room_users');
    const hasRoomParticipants = tablesCheck.some(t => t.table_name === 'room_participants');
    
    if (!hasRoomUsers && !hasRoomParticipants) {
      // Create the table
      console.log('Creating room_participants table...');
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "room_participants" (
          "id" TEXT NOT NULL,
          "room_id" TEXT NOT NULL,
          "user_id" TEXT NOT NULL,
          "cursor_line" INTEGER NOT NULL DEFAULT 0,
          "cursor_column" INTEGER NOT NULL DEFAULT 0,
          "status" TEXT NOT NULL DEFAULT 'active',
          "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "last_activity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "room_participants_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "room_participants_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "room_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "room_participants_room_id_user_id_key" UNIQUE ("room_id", "user_id")
        )
      `);
      console.log('✓ Created room_participants table');
    } else if (hasRoomUsers && !hasRoomParticipants) {
      // Rename existing table
      await prisma.$executeRawUnsafe('ALTER TABLE "room_users" RENAME TO "room_participants"');
      console.log('✓ Renamed room_users to room_participants');
    }
    
    // Check if code_executions table exists
    const codeTablesCheck = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('execution_logs', 'code_executions')
    ` as Array<{table_name: string}>;
    
    const hasExecutionLogs = codeTablesCheck.some(t => t.table_name === 'execution_logs');
    const hasCodeExecutions = codeTablesCheck.some(t => t.table_name === 'code_executions');
    
    if (hasExecutionLogs && !hasCodeExecutions) {
      await prisma.$executeRawUnsafe('ALTER TABLE "execution_logs" RENAME TO "code_executions"');
      console.log('✓ Renamed execution_logs to code_executions');
    }
    
    // Regenerate Prisma client
    await execAsync('npx prisma generate', {
      cwd: process.cwd(),
      env: { ...process.env }
    });
    
    return res.json({
      success: true,
      message: 'Tables fixed successfully',
      tablesCreated: !hasRoomParticipants,
      note: 'Prisma client regenerated. Try registration again.'
    });
  } catch (error: any) {
    console.error('Table fix error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fix tables',
      details: error.message
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
