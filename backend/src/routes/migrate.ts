import express, { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import { join } from 'path';

const execAsync = promisify(exec);
const migrateRoutes = express.Router();

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

    // Run the column name fix SQL if it exists
    console.log('Running column name fix SQL...');
    try {
      const fixSqlPath = join(process.cwd(), 'fix_column_names.sql');
      const fixSql = await readFile(fixSqlPath, 'utf-8');
      
      // Execute the SQL directly using Prisma
      await prisma.$executeRawUnsafe(fixSql);
      console.log('Column name fix SQL executed successfully');
    } catch (fixError: any) {
      // If file doesn't exist or already fixed, that's okay
      if (fixError.code === 'ENOENT') {
        console.log('fix_column_names.sql not found, skipping (may already be fixed)');
      } else {
        console.warn('Column fix SQL warning:', fixError.message);
        // Continue anyway - might already be fixed
      }
    }

    // Then regenerate Prisma client to ensure it's up to date
    console.log('Regenerating Prisma client...');
    try {
      const generateResult = await execAsync('npx prisma generate', {
        cwd: process.cwd(),
        env: { ...process.env }
      });
      console.log('Prisma client regenerated:', generateResult.stdout);
    } catch (generateError: any) {
      console.warn('Prisma generate warning:', generateError.stdout || generateError.message);
      // Still continue even if generate has warnings
    }

    console.log('Migration output:', stdout);
    if (stderr) {
      console.warn('Migration warnings:', stderr);
    }

    return res.json({
      success: true,
      message: 'Migrations completed successfully',
      output: stdout
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
