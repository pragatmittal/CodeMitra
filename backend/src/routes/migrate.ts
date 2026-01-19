import express, { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const migrateRoutes = express.Router();

// Migration endpoint - SECURE THIS IN PRODUCTION!
migrateRoutes.post('/run', async (req: Request, res: Response) => {
  try {
    // SECURITY: Add a secret token check in production
    const secretToken = process.env.MIGRATION_SECRET_TOKEN;
    const providedToken = req.headers['x-migration-token'] || req.body.token;

    if (secretToken && providedToken !== secretToken) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized. Invalid migration token.'
      });
    }

    console.log('Starting database migrations...');

    // First, regenerate Prisma client to ensure it's up to date
    console.log('Regenerating Prisma client...');
    try {
      const generateResult = await execAsync('npx prisma generate', {
        cwd: process.cwd(),
        env: { ...process.env }
      });
      console.log('Prisma client regenerated:', generateResult.stdout);
    } catch (generateError: any) {
      console.warn('Prisma generate warning:', generateError.stdout || generateError.message);
    }

    // Run Prisma migrations
    const { stdout, stderr } = await execAsync('npx prisma migrate deploy', {
      cwd: process.cwd(),
      env: { ...process.env }
    });

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
