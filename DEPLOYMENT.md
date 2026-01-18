# CodeMitra Deployment Guide for Render

## Quick Fix for Docker Build Error

The Dockerfile has been updated to work with Render's build context. However, **Render's native Node.js build is recommended** (faster and simpler).

## Option 1: Use Native Build (Recommended - No Docker)

### Backend Configuration:
1. In Render dashboard, go to your backend service
2. Go to **Settings** tab
3. Scroll to **Build & Deploy** section
4. Make sure **Docker** is **NOT** selected
5. Use these settings:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Root Directory**: `backend`

### Environment Variables:
```
NODE_ENV=production
PORT=10000
DATABASE_URL=<your-render-postgres-url>
REDIS_URL=<your-upstash-redis-url>
JWT_SECRET=<your-secret-key>
FRONTEND_URL=https://codemitra-frontend.onrender.com
```

## Option 2: Use Docker (If Needed)

If you must use Docker:
1. The Dockerfile has been fixed to work with `backend` as build context
2. In Render, make sure:
   - **Root Directory**: `backend`
   - **Docker** is enabled in settings
   - **Dockerfile Path**: `Dockerfile` (or leave empty for auto-detect)

## Frontend Configuration

### Use Native Build (Recommended):
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Root Directory**: `frontend`

### Environment Variables:
```
NODE_ENV=production
NEXT_PUBLIC_BACKEND_URL=https://codemitra-backend.onrender.com
NEXT_PUBLIC_WS_URL=wss://codemitra-backend.onrender.com
NEXTAUTH_URL=https://codemitra-frontend.onrender.com
NEXTAUTH_SECRET=<your-secret-key>
```

## Database Migrations

After backend deployment, run migrations:
1. Go to backend service → **Shell** tab
2. Run:
   ```bash
   cd backend
   npx prisma generate
   npx prisma migrate deploy
   ```

## Troubleshooting

### If you still get Docker errors:
1. Go to service **Settings**
2. Disable **Docker** option
3. Use native Node.js build instead

### If build fails:
- Check that all dependencies are in `package.json`
- Verify Node version is 18+ (Render auto-detects)
- Check build logs for specific errors
