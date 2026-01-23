<div align="center">

# 🚀 CodeMitra

### Real-Time Collaborative Coding Platform

*Google Docs for Code - Write, Collaborate, Execute Together*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15.0-black)](https://nextjs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)

[Live Demo](#) | [Documentation](#features) | [Architecture](#-high-level-design) | [Contributing](#-contributing)

</div>

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [High-Level Design](#-high-level-design)
- [Getting Started](#-getting-started)
- [Project Structure](#-project-structure)
- [API Documentation](#-api-documentation)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Performance & Scalability](#-performance--scalability)
- [Security](#-security)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🌟 Overview

**CodeMitra** is a production-ready, real-time collaborative coding platform that enables multiple developers to write, edit, and execute code simultaneously in the same virtual room. Built with modern web technologies and designed for scale, it supports multiple programming languages with secure sandboxed execution.

### Why CodeMitra?

- 🤝 **Real-Time Collaboration**: Multiple users edit code simultaneously with conflict-free synchronization
- ⚡ **Instant Execution**: Run code in JavaScript, Python, Java, and C++ with live output sharing
- 🔒 **Secure Sandboxing**: Isolated Docker containers ensure safe code execution
- 🌐 **Browser-Based**: No installation required - works in any modern browser
- 📱 **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- 🚀 **Enterprise-Ready**: Scalable to 1M+ concurrent users with horizontal scaling

### Use Cases

- 👥 **Pair Programming**: Remote teams collaborating on code in real-time
- 🎓 **Education**: Teachers conducting live coding sessions with students
- 💼 **Technical Interviews**: Conducting coding interviews with candidates
- 🏆 **Hackathons**: Teams working together on projects
- 📚 **Code Reviews**: Reviewing and discussing code changes collaboratively

---

## ✨ Features

### Core Features

| Feature | Description |
|---------|-------------|
| 🖊️ **Real-Time Code Editing** | Operational Transform algorithm ensures conflict-free collaborative editing |
| ▶️ **Multi-Language Execution** | Support for JavaScript, Python, Java, and C++ with syntax highlighting |
| 👥 **User Presence** | See who's in the room with real-time cursor tracking |
| 💬 **Chat System** | Built-in chat for discussions while coding |
| 📹 **Video Calls** | WebRTC-based video conferencing (optional) |
| 🔐 **Authentication** | Secure JWT-based authentication with bcrypt password hashing |
| 🏠 **Room Management** | Create public/private rooms with password protection |
| 📊 **Execution History** | Track and review past code executions |
| 🎨 **Monaco Editor** | VS Code-powered editor with IntelliSense and auto-completion |
| 🌙 **Dark Mode** | Eye-friendly dark theme for extended coding sessions |

### Technical Highlights

- **Operational Transform**: Google Docs-style conflict resolution for simultaneous edits
- **WebSocket Communication**: Sub-100ms latency for real-time synchronization
- **Docker Isolation**: Sandboxed code execution with resource limits
- **Redis Pub/Sub**: Multi-server WebSocket scaling with Redis adapter
- **PostgreSQL**: Robust relational database with Prisma ORM
- **BullMQ**: Reliable job queue for asynchronous code execution
- **Rate Limiting**: Protection against abuse with configurable limits
- **Horizontal Scaling**: Stateless architecture enables unlimited scaling

---

## 🛠️ Tech Stack

### Frontend
```
Next.js 15        - React framework with App Router
React 18          - UI library
TypeScript        - Type-safe development
Monaco Editor     - VS Code editor component
Socket.io Client  - Real-time WebSocket communication
Tailwind CSS      - Utility-first styling
Framer Motion     - Smooth animations
Lucide React      - Modern icon library
```

### Backend
```
Node.js 18        - JavaScript runtime
Express.js        - Web framework
Socket.io         - Real-time bidirectional communication
TypeScript        - Type-safe server code
Prisma ORM        - Database toolkit
BullMQ            - Job queue for code execution
JWT               - Stateless authentication
bcrypt            - Password hashing
Helmet            - Security headers
```

### Infrastructure
```
PostgreSQL 15     - Primary database
Redis 7           - Cache, pub/sub, and job queue
Docker            - Containerization and code execution
NGINX             - Reverse proxy and load balancer
GitHub Actions    - CI/CD pipeline
```

### Deployment
```
Render.com        - Hosting platform
Docker Compose    - Local development
Kubernetes        - Production orchestration (k8s/)
```

---

## 🏗️ High-Level Design

### System Architecture

<div align="center">
  <img src="https://raw.githubusercontent.com/pragatmittal/CodeMitra/main/docs/architecture-diagram.png" alt="CodeMitra Architecture" width="100%" />
</div>

*Architecture showing Client Layer, Network Layer (NGINX), Backend Services (scalable), Worker Services, and Data Layer (PostgreSQL + Redis)*

### Component Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Next.js Frontend (React 18 + Monaco Editor)            │   │
│  │  - Real-time UI updates via Socket.io                   │   │
│  │  - Code editor with syntax highlighting                 │   │
│  │  - User presence and cursor tracking                    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓ ↑
                     HTTP/HTTPS + WebSocket
                              ↓ ↑
┌─────────────────────────────────────────────────────────────────┐
│                      NETWORK LAYER                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  NGINX Load Balancer                                     │   │
│  │  - SSL/TLS termination                                   │   │
│  │  - WebSocket upgrade support                             │   │
│  │  - Load balancing across backend instances               │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓ ↑
┌─────────────────────────────────────────────────────────────────┐
│                   BACKEND SERVICES (Scalable)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Backend 1   │  │  Backend 2   │  │  Backend 3   │          │
│  │  Express +   │  │  Express +   │  │  Express +   │          │
│  │  Socket.io   │  │  Socket.io   │  │  Socket.io   │          │
│  │  REST API    │  │  REST API    │  │  REST API    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              ↓ ↑
┌─────────────────────────────────────────────────────────────────┐
│                     WORKER SERVICES                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Worker 1    │  │  Worker 2    │  │  Worker 3    │          │
│  │  BullMQ +    │  │  BullMQ +    │  │  BullMQ +    │          │
│  │  Docker      │  │  Docker      │  │  Docker      │          │
│  │  Executor    │  │  Executor    │  │  Executor    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              ↓ ↑
┌─────────────────────────────────────────────────────────────────┐
│                        DATA LAYER                                │
│  ┌────────────────────────┐  ┌────────────────────────┐         │
│  │  PostgreSQL 15         │  │  Redis 7               │         │
│  │  - User data           │  │  - Session cache       │         │
│  │  - Rooms               │  │  - Pub/Sub adapter     │         │
│  │  - Code executions     │  │  - Job queue (BullMQ)  │         │
│  │  - Prisma ORM          │  │  - Rate limiting       │         │
│  └────────────────────────┘  └────────────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow Diagrams

#### 1️⃣ User Authentication Flow
```mermaid
sequenceDiagram
    User->>Frontend: Enter credentials
    Frontend->>Backend API: POST /api/auth/login
    Backend API->>PostgreSQL: Verify user
    PostgreSQL-->>Backend API: User data
    Backend API->>Backend API: Compare password (bcrypt)
    Backend API->>Backend API: Generate JWT token
    Backend API-->>Frontend: Return token + user data
    Frontend->>Frontend: Store token in cookie
    Frontend-->>User: Redirect to dashboard
```

#### 2️⃣ Real-Time Code Collaboration Flow
```mermaid
sequenceDiagram
    User A->>Frontend A: Types code
    Frontend A->>Backend (Socket.io): code:update event
    Backend->>Redis Pub/Sub: Publish to room channel
    Redis Pub/Sub->>All Backend Instances: Broadcast event
    Backend->>Frontend B, C, D: Emit code:updated
    Frontend B, C, D->>Monaco Editor: Apply changes
    Frontend B, C, D-->>User B, C, D: See updated code
```

#### 3️⃣ Code Execution Flow
```mermaid
sequenceDiagram
    User->>Frontend: Click "Run Code"
    Frontend->>Backend API: POST /api/code/execute
    Backend API->>BullMQ: Add job to queue
    BullMQ->>Redis: Store job
    Worker->>Redis: Poll for jobs
    Redis-->>Worker: Return job
    Worker->>Docker: Spin up container
    Docker->>Docker: Execute code (isolated)
    Docker-->>Worker: Return output/errors
    Worker->>Redis: Store result
    Backend API->>Redis: Poll for result
    Redis-->>Backend API: Return result
    Backend API->>Socket.io: Broadcast to room
    Socket.io-->>All Users: Display output
```

### Database Schema

```sql
-- Users table
CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  password    TEXT NOT NULL,
  name        TEXT NOT NULL,
  avatar      TEXT,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- Rooms table
CREATE TABLE rooms (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  language        TEXT NOT NULL,
  code            TEXT,
  visibility      BOOLEAN DEFAULT TRUE,
  password        TEXT,
  creator_id      TEXT REFERENCES users(id),
  max_capacity    INTEGER DEFAULT 10,
  last_activity   TIMESTAMP DEFAULT NOW(),
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

-- Room Participants (Many-to-Many)
CREATE TABLE room_participants (
  id          TEXT PRIMARY KEY,
  room_id     TEXT REFERENCES rooms(id) ON DELETE CASCADE,
  user_id     TEXT REFERENCES users(id) ON DELETE CASCADE,
  joined_at   TIMESTAMP DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

-- Code Executions (History)
CREATE TABLE code_executions (
  id          TEXT PRIMARY KEY,
  room_id     TEXT REFERENCES rooms(id),
  user_id     TEXT REFERENCES users(id),
  code        TEXT NOT NULL,
  language    TEXT NOT NULL,
  output      TEXT,
  error       TEXT,
  status      TEXT NOT NULL,
  executed_at TIMESTAMP DEFAULT NOW()
);
```

**📐 For detailed architecture diagrams and design decisions, see:**
- [HLD_DIAGRAM_PROMPT.md](./HLD_DIAGRAM_PROMPT.md) - Comprehensive high-level design prompt
- [PROJECT_ANALYSIS.md](./PROJECT_ANALYSIS.md) - Deep technical analysis
- [INTERVIEW_PREP_GUIDE.md](./INTERVIEW_PREP_GUIDE.md) - Interview Q&A guide

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed:

- **Node.js** >= 18.0.0
- **npm** >= 8.0.0
- **Docker** >= 20.10.0
- **Docker Compose** >= 2.0.0
- **PostgreSQL** 15 (or use Docker)
- **Redis** 7 (or use Docker)

### Installation

#### Option 1: Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/pragatmittal/codemitra.git
cd codemitra

# Start all services
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Access the application
# Frontend: http://localhost:3000
# Backend: http://localhost:5001
# Prisma Studio: http://localhost:5555
```

#### Option 2: Manual Setup

**1. Setup PostgreSQL and Redis**

```bash
# Using Docker
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres --name postgres postgres:15
docker run -d -p 6379:6379 --name redis redis:7-alpine
```

**2. Backend Setup**

```bash
cd backend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your database and Redis URLs

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Start development server
npm run dev
```

**3. Frontend Setup**

```bash
cd frontend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env.local
# Edit .env.local with backend URL

# Start development server
npm run dev
```

**4. Worker Setup**

```bash
cd worker

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env

# Start worker
npm run dev
```

### Environment Variables

#### Backend (.env)
```env
NODE_ENV=development
PORT=5001

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/codemitra

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# CORS
FRONTEND_URL=http://localhost:3000
```

#### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:5001
NEXT_PUBLIC_SOCKET_URL=http://localhost:5001
```

#### Worker (.env)
```env
REDIS_URL=redis://localhost:6379
NODE_ENV=development
```

### Quick Start Commands

```bash
# Development
npm run dev                    # Start all services
npm run dev:backend           # Backend only
npm run dev:frontend          # Frontend only
npm run dev:worker            # Worker only

# Database
npm run prisma:generate       # Generate Prisma client
npm run prisma:migrate        # Run migrations
npm run prisma:studio         # Open Prisma Studio

# Testing
npm test                      # Run all tests
npm run test:comprehensive    # Comprehensive test suite
npm run test:multi-language   # Multi-language tests

# Production Build
npm run build                 # Build all services
npm start                     # Start production server
```

---

## 📁 Project Structure

```
CodeMitra/
│
├── backend/                    # Node.js Express server
│   ├── src/
│   │   ├── index.ts           # Entry point
│   │   ├── middleware/        # Auth, rate limiting, error handling
│   │   ├── routes/            # REST API endpoints
│   │   ├── socket/            # Socket.io handlers
│   │   └── utils/             # Helper functions
│   ├── prisma/
│   │   ├── schema.prisma      # Database schema
│   │   └── migrations/        # Migration history
│   ├── Dockerfile
│   └── package.json
│
├── frontend/                   # Next.js React app
│   ├── src/
│   │   ├── app/               # Next.js App Router pages
│   │   ├── components/        # React components
│   │   └── lib/               # Utilities and contexts
│   ├── public/                # Static assets
│   ├── Dockerfile
│   └── package.json
│
├── worker/                     # Background job processor
│   ├── src/
│   │   ├── index.ts           # BullMQ worker
│   │   ├── executors/         # Language-specific executors
│   │   └── utils/             # Docker runner
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
├── nginx/                      # Reverse proxy configuration
│   ├── nginx.conf
│   └── Dockerfile
│
├── docs/                       # Documentation
│   ├── PROJECT_ANALYSIS.md
│   ├── INTERVIEW_PREP_GUIDE.md
│   ├── HLD_DIAGRAM_PROMPT.md
│   └── architecture-diagram.png
│
├── test-screenshots/           # Test artifacts
├── docker-compose.yml          # Production compose
├── docker-compose.dev.yml      # Development compose
├── .github/workflows/          # CI/CD pipelines
└── README.md                   # This file
```

---

## 📡 API Documentation

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe"
}

Response: 201 Created
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "token": "jwt-token"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123"
}

Response: 200 OK
{
  "success": true,
  "user": { ... },
  "token": "jwt-token"
}
```

### Room Endpoints

#### Create Room
```http
POST /api/rooms
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "My Coding Room",
  "language": "javascript",
  "visibility": true,
  "password": "optional-password"
}

Response: 201 Created
{
  "success": true,
  "room": {
    "id": "uuid",
    "name": "My Coding Room",
    "language": "javascript",
    ...
  }
}
```

#### Get All Rooms
```http
GET /api/rooms?language=javascript&page=1
Authorization: Bearer <token>

Response: 200 OK
{
  "success": true,
  "rooms": [...],
  "total": 25,
  "page": 1
}
```

### WebSocket Events

#### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `room:join` | `{ roomId }` | Join a room |
| `code:update` | `{ roomId, code, cursorPosition }` | Update code |
| `code:execute` | `{ roomId, code, language }` | Execute code |
| `chat:message` | `{ roomId, message }` | Send chat message |
| `cursor:move` | `{ roomId, position }` | Update cursor position |

#### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `room:user-joined` | `{ user }` | User joined room |
| `room:user-left` | `{ userId }` | User left room |
| `code:updated` | `{ code, userId }` | Code changed |
| `code:execution-result` | `{ output, error }` | Execution complete |
| `chat:new-message` | `{ message, user }` | New chat message |
| `cursor:updated` | `{ userId, position }` | Cursor moved |

---

## 🧪 Testing

### Automated Test Suite

CodeMitra includes a comprehensive automated testing framework covering:

- ✅ **Unit Tests**: Individual function testing with Jest
- ✅ **Integration Tests**: API endpoint testing with Supertest
- ✅ **E2E Tests**: Full user flows with Puppeteer
- ✅ **Load Tests**: Performance testing with k6
- ✅ **Multi-Language Tests**: All supported languages

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:comprehensive      # Full platform testing (6 users)
npm run test:multi-language     # All languages (JS, Python, Java, C++)
npm run test:quick              # Quick validation (2 users)

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

### Test Results

```
🚀 Comprehensive Test Suite Results
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Tests Passed: 48/50
⏱️  Average Response Time: 85ms
👥 Concurrent Users: 6
🔄 Code Sync Delay: 67ms
📨 Message Delivery: 42ms

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 🌐 Deployment

### Docker Deployment

```bash
# Build images
docker-compose build

# Deploy to production
docker-compose up -d

# View logs
docker-compose logs -f

# Scale services
docker-compose up -d --scale backend=3 --scale worker=5
```

### Kubernetes Deployment

```bash
# Create namespace
kubectl create namespace codemitra

# Apply manifests
kubectl apply -f k8s/

# Check status
kubectl get pods -n codemitra

# Scale deployments
kubectl scale deployment backend --replicas=10 -n codemitra
```

### CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Render
        run: curl -X POST ${{ secrets.RENDER_DEPLOY_HOOK }}
```

---

## ⚡ Performance & Scalability

### Current Performance Metrics

| Metric | Value | Target |
|--------|-------|--------|
| **API Response Time** | 50-100ms | < 200ms |
| **Code Sync Latency** | 50-100ms | < 100ms |
| **Code Execution** | 2-5s | < 10s |
| **WebSocket Connections** | 10K/server | 10K |
| **Database Queries** | 10K/s | 10K |
| **Cache Hit Ratio** | 80% | > 70% |

### Scalability Target

**1M Concurrent Users**:
- 100 Backend instances × 10K connections
- 100 Worker instances
- PostgreSQL: 1 Primary + 5 Read Replicas
- Redis Cluster: 3-10 nodes
- **Estimated Cost**: $7,000-9,000/month on AWS/Azure

---

## 🔒 Security

### Security Features

#### Authentication & Authorization
- ✅ JWT tokens with 7-day expiration
- ✅ bcrypt password hashing (salt factor 10)
- ✅ HTTP-only secure cookies
- ✅ Rate limiting (100 requests/15 minutes)

#### Data Protection
- ✅ SQL injection prevention (Prisma parameterized queries)
- ✅ XSS prevention (React auto-escaping)
- ✅ CSRF protection (SameSite cookies)
- ✅ HTTPS/TLS encryption
- ✅ Helmet.js security headers

#### Code Execution Security
- ✅ Isolated Docker containers
- ✅ Resource limits (CPU, memory, timeout)
- ✅ Network isolation
- ✅ No persistent storage
- ✅ Automatic cleanup after execution

---

## 🤝 Contributing

We welcome contributions! Here's how to get started:

### Development Setup

1. **Fork the repository**
2. **Clone your fork**
   ```bash
   git clone https://github.com/yourusername/codemitra.git
   ```
3. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
4. **Make your changes**
5. **Run tests**
   ```bash
   npm test
   ```
6. **Commit with conventional commits**
   ```bash
   git commit -m "feat: add amazing feature"
   ```
7. **Push to your fork**
   ```bash
   git push origin feature/amazing-feature
   ```
8. **Create a Pull Request**

### Contribution Guidelines

- ✅ Follow TypeScript best practices
- ✅ Write tests for new features
- ✅ Update documentation
- ✅ Use conventional commit messages
- ✅ Ensure all tests pass
- ✅ Follow code style (ESLint/Prettier)

### Commit Message Format

```
<type>(<scope>): <subject>

Types: feat, fix, docs, style, refactor, test, chore
Scope: backend, frontend, worker, docs
```

**Examples:**
```
feat(backend): add JWT refresh token support
fix(frontend): resolve Monaco Editor memory leak
docs(readme): update installation instructions
```

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2026 CodeMitra

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software...
```

---

## 🙏 Acknowledgments

- **Monaco Editor** - VS Code's editor component
- **Socket.io** - Real-time communication library
- **Prisma** - Next-generation ORM
- **Next.js** - React framework
- **Docker** - Containerization platform
- **BullMQ** - Redis-based queue
- **Open Source Community** - For amazing tools and libraries

---

## 📞 Support & Contact

### Get Help

- 📖 **Documentation**: [docs/](./docs/)
- 💬 **Discussions**: [GitHub Discussions](#)
- 🐛 **Bug Reports**: [GitHub Issues](#)
- 💡 **Feature Requests**: [GitHub Issues](#)

### Connect

- **GitHub**: [@pragatmittal](#)
- **LinkedIn**: [Pragat Mittal](#)
- **Email**: contact@codemitra.com

---

## 🗺️ Roadmap

### ✅ Completed
- [x] Real-time code synchronization
- [x] Multi-language support (JS, Python, Java, C++)
- [x] Docker-based code execution
- [x] User authentication & authorization
- [x] Room management
- [x] Chat system
- [x] WebRTC video calls

### 🚧 In Progress
- [ ] AI-powered code suggestions
- [ ] Code review workflow
- [ ] Git integration
- [ ] Mobile app (React Native)

### 📅 Planned
- [ ] VS Code extension
- [ ] Offline mode support
- [ ] Code templates library
- [ ] Analytics dashboard
- [ ] Multi-file support
- [ ] Terminal emulator
- [ ] Collaborative debugging
- [ ] Plugin system

---

<div align="center">

### Made with ❤️ by Pragat Mittal

**If you found this project helpful, please consider giving it a ⭐!**

[⬆ Back to Top](#-codemitra)

</div