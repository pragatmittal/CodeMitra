# CodeMitra - Interview Prep Guide (Part 3 - Final)

## Continued from Part 2...

### 🔟 DEPLOYMENT & DEVOPS

**Q: Where and how did you deploy your application?**

*"I deployed using Docker containers on Render.com:*

**Deployment Architecture:**
```
GitHub
    ↓ (git push)
Automatic Build Trigger
    ↓
Build Docker Images
    ↓
Deploy to Render
    ↓
Live at: https://codemitra.com
```

---

**1. Docker Containerization**

**Backend Dockerfile:**
```dockerfile
# backend/Dockerfile.render
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Expose port
EXPOSE 5001

# Start server
CMD ["npm", "start"]
```

**Frontend Dockerfile:**
```dockerfile
# frontend/Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production image
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000
CMD ["npm", "start"]
```

**Worker Dockerfile:**
```dockerfile
# worker/Dockerfile
FROM node:18-alpine

# Install Docker (for code execution)
RUN apk add --no-cache docker

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

CMD ["npm", "start"]
```

---

**2. Docker Compose (Local Development)**

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: codemitra
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    ports:
      - "5001:5001"
    environment:
      DATABASE_URL: postgresql://user:password@postgres:5432/codemitra
      REDIS_URL: redis://redis:6379
      JWT_SECRET: dev-secret
    depends_on:
      - postgres
      - redis
    volumes:
      - ./backend:/app
      - /app/node_modules

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:5001
      NEXT_PUBLIC_SOCKET_URL: http://localhost:5001
    depends_on:
      - backend
    volumes:
      - ./frontend:/app
      - /app/node_modules

  worker:
    build:
      context: ./worker
    environment:
      REDIS_URL: redis://redis:6379
    depends_on:
      - redis
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock  # Docker-in-Docker

volumes:
  postgres-data:
```

**Run locally:**
```bash
docker-compose up -d
```

---

**3. Render.com Configuration**

**render.yaml:**
```yaml
services:
  # Backend Service
  - type: web
    name: codemitra-backend
    env: docker
    dockerfilePath: ./backend/Dockerfile.render
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: codemitra-db
          property: connectionString
      - key: REDIS_URL
        fromService:
          name: codemitra-redis
          type: pserv
          property: connectionString
      - key: JWT_SECRET
        generateValue: true
      - key: NODE_ENV
        value: production

  # Frontend Service
  - type: web
    name: codemitra-frontend
    env: docker
    dockerfilePath: ./frontend/Dockerfile
    envVars:
      - key: NEXT_PUBLIC_API_URL
        value: https://codemitra-backend.onrender.com
      - key: NEXT_PUBLIC_SOCKET_URL
        value: https://codemitra-backend.onrender.com

  # Worker Service
  - type: worker
    name: codemitra-worker
    env: docker
    dockerfilePath: ./worker/Dockerfile
    envVars:
      - key: REDIS_URL
        fromService:
          name: codemitra-redis
          type: pserv
          property: connectionString

databases:
  - name: codemitra-db
    databaseName: codemitra
    user: codemitra

  - name: codemitra-redis
    plan: starter
```

---

**4. CI/CD Pipeline (GitHub Actions)**

**.github/workflows/deploy.yml:**
```yaml
name: Deploy to Render

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Run tests
        run: |
          cd backend
          npm ci
          npm test
      
      - name: Trigger Render deploy
        run: |
          curl -X POST "${{ secrets.RENDER_DEPLOY_HOOK }}"
      
      - name: Notify success
        if: success()
        run: |
          echo "Deployment successful!"
```

---

**5. Environment Variables**

**Backend (.env.production):**
```env
NODE_ENV=production
PORT=5001

# Database
DATABASE_URL=postgresql://user:pass@host:5432/codemitra

# Redis
REDIS_URL=redis://host:6379

# JWT
JWT_SECRET=super-secret-production-key

# CORS
FRONTEND_URL=https://codemitra.com

# Monitoring
SENTRY_DSN=https://...
```

**Frontend (.env.production):**
```env
NEXT_PUBLIC_API_URL=https://api.codemitra.com
NEXT_PUBLIC_SOCKET_URL=https://api.codemitra.com
```

---

**6. Database Migrations**

```bash
# Run migrations on deployment
npx prisma migrate deploy

# Seed database (optional)
npx prisma db seed
```

---

**7. Health Monitoring**

```javascript
// Setup health check endpoint
app.get('/healthz', async (req, res) => {
  const health = await checkHealth();
  res.status(health.status === 'healthy' ? 200 : 503).json(health);
});

// Render checks this endpoint every 30 seconds
```

---

**8. Deployment Checklist**

```
Pre-deployment:
✅ Run all tests
✅ Check for console.log statements
✅ Update dependencies
✅ Build succeeds locally
✅ Environment variables set
✅ Database migrations ready

Deployment:
✅ Push to main branch
✅ GitHub Actions runs tests
✅ Render builds Docker images
✅ Render deploys new version
✅ Health checks pass

Post-deployment:
✅ Check logs for errors
✅ Test critical flows
✅ Monitor performance metrics
✅ Verify database migrations
```

**Deployment Flow:**
```
1. Developer pushes to GitHub
    ↓
2. GitHub Actions runs tests
    ↓
3. Tests pass → Trigger Render webhook
    ↓
4. Render pulls code
    ↓
5. Render builds Docker image
    ↓
6. Render deploys to production
    ↓
7. Health checks validate deployment
    ↓
8. Traffic routed to new version
```

**Deployment Time:** ~5-10 minutes from push to live

*Docker + Render.com provides easy deployment with automatic SSL, scaling, and monitoring."*

---

**Q: What is CI/CD? Did you implement it?**

*"CI/CD stands for **Continuous Integration / Continuous Deployment**:*

**Continuous Integration (CI):**
- Automatically run tests on every code commit
- Ensure code builds successfully
- Catch bugs early

**Continuous Deployment (CD):**
- Automatically deploy to production after tests pass
- No manual deployment steps
- Faster iteration

---

**My CI/CD Pipeline:**

**1. Code Push**
```bash
git add .
git commit -m "Add room deletion feature"
git push origin main
```

---

**2. GitHub Actions Triggered**

**.github/workflows/ci-cd.yml:**
```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json
      
      - name: Install dependencies
        run: |
          cd backend
          npm ci
      
      - name: Run linter
        run: |
          cd backend
          npm run lint
      
      - name: Run tests
        run: |
          cd backend
          npm test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
          REDIS_URL: redis://localhost:6379
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./backend/coverage/coverage-final.json

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - name: Deploy to Render
        run: |
          curl -X POST "${{ secrets.RENDER_DEPLOY_HOOK }}"
      
      - name: Wait for deployment
        run: sleep 60
      
      - name: Health check
        run: |
          curl -f https://api.codemitra.com/healthz || exit 1
      
      - name: Notify Slack
        if: always()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Deployment ${{ job.status }}'
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

---

**3. Pipeline Stages**

```
Stage 1: Lint
    ↓ (pass)
Stage 2: Unit Tests
    ↓ (pass)
Stage 3: Integration Tests
    ↓ (pass)
Stage 4: Build Docker Image
    ↓ (pass)
Stage 5: Deploy to Staging
    ↓ (pass)
Stage 6: Smoke Tests
    ↓ (pass)
Stage 7: Deploy to Production
    ↓
✅ Live!
```

---

**4. Benefits of CI/CD**

✅ **Catch bugs early**: Tests run on every commit
✅ **Faster deployments**: No manual steps
✅ **Consistent process**: Same steps every time
✅ **Rollback capability**: Can revert to previous version
✅ **Confidence**: Automated testing before production
✅ **Documentation**: Pipeline serves as deployment docs

---

**5. Monitoring After Deployment**

```yaml
- name: Post-deployment checks
  run: |
    # Check API health
    curl -f https://api.codemitra.com/healthz
    
    # Check database connectivity
    curl -f https://api.codemitra.com/healthz/db
    
    # Verify key endpoints
    curl -f https://api.codemitra.com/api/rooms
```

---

**6. Rollback Strategy**

```bash
# If deployment fails, automatically rollback
- name: Rollback on failure
  if: failure()
  run: |
    curl -X POST "${{ secrets.RENDER_ROLLBACK_HOOK }}"
```

---

**CI/CD Flow Diagram:**
```
Developer
    ↓ (git push)
GitHub
    ↓ (webhook)
GitHub Actions
    ↓
[Run Tests] → [Build Docker] → [Deploy Staging] → [Test Staging] → [Deploy Production]
    ↓              ↓                ↓                   ↓                  ↓
   Pass          Pass             Pass               Pass               Pass
    
If any stage fails:
    ↓
Stop pipeline
    ↓
Notify developer
    ↓
Fix issue and push again
```

**Deployment Frequency:** 5-10 times per day (enabled by CI/CD)

*CI/CD automates the entire deployment process - from code commit to production."*

---

**Q: Explain your project's folder structure**

*"Here's the complete structure:*

```
CodeMitra/
│
├── backend/                    # Node.js Express server
│   ├── src/
│   │   ├── index.ts           # Entry point, Express setup
│   │   ├── middleware/
│   │   │   ├── auth.ts        # JWT authentication
│   │   │   ├── errorHandler.ts # Global error handler
│   │   │   └── rateLimiter.ts  # Rate limiting
│   │   ├── routes/
│   │   │   ├── auth.ts        # /api/auth/* endpoints
│   │   │   ├── rooms.ts       # /api/rooms/* endpoints
│   │   │   ├── users.ts       # /api/users/* endpoints
│   │   │   └── code.ts        # /api/code/* endpoints
│   │   ├── socket/
│   │   │   ├── index.ts       # Socket.io setup
│   │   │   ├── roomHandlers.ts # Room join/leave logic
│   │   │   └── codeHandlers.ts # Code sync handlers
│   │   └── utils/
│   │       ├── prisma.ts      # Prisma client
│   │       ├── redis.ts       # Redis client
│   │       ├── jwt.ts         # JWT utilities
│   │       ├── password.ts    # bcrypt hashing
│   │       └── codeExecutor.ts # Code execution queue
│   ├── prisma/
│   │   ├── schema.prisma      # Database schema
│   │   └── migrations/        # Migration history
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                   # Next.js 15 React app
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx     # Root layout
│   │   │   ├── page.tsx       # Homepage
│   │   │   ├── providers.tsx  # Context providers
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx   # Dashboard page
│   │   │   └── room/
│   │   │       └── [roomId]/
│   │   │           └── editor/
│   │   │               └── page.tsx # Editor page
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   │   ├── LoginForm.tsx
│   │   │   │   └── RegisterForm.tsx
│   │   │   ├── room/
│   │   │   │   ├── RoomCard.tsx
│   │   │   │   ├── CreateRoomModal.tsx
│   │   │   │   └── RoomList.tsx
│   │   │   ├── editor/
│   │   │   │   ├── MonacoEditor.tsx  # Code editor
│   │   │   │   ├── OutputPanel.tsx
│   │   │   │   └── UserCursors.tsx
│   │   │   └── ui/
│   │   │       ├── Button.tsx
│   │   │       ├── Modal.tsx
│   │   │       └── Toast.tsx
│   │   └── lib/
│   │       ├── socket.tsx     # Socket.io client
│   │       ├── api.ts         # API client
│   │       └── auth.tsx       # Auth context
│   ├── Dockerfile
│   ├── package.json
│   ├── next.config.js
│   └── tailwind.config.js
│
├── worker/                     # Background job processor
│   ├── src/
│   │   ├── index.ts           # BullMQ worker
│   │   ├── executors/
│   │   │   ├── javascriptExecutor.ts
│   │   │   ├── pythonExecutor.ts
│   │   │   ├── javaExecutor.ts
│   │   │   └── cppExecutor.ts
│   │   └── utils/
│   │       ├── docker.ts      # Docker runner
│   │       └── sandbox.ts     # Sandboxing logic
│   ├── Dockerfile
│   └── package.json
│
├── k8s/                        # Kubernetes manifests
│   ├── backend.yaml
│   ├── frontend.yaml
│   ├── worker.yaml
│   ├── postgres.yaml
│   └── redis.yaml
│
├── nginx/                      # Reverse proxy
│   ├── nginx.conf
│   └── Dockerfile
│
├── docker-compose.yml          # Local development
├── .github/
│   └── workflows/
│       └── ci-cd.yml          # GitHub Actions
├── README.md
└── package.json
```

---

**Why This Structure?**

**1. Separation of Concerns**
- Backend: Business logic, APIs, database
- Frontend: UI, user interactions
- Worker: Resource-intensive operations
- Each can scale independently

**2. Microservices Architecture**
- Each service has its own Dockerfile
- Can deploy/update services separately
- Easier to debug and test

**3. Clear Responsibilities**
```
Backend:
  ├── routes/     → Define endpoints
  ├── middleware/ → Authentication, error handling
  ├── socket/     → Real-time communication
  └── utils/      → Helper functions

Frontend:
  ├── app/        → Pages (Next.js App Router)
  ├── components/ → Reusable UI components
  └── lib/        → Client utilities

Worker:
  ├── executors/  → Language-specific execution
  └── utils/      → Docker/sandbox utilities
```

**4. Configuration at Root**
- `docker-compose.yml`: Local development
- `k8s/`: Production deployment
- `.github/workflows/`: CI/CD

*This structure makes it easy to navigate and understand the codebase."*

---

### 1️⃣1️⃣ ADVANCED & TWIST QUESTIONS

**Q: How would you improve this project for enterprise use?**

*"For enterprise deployment, I'd add:*

**1. Multi-Tenancy**
```javascript
// Separate workspaces for each organization
interface Organization {
  id: string;
  name: string;
  plan: 'free' | 'pro' | 'enterprise';
  maxRooms: number;
  maxUsers: number;
}

// Users belong to organizations
interface User {
  id: string;
  organizationId: string;
  role: 'admin' | 'member' | 'viewer';
}

// Rooms scoped to organization
interface Room {
  id: string;
  organizationId: string;
  // ...
}
```

---

**2. Role-Based Access Control (RBAC)**
```javascript
enum Permission {
  CREATE_ROOM = 'create:room',
  DELETE_ROOM = 'delete:room',
  EXECUTE_CODE = 'execute:code',
  INVITE_USERS = 'invite:users',
}

const rolePermissions = {
  admin: [Permission.CREATE_ROOM, Permission.DELETE_ROOM, Permission.EXECUTE_CODE, Permission.INVITE_USERS],
  member: [Permission.CREATE_ROOM, Permission.EXECUTE_CODE],
  viewer: []  // Read-only
};

// Middleware
const requirePermission = (permission: Permission) => {
  return (req, res, next) => {
    const userRole = req.user.role;
    if (!rolePermissions[userRole].includes(permission)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// Usage
app.delete('/api/rooms/:id',
  authenticate,
  requirePermission(Permission.DELETE_ROOM),
  deleteRoomHandler
);
```

---

**3. Audit Logging**
```javascript
// Log all sensitive operations
interface AuditLog {
  id: string;
  userId: string;
  organizationId: string;
  action: string;
  resource: string;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
}

// Audit middleware
const audit = (action: string) => async (req, res, next) => {
  await prisma.auditLog.create({
    data: {
      userId: req.user.id,
      organizationId: req.user.organizationId,
      action,
      resource: req.originalUrl,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    }
  });
  next();
};

// Usage
app.delete('/api/rooms/:id', authenticate, audit('DELETE_ROOM'), deleteHandler);
```

---

**4. SSO Integration (SAML/OAuth)**
```javascript
// Google OAuth
app.get('/api/auth/google', passport.authenticate('google'));

app.get('/api/auth/google/callback',
  passport.authenticate('google', { session: false }),
  (req, res) => {
    const token = generateJWT(req.user);
    res.redirect(`https://app.codemitra.com?token=${token}`);
  }
);

// SAML for enterprise SSO
app.post('/api/auth/saml',
  passport.authenticate('saml', { session: false }),
  (req, res) => {
    const token = generateJWT(req.user);
    res.json({ token, user: req.user });
  }
);
```

---

**5. Advanced Security**
```javascript
// IP whitelisting for organizations
interface Organization {
  allowedIPs: string[];  // ['192.168.1.0/24', '10.0.0.1']
}

const ipWhitelist = (req, res, next) => {
  const userIP = req.ip;
  const org = req.user.organization;
  
  if (org.allowedIPs.length > 0) {
    if (!isIPInRange(userIP, org.allowedIPs)) {
      return res.status(403).json({ error: 'IP not whitelisted' });
    }
  }
  next();
};

// Two-factor authentication
const require2FA = async (req, res, next) => {
  const token = req.body.twoFactorToken;
  const isValid = speakeasy.totp.verify({
    secret: req.user.twoFactorSecret,
    encoding: 'base32',
    token
  });
  
  if (!isValid) {
    return res.status(401).json({ error: '2FA code invalid' });
  }
  next();
};
```

---

**6. Data Residency & Compliance**
```javascript
// Store data in specific regions
interface Organization {
  dataRegion: 'us' | 'eu' | 'asia';
}

// Route to region-specific database
function getDatabaseClient(region: string) {
  const databases = {
    us: new PrismaClient({ datasources: { db: { url: process.env.US_DATABASE_URL } } }),
    eu: new PrismaClient({ datasources: { db: { url: process.env.EU_DATABASE_URL } } }),
    asia: new PrismaClient({ datasources: { db: { url: process.env.ASIA_DATABASE_URL } } })
  };
  return databases[region];
}

// GDPR compliance
app.delete('/api/users/me', authenticate, async (req, res) => {
  // Delete all user data
  await prisma.user.delete({ where: { id: req.user.id } });
  await prisma.room.deleteMany({ where: { creatorId: req.user.id } });
  await prisma.codeExecution.deleteMany({ where: { userId: req.user.id } });
  res.json({ message: 'All data deleted' });
});
```

---

**7. Advanced Monitoring**
```javascript
// Custom metrics
const roomCreationRate = new prometheus.Gauge({
  name: 'rooms_created_per_hour',
  help: 'Number of rooms created per hour'
});

const activeUsers = new prometheus.Gauge({
  name: 'active_users',
  help: 'Number of currently active users'
});

// SLA monitoring
const uptime = new prometheus.Counter({
  name: 'uptime_seconds_total',
  help: 'Total uptime in seconds'
});

// Track SLA: 99.9% uptime
setInterval(() => {
  uptime.inc();
}, 1000);
```

---

**8. Backup & Disaster Recovery**
```bash
# Automated daily backups
0 2 * * * pg_dump codemitra | gzip > /backups/codemitra-$(date +\%Y\%m\%d).sql.gz

# Point-in-time recovery
# Keep backups for 30 days
find /backups -name "*.sql.gz" -mtime +30 -delete

# Multi-region replication
# PostgreSQL streaming replication to secondary region
```

---

**9. Advanced Features**
- **Code review workflow**: Pull request style collaboration
- **Version history**: Git-like commit history for rooms
- **Templates**: Pre-configured room templates
- **Analytics**: Usage dashboards for admins
- **Quotas**: Limit execution time, rooms per org
- **Webhooks**: Notify external systems of events

**Enterprise Checklist:**
```
✅ Multi-tenancy (organization isolation)
✅ RBAC (role-based permissions)
✅ SSO (Google, SAML, Okta)
✅ Audit logging (compliance)
✅ 2FA (additional security)
✅ IP whitelisting
✅ Data residency (GDPR)
✅ 99.9% SLA
✅ 24/7 support
✅ Custom contracts
```

*These features make the platform enterprise-ready for companies like Google, Microsoft."*

---

**Q: How would you handle 100K concurrent users in a room?**

*"This is an extreme scale challenge. Here's my approach:*

**Problem:** Socket.io has limits (~10K connections per server)

**Solution: Hybrid Architecture**

**1. Operational Transform with CRDT**
```javascript
// Use Conflict-free Replicated Data Types
import * as Y from 'yjs';

// Each user has local CRDT document
const ydoc = new Y.Doc();
const ytext = ydoc.getText('code');

// Updates automatically merge
ytext.insert(0, 'Hello');
// User 2 inserts simultaneously
ytext.insert(0, 'World');
// Result: "WorldHello" (deterministic merge)

// Sync only deltas (not full code)
ydoc.on('update', (update) => {
  socket.emit('crdt:update', update);  // Small binary update
});
```

---

**2. Peer-to-Peer with WebRTC**
```javascript
// Direct peer connections (bypasses server)
const peerConnection = new RTCPeerConnection();

// Data channel for code updates
const dataChannel = peerConnection.createDataChannel('code');

dataChannel.onmessage = (event) => {
  applyUpdate(event.data);
};

// Server only for signaling (lightweight)
socket.emit('webrtc:signal', { offer, target: peerId });
```

---

**3. Edge Computing (Cloudflare Workers)**
```javascript
// Deploy Socket.io logic to edge
// Users connect to nearest data center
// Reduces latency from 200ms → 20ms

// Cloudflare Durable Objects for state
export class RoomState {
  async fetch(request) {
    const { code } = await request.json();
    await this.state.storage.put('code', code);
    // Broadcast to all connections
    this.broadcast({ code });
  }
}
```

---

**4. Redis Pub/Sub Sharding**
```javascript
// Shard rooms across Redis instances
function getRedisInstance(roomId) {
  const shard = hashCode(roomId) % NUM_REDIS_INSTANCES;
  return redisClients[shard];
}

// Each Redis handles 10K rooms
// 10 Redis instances = 100K rooms
```

---

**5. Read-Only Spectators**
```javascript
// Most users just watching (not editing)
// Separate WebSocket for spectators
socket.on('join:spectator', (roomId) => {
  // Subscribe to updates (no write permission)
  socket.join(`spectator:${roomId}`);
  
  // Send current code
  const code = await redis.get(`room:${roomId}:code`);
  socket.emit('code:snapshot', { code });
});

// Only 100 editors, 99.9K spectators
```

---

**6. Code Snapshot + Deltas**
```javascript
// Instead of syncing every keystroke:

// Every 5 seconds: Full snapshot
setInterval(() => {
  socket.emit('code:snapshot', { code: fullCode });
}, 5000);

// Between snapshots: Deltas only
onChange((delta) => {
  socket.emit('code:delta', { delta });
});

// Client reconstructs:
let code = lastSnapshot;
deltas.forEach(delta => code = applyDelta(code, delta));
```

---

**7. Horizontal Scaling**
```bash
# Auto-scale Socket.io servers
# Kubernetes HPA

apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: socketio-hpa
spec:
  minReplicas: 10
  maxReplicas: 1000
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        averageUtilization: 70
  - type: Pods
    pods:
      metric:
        name: active_connections
      target:
        averageValue: 10000

# 1000 servers × 100 connections = 100K users
```

---

**8. Database Optimization**
```javascript
// Don't save every keystroke to database
// Batch updates every 30 seconds

let pendingUpdate = null;

onChange((code) => {
  pendingUpdate = code;
});

setInterval(async () => {
  if (pendingUpdate) {
    await prisma.room.update({
      where: { id: roomId },
      data: { code: pendingUpdate }
    });
    pendingUpdate = null;
  }
}, 30000);  // 30 seconds
```

---

**Architecture for 100K Users:**

```
Users (100K)
    ↓
Cloudflare Edge (Nearest location)
    ↓
Load Balancer
    ↓
┌─────────────────────────────────────────┐
│  Socket.io Servers (100 instances)     │
│  Each handles 1K users                   │
└─────────────────────────────────────────┘
    ↓
Redis Pub/Sub Cluster (10 instances)
    ↓
PostgreSQL (Read Replicas)
```

**Key Optimizations:**
```
✅ CRDT for automatic conflict resolution
✅ WebRTC for peer-to-peer (bypasses server)
✅ Edge computing (low latency)
✅ Redis sharding (distribute load)
✅ Read-only spectators (separate channel)
✅ Delta compression (reduce bandwidth)
✅ Batch database writes (reduce queries)
✅ Horizontal scaling (1000 servers)
```

**Cost Estimate:**
- 100 Socket.io servers: $5,000/month
- 10 Redis clusters: $2,000/month
- 5 PostgreSQL replicas: $2,000/month
- Cloudflare Workers: $500/month
- **Total: ~$9,500/month**

*Realistic limit with current architecture: ~50K users per room. Beyond that, need P2P or CRDT."*

---

**Q: What if code execution service is down?**

*"I implement graceful degradation and fault tolerance:*

**1. Fallback Queue**
```javascript
// Primary worker down → Queue in Redis
try {
  const result = await executeCode(code, language);
  socket.emit('execution:result', result);
} catch (error) {
  if (error.code === 'WORKER_UNAVAILABLE') {
    // Queue for later
    await redis.lpush('pending-executions', JSON.stringify({
      userId: socket.data.user.id,
      roomId,
      code,
      language,
      timestamp: Date.now()
    }));
    
    socket.emit('execution:queued', {
      message: 'High load. Your code is queued.',
      position: await redis.llen('pending-executions')
    });
  }
}
```

---

**2. Multiple Worker Instances**
```javascript
// Deploy 5 worker instances
// If one fails, others handle load

// BullMQ automatically distributes jobs
const worker1 = new Worker('code-execution', processJob);
const worker2 = new Worker('code-execution', processJob);
const worker3 = new Worker('code-execution', processJob);

// Job sent to any available worker
queue.add('execute', { code, language });
```

---

**3. Health Checks & Auto-Restart**
```yaml
# Kubernetes deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: worker
spec:
  replicas: 5
  template:
    spec:
      containers:
      - name: worker
        livenessProbe:
          httpGet:
            path: /healthz
            port: 3002
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3002

# If health check fails → restart container
```

---

**4. Circuit Breaker Pattern**
```javascript
import CircuitBreaker from 'opossum';

const breaker = new CircuitBreaker(executeCode, {
  timeout: 30000,      // 30s timeout
  errorThresholdPercentage: 50,  // Open circuit if 50% fail
  resetTimeout: 60000  // Try again after 1 minute
});

breaker.fallback(() => {
  return {
    success: false,
    error: 'Execution service temporarily unavailable'
  };
});

// Execute with circuit breaker
const result = await breaker.fire(code, language);
```

---

**5. Client-Side Execution (Fallback)**
```javascript
// If server execution fails, run in browser (limited)
if (language === 'javascript') {
  try {
    // Use eval with sandbox (dangerous!)
    const result = new Function(code)();
    displayOutput(result);
  } catch (error) {
    displayError('Client-side execution failed');
  }
} else {
  displayError('Server execution unavailable. Please try again later.');
}
```

---

**6. Graceful Error Messages**
```javascript
socket.on('execution:error', (data) => {
  if (data.error.includes('WORKER_DOWN')) {
    toast.error('Execution service is down. Retrying in 30 seconds...');
    
    // Auto-retry
    setTimeout(() => {
      socket.emit('code:execute', { code, language });
    }, 30000);
  } else {
    toast.error(`Execution failed: ${data.error}`);
  }
});
```

---

**7. Monitoring & Alerts**
```javascript
// Send alert if worker down
app.get('/healthz/worker', async (req, res) => {
  const queueHealth = await queue.getJobCounts();
  const workersActive = await queue.getWorkers();
  
  if (workersActive.length === 0) {
    // Alert DevOps
    await sendSlackAlert('🚨 All workers are down!');
    
    return res.status(503).json({
      status: 'unhealthy',
      error: 'No workers available'
    });
  }
  
  res.json({ status: 'healthy', workers: workersActive.length });
});
```

---

**8. Job Expiration**
```javascript
// Don't queue jobs forever
queue.add('execute', { code, language }, {
  attempts: 3,       // Retry 3 times
  backoff: {
    type: 'exponential',
    delay: 5000      // 5s, 10s, 20s
  },
  removeOnComplete: true,
  removeOnFail: 100,  // Keep last 100 failures for debugging
  jobId: `exec-${userId}-${Date.now()}`
});
```

---

**Fault Tolerance Strategy:**

```
Level 1: Multiple Workers (N+2 redundancy)
    ↓ (all fail)
Level 2: Queue in Redis (retry later)
    ↓ (Redis fails)
Level 3: Circuit Breaker (stop trying)
    ↓
Level 4: Graceful Error Message
```

**Recovery Time:**
- Worker crashes: < 10 seconds (Kubernetes restarts)
- All workers down: < 2 minutes (manual intervention)
- Redis down: Fallback to in-memory queue (temporary)

*Multiple layers ensure system stays functional even during failures."*

---

### 1️⃣2️⃣ BEHAVIORAL QUESTIONS

**Q: What was the biggest challenge you faced?**

*"The biggest challenge was **real-time code synchronization** with multiple users typing simultaneously:*

**The Problem:**
- User A types "Hello" at position 0
- User B types "World" at position 0 (simultaneously)
- Without proper handling: Code becomes corrupted

**My Approach:**

**1. Research Phase (2 days)**
- Studied Google Docs architecture
- Learned about Operational Transform (OT) algorithm
- Analyzed alternatives (CRDT, diff-match-patch)

**2. Implementation (1 week)**
```javascript
// Implemented basic OT
function transform(operation1, operation2) {
  // If operations don't conflict, apply both
  if (operation1.position < operation2.position) {
    return [operation1, operation2];
  }
  
  // If they conflict, adjust positions
  const adjusted = {
    ...operation2,
    position: operation2.position + operation1.text.length
  };
  
  return [operation1, adjusted];
}
```

**3. Testing (3 days)**
- Tested with 2 users, 5 users, 10 users
- Found edge cases (delete operations, overlapping edits)
- Added conflict resolution logic

**4. Refinement (2 days)**
- Optimized network traffic (send deltas, not full code)
- Added debouncing (300ms delay)
- Implemented cursor tracking

**Outcome:**
✅ Smooth collaboration for up to 10 users
✅ Zero data loss
✅ Sub-second latency

**Lesson Learned:**
- Complex problems require research before coding
- Testing with real scenarios reveals issues
- Iteration is key - first version rarely perfect

*This challenge taught me to break down complex problems and iterate."*

---

**Q: How did you handle a bug that took days to fix?**

*"There was a critical bug where **code execution hung indefinitely**:*

**The Bug:**
- Users execute code → wait forever
- No timeout, no error message
- Backend shows no errors

**Day 1: Investigation**
```javascript
// Added logging
console.log('Adding job to queue:', jobId);
queue.add('execute', { code, language });
console.log('Job added');

// Found: Jobs added but never processed
```

**Day 2: Deeper Debugging**
```javascript
// Checked BullMQ dashboard
const jobs = await queue.getJobs(['waiting', 'active', 'completed', 'failed']);
console.log('Waiting jobs:', jobs.waiting.length);  // 100+
console.log('Active jobs:', jobs.active.length);    // 0
console.log('Workers:', await queue.getWorkers());  // []

// Found: No workers connected!
```

**Day 3: Root Cause**
```javascript
// Worker process not starting
// Checked worker logs:
Error: Cannot connect to Redis at redis://localhost:6379

// Found: Worker using localhost, should use Docker network name
❌ REDIS_URL=redis://localhost:6379
✅ REDIS_URL=redis://redis:6379
```

**Fix:**
```yaml
# docker-compose.yml
services:
  worker:
    environment:
      REDIS_URL: redis://redis:6379  # Use service name
```

**Prevention:**
```javascript
// Added health checks
app.get('/healthz/queue', async (req, res) => {
  const workers = await queue.getWorkers();
  if (workers.length === 0) {
    return res.status(503).json({
      status: 'unhealthy',
      error: 'No workers available'
    });
  }
  res.json({ status: 'healthy', workers: workers.length });
});

// Added timeout
queue.add('execute', { code, language }, {
  timeout: 30000  // 30s max
});
```

**Outcome:**
✅ Bug fixed
✅ Monitoring added
✅ Timeout prevents hanging

**Lesson Learned:**
- Environment-specific bugs are hardest to debug
- Logging is essential
- Health checks prevent silent failures

*This taught me the importance of observability and testing in production-like environments."*

---

**Q: How did you learn new technologies for this project?**

*"I learned multiple new technologies:*

**1. Socket.io (Real-time communication)**
- **Resource**: Official docs + YouTube tutorials
- **Practice**: Built simple chat app first
- **Time**: 2 days
- **Applied**: Integrated into CodeMitra

**2. Operational Transform**
- **Resource**: Google Docs paper, blog posts
- **Practice**: Implemented OT from scratch
- **Time**: 1 week
- **Applied**: Code synchronization

**3. Docker (Containerization)**
- **Resource**: Docker documentation, freeCodeCamp
- **Practice**: Containerized simple Node.js app
- **Time**: 3 days
- **Applied**: Sandboxed code execution

**4. Prisma ORM**
- **Resource**: Prisma docs, video tutorials
- **Practice**: Built CRUD API
- **Time**: 2 days
- **Applied**: Database management

**My Learning Process:**
```
1. Read official documentation (understand concepts)
    ↓
2. Watch tutorial video (see implementation)
    ↓
3. Build small project (hands-on practice)
    ↓
4. Integrate into CodeMitra (real-world application)
    ↓
5. Debug issues (deep understanding)
```

**Example: Learning Redis**
```javascript
// Day 1: Basics
const redis = require('redis');
const client = redis.createClient();

// Set/Get
await client.set('key', 'value');
const value = await client.get('key');

// Day 2: Pub/Sub
const publisher = redis.createClient();
const subscriber = redis.createClient();

subscriber.subscribe('channel');
subscriber.on('message', (channel, message) => {
  console.log(message);
});

publisher.publish('channel', 'Hello!');

// Day 3: Integration
// Used Redis for Socket.io adapter
io.adapter(createAdapter(pubClient, subClient));
```

**Learning Timeline:**
- Socket.io: 2 days
- Operational Transform: 1 week
- Docker: 3 days
- Prisma: 2 days
- Redis: 2 days
- **Total: 3 weeks of learning**

**Resources Used:**
- Official documentation (primary)
- YouTube (Net Ninja, Traversy Media, Web Dev Simplified)
- Stack Overflow (debugging issues)
- GitHub repos (example projects)
- Medium articles (best practices)

*Learning by building is the most effective approach."*

---

**Q: Why did you build this project?**

*"I built CodeMitra to solve a real problem I experienced:*

**The Problem:**
- During hackathons, sharing code over screen share is inefficient
- Switching between Zoom and IDE constantly
- Hard to collaborate on same file
- Existing solutions (VS Code Live Share) require same IDE

**My Vision:**
- **Browser-based**: No installation needed
- **Language-agnostic**: Support multiple languages
- **Real-time**: Like Google Docs for code
- **Execution**: Run code without local setup

**Personal Motivation:**
- Learn full-stack development
- Understand real-time systems
- Build something useful
- Add to portfolio

**Impact:**
- Helps remote teams collaborate
- Great for pair programming
- Useful for coding interviews
- Educational tool for teaching code

**What Makes It Unique:**
- Combines **collaboration + execution**
- Most tools do one or the other
- CodeMitra does both seamlessly

**Future Goals:**
- Used by 10,000+ developers
- Integrated with platforms like LeetCode
- Open-source community contributions
- Monetize with premium features

*I built this because I wanted to learn and solve a problem I personally faced."*

---

**Q: How do you prioritize features?**

*"I use the **MoSCoW method**:*

**Must Have (Critical for MVP):**
1. User authentication
2. Create/join rooms
3. Real-time code editing
4. Basic code execution (JavaScript, Python)
5. Room password protection

**Should Have (Important but not critical):**
1. Syntax highlighting (Monaco Editor)
2. Multiple language support (Java, C++)
3. Output panel
4. User cursors
5. Room listing

**Could Have (Nice to have):**
1. Code templates
2. File upload/download
3. Dark mode
4. Chat feature
5. Version history

**Won't Have (Future versions):**
1. Video/audio calls
2. AI code suggestions
3. Code review workflow
4. Git integration
5. Mobile app

---

**Decision Process:**

**Example: "Should I add video calls?"**
```
Questions:
1. Is it essential for MVP? → No
2. Is it technically complex? → Yes (requires WebRTC)
3. Will users use it? → Maybe (Zoom already exists)
4. Time investment? → 2 weeks

Decision: ❌ Won't Have (use Zoom for now)
```

**Example: "Should I add Monaco Editor?"**
```
Questions:
1. Is it essential for MVP? → No (textarea works)
2. Does it improve UX significantly? → Yes (syntax highlighting)
3. Time investment? → 1 day

Decision: ✅ Should Have
```

---

**Feature Prioritization Matrix:**

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| Authentication | High | Medium | P0 (Must) |
| Real-time sync | High | High | P0 (Must) |
| Code execution | High | High | P0 (Must) |
| Monaco Editor | Medium | Low | P1 (Should) |
| Java support | Medium | Medium | P1 (Should) |
| Dark mode | Low | Low | P2 (Could) |
| Video calls | Low | High | P3 (Won't) |

**Timeline:**
- Week 1-2: Must Have features
- Week 3-4: Should Have features
- Week 5+: Could Have features

*Prioritization ensures I build the most valuable features first."*

---

**FINAL TIPS FOR INTERVIEW:**

**1. Structure Your Answers:**
- Problem → Solution → Outcome
- Use code examples
- Mention metrics (2x faster, 70% reduction)

**2. Show Depth:**
- Don't just say "I used Redis"
- Explain WHY: "I used Redis because it provides in-memory caching with O(1) lookups, reducing database load by 70%"

**3. Be Honest:**
- If you don't know something, say it
- "I haven't implemented that yet, but here's how I would approach it..."

**4. Connect to Concepts:**
- "This uses the Observer pattern"
- "This is similar to how Google Docs works"
- "I applied OOP principles here"

**5. Prepare Stories:**
- Biggest challenge
- Proudest moment
- Bug you fixed
- Something you learned

**6. Practice Out Loud:**
- Record yourself explaining the project
- Aim for 2-3 minute explanations
- Be confident and enthusiastic

**Good luck with your interview! 🚀**
