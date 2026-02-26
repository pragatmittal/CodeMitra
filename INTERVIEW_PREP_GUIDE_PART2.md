# CodeMitra - Interview Prep Guide (Part 2)

## Continued from Part 1...

### 6️⃣ API & BACKEND (Continued)

**Q: How do you handle errors?**

*"I implemented a comprehensive error handling strategy:*

**1. Global Error Handler Middleware**

```javascript
// backend/src/middleware/errorHandler.ts
export const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);
  
  // Determine error type and respond accordingly
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: err.details
    });
  }
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }
  
  if (err.code === 'P2002') {  // Prisma unique constraint
    return res.status(409).json({
      success: false,
      error: 'Resource already exists'
    });
  }
  
  // Default 500 error
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

// Apply to Express app
app.use(errorHandler);
```

---

**2. Try-Catch with Async Handler**

```javascript
// Wrapper to avoid repeating try-catch
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Usage:
app.post('/api/rooms', authenticate, asyncHandler(async (req, res) => {
  const room = await prisma.room.create({ data: req.body });
  res.status(201).json({ success: true, room });
  // Any error automatically caught and passed to errorHandler
}));
```

---

**3. Custom Error Classes**

```javascript
class ValidationError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

// Usage:
if (!user) {
  throw new UnauthorizedError('Invalid credentials');
}
```

---

**4. Input Validation with Joi**

```javascript
import Joi from 'joi';

const roomSchema = Joi.object({
  name: Joi.string().min(3).max(100).required(),
  language: Joi.string().valid('javascript', 'python', 'java', 'cpp').required(),
  visibility: Joi.boolean(),
  password: Joi.string().min(4).when('visibility', {
    is: false,
    then: Joi.required()
  })
});

// Validate before processing
app.post('/api/rooms', authenticate, asyncHandler(async (req, res) => {
  const { error, value } = roomSchema.validate(req.body);
  if (error) {
    throw new ValidationError('Invalid room data', error.details);
  }
  
  const room = await prisma.room.create({ data: value });
  res.status(201).json({ success: true, room });
}));
```

---

**5. Frontend Error Handling**

```javascript
// API client with error handling
async function apiCall(url, options) {
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }
    
    return data;
  } catch (error) {
    // Show user-friendly error
    toast.error(error.message);
    throw error;
  }
}

// Usage:
try {
  const room = await apiCall('/api/rooms', {
    method: 'POST',
    body: JSON.stringify(roomData)
  });
  toast.success('Room created!');
} catch (error) {
  // Error already shown via toast
  console.error(error);
}
```

---

**6. Socket.io Error Handling**

```javascript
// Backend
socket.on('code:execute', async (data) => {
  try {
    const result = await executeCode(data.code, data.language);
    socket.emit('code:execution-result', { success: true, result });
  } catch (error) {
    socket.emit('code:execution-result', {
      success: false,
      error: error.message
    });
  }
});

// Frontend
socket.on('code:execution-result', (data) => {
  if (!data.success) {
    toast.error(`Execution failed: ${data.error}`);
    return;
  }
  displayOutput(data.result);
});
```

---

**7. Error Logging**

```javascript
// Log errors to file/service
import winston from 'winston';

const logger = winston.createLogger({
  level: 'error',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log' }),
    new winston.transports.Console()
  ]
});

// In error handler
logger.error('API Error', {
  message: err.message,
  stack: err.stack,
  url: req.url,
  method: req.method,
  userId: req.user?.id
});
```

*This multi-layer approach catches errors at every level and provides meaningful feedback."*

---

**Q: How is authentication implemented?**

*"I use **JWT (JSON Web Tokens)** for stateless authentication:*

**Authentication Flow:**

**1. User Registration**
```javascript
POST /api/auth/register
  ↓
1. Validate input (email format, password strength)
2. Check if email already exists
3. Hash password with bcrypt
4. Create user in database
5. Generate JWT token
6. Return token + user data
```

**Code:**
```javascript
app.post('/api/auth/register', asyncHandler(async (req, res) => {
  const { email, password, name } = req.body;
  
  // Check existing user
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ValidationError('Email already registered');
  }
  
  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);
  
  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name
    }
  });
  
  // Generate JWT
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  
  res.status(201).json({
    success: true,
    user: { id: user.id, email: user.email, name: user.name },
    token
  });
}));
```

---

**2. User Login**
```javascript
POST /api/auth/login
  ↓
1. Find user by email
2. Compare password with bcrypt
3. Generate JWT token
4. Return token + user data
```

**Code:**
```javascript
app.post('/api/auth/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  
  // Find user
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new UnauthorizedError('Invalid credentials');
  }
  
  // Verify password
  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    throw new UnauthorizedError('Invalid credentials');
  }
  
  // Generate JWT
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  
  res.json({
    success: true,
    user: { id: user.id, email: user.email, name: user.name },
    token
  });
}));
```

---

**3. Protected Routes (Authentication Middleware)**
```javascript
export const authenticate = async (req, res, next) => {
  try {
    // Extract token from header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }
    
    const token = authHeader.substring(7);
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Fetch user
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });
    
    if (!user) {
      throw new UnauthorizedError('User not found');
    }
    
    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired'
      });
    }
    next(error);
  }
};

// Usage:
app.post('/api/rooms', authenticate, asyncHandler(async (req, res) => {
  // req.user is available here
  const room = await prisma.room.create({
    data: { ...req.body, creatorId: req.user.id }
  });
  res.status(201).json({ success: true, room });
}));
```

---

**4. Frontend Token Storage**
```javascript
// Store token in httpOnly cookie (more secure than localStorage)
const login = async (email, password) => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  const data = await response.json();
  
  // Store in cookie
  document.cookie = `token=${data.token}; path=/; max-age=604800; secure; httpOnly`;
  
  // Store in context for immediate use
  setUser(data.user);
  setToken(data.token);
};

// Include token in requests
const createRoom = async (roomData) => {
  const response = await fetch('/api/rooms', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(roomData)
  });
  return response.json();
};
```

---

**5. WebSocket Authentication**
```javascript
// Backend
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('No token provided'));
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });
    
    if (!user) {
      return next(new Error('User not found'));
    }
    
    socket.data.user = user;
    next();
  } catch (error) {
    next(new Error('Authentication failed'));
  }
});

// Frontend
const socket = io('http://localhost:5001', {
  auth: { token: getToken() }
});
```

**JWT Structure:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.  ← Header (Algorithm)
eyJ1c2VySWQiOiJhYmMiLCJlbWFpbCI6Im...  ← Payload (User data)
aKA4lEc_MX4lAXKn37v_-MpDThq74-ehdv6  ← Signature (Tamper-proof)
```

*JWT allows stateless authentication - no session storage needed, perfect for scaling."*

---

**Q: How is authorization handled?**

*"Authorization determines what authenticated users can do:*

**Authorization Strategies:**

**1. Resource Ownership Check**
```javascript
// Only room creator can delete room
app.delete('/api/rooms/:id', authenticate, asyncHandler(async (req, res) => {
  const room = await prisma.room.findUnique({ where: { id: req.params.id } });
  
  if (!room) {
    return res.status(404).json({ success: false, error: 'Room not found' });
  }
  
  // Authorization check
  if (room.creatorId !== req.user.id) {
    return res.status(403).json({
      success: false,
      error: 'Only room creator can delete room'
    });
  }
  
  await prisma.room.delete({ where: { id: req.params.id } });
  res.json({ success: true, message: 'Room deleted' });
}));
```

---

**2. Room Participation Check**
```javascript
// Only room participants can execute code
socket.on('code:execute', async (data) => {
  const { roomId, code, language } = data;
  const userId = socket.data.user.id;
  
  // Check if user is participant
  const participant = await prisma.roomParticipant.findUnique({
    where: { roomId_userId: { roomId, userId } }
  });
  
  if (!participant) {
    return socket.emit('error', {
      message: 'You must join the room first'
    });
  }
  
  // Authorized - proceed with execution
  const result = await executeCode(code, language);
  io.to(roomId).emit('code:execution-result', result);
});
```

---

**3. Private Room Password Check**
```javascript
app.post('/api/rooms/:id/join', authenticate, asyncHandler(async (req, res) => {
  const room = await prisma.room.findUnique({ where: { id: req.params.id } });
  
  if (!room) {
    return res.status(404).json({ success: false, error: 'Room not found' });
  }
  
  // Check if room is private
  if (!room.visibility && room.password) {
    const { password } = req.body;
    
    if (!password) {
      return res.status(401).json({
        success: false,
        error: 'Password required for private room'
      });
    }
    
    const isValid = await bcrypt.compare(password, room.password);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Incorrect password'
      });
    }
  }
  
  // Authorized - add user to room
  await prisma.roomParticipant.create({
    data: { roomId: room.id, userId: req.user.id }
  });
  
  res.json({ success: true, room });
}));
```

---

**4. Capacity Limit Check**
```javascript
app.post('/api/rooms/:id/join', authenticate, asyncHandler(async (req, res) => {
  const room = await prisma.room.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { participants: true } } }
  });
  
  // Check capacity
  if (room._count.participants >= room.maxCapacity) {
    return res.status(403).json({
      success: false,
      error: 'Room is full'
    });
  }
  
  // Authorized - proceed
  // ...
}));
```

---

**5. Role-Based Access Control (RBAC)**

If I had user roles:
```javascript
// User model
enum UserRole {
  ADMIN
  MODERATOR
  USER
}

// Middleware
const requireRole = (roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      error: 'Insufficient permissions'
    });
  }
  next();
};

// Usage:
app.delete('/api/users/:id', 
  authenticate,
  requireRole(['ADMIN']),
  asyncHandler(async (req, res) => {
    // Only admins can delete users
  })
);
```

**Authorization Decision Tree:**
```
1. Is user authenticated? → Check JWT
2. Is user authorized? → Check ownership/participation/role
3. Is action allowed? → Check business rules (capacity, password)
```

*Authorization happens after authentication and verifies permissions for specific actions."*

---

**Q: How are passwords stored securely?**

*"I use **bcrypt** for secure password hashing:*

**1. Password Hashing on Registration**
```javascript
import bcrypt from 'bcryptjs';

// User registers
const password = 'password123';  // Plain text from user

// Hash with salt
const hashedPassword = await bcrypt.hash(password, 10);
// Result: $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy

// Store hash, NOT plain password
await prisma.user.create({
  data: {
    email: 'user@example.com',
    password: hashedPassword  // Stored in database
  }
});
```

**How bcrypt Works:**
```
Input: "password123"
  ↓
Generate random salt (prevents rainbow table attacks)
  ↓
Combine password + salt
  ↓
Hash using bcrypt algorithm (intentionally slow)
  ↓
Output: "$2a$10$salt...hash..."
```

---

**2. Password Verification on Login**
```javascript
// User logs in
const { email, password } = req.body;

// Fetch user from database
const user = await prisma.user.findUnique({ where: { email } });

// Compare plain password with hash
const isValid = await bcrypt.compare(password, user.password);
// bcrypt extracts salt from hash and re-hashes input password

if (!isValid) {
  throw new UnauthorizedError('Invalid credentials');
}

// Password correct - generate JWT
const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET);
```

---

**Why bcrypt?**

✅ **One-way hash**: Can't reverse engineer password from hash
✅ **Salt built-in**: Each password gets unique salt
✅ **Adaptive**: Cost factor can increase over time
✅ **Intentionally slow**: ~100ms per hash (prevents brute force)

**Example Attack Prevention:**
```
❌ Weak approach (MD5):
password123 → md5 → 482c811da5d5b4bc6d497ffa98491e38
Attacker has rainbow table: 482c... = password123
Time to crack: Milliseconds

✅ Strong approach (bcrypt):
password123 → bcrypt → $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92...
Attacker must try millions of combinations
Time to crack: Years (with cost factor 10)
```

---

**3. Cost Factor (Work Factor)**
```javascript
// Cost factor = 10 (default)
// 2^10 = 1024 iterations
await bcrypt.hash(password, 10);  // ~100ms

// Cost factor = 12
// 2^12 = 4096 iterations
await bcrypt.hash(password, 12);  // ~400ms

// Higher cost = more secure but slower
// Choose based on hardware capabilities
```

---

**4. Additional Security Measures**

```javascript
// Validate password strength
const passwordSchema = Joi.string()
  .min(8)
  .max(100)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  .required();

// Requires:
// - At least 8 characters
// - At least one lowercase letter
// - At least one uppercase letter
// - At least one digit
```

---

**5. What I DON'T Do (Security Anti-patterns)**

❌ **Plain text storage**:
```javascript
// NEVER DO THIS!
await prisma.user.create({
  data: { password: 'password123' }  // Visible in database!
});
```

❌ **Weak hashing (MD5, SHA1)**:
```javascript
// NEVER DO THIS!
const hash = crypto.createHash('md5').update(password).digest('hex');
// MD5 is fast → easy to brute force
```

❌ **Password in logs/errors**:
```javascript
// NEVER DO THIS!
console.log('Login attempt:', { email, password });  // Logged!
```

*bcrypt is industry standard for password hashing - used by companies like Google, Facebook."*

---

### 7️⃣ AUTHENTICATION & SECURITY (Continued)

**Q: How do you prevent SQL Injection?**

*"I use **Prisma ORM** which automatically prevents SQL injection through parameterized queries:*

**How SQL Injection Works (Vulnerable Code):**
```javascript
// ❌ VULNERABLE (Raw SQL with string concatenation)
const email = req.body.email;  // Attacker inputs: "' OR '1'='1"

const query = `SELECT * FROM users WHERE email = '${email}'`;
// Becomes: SELECT * FROM users WHERE email = '' OR '1'='1'
// Returns ALL users!

await db.execute(query);
```

**Attack Scenarios:**
```sql
-- Attacker input: admin@example.com' --
SELECT * FROM users WHERE email = 'admin@example.com' --'
-- Everything after -- is comment, password check bypassed!

-- Attacker input: '; DROP TABLE users; --
SELECT * FROM users WHERE email = ''; DROP TABLE users; --'
-- Deletes entire users table!
```

---

**My Solution: Prisma ORM**
```javascript
// ✅ SAFE (Parameterized query)
const email = req.body.email;  // Even if attacker inputs malicious string

const user = await prisma.user.findUnique({
  where: { email }
});

// Prisma generates safe parameterized query:
// SELECT * FROM users WHERE email = $1
// $1 is replaced by database driver, not string concatenation
```

**How Prisma Prevents Injection:**
1. **Parameterized Queries**: Uses placeholders ($1, $2, etc.)
2. **Database Driver Escaping**: Driver handles escaping special characters
3. **Type Safety**: TypeScript ensures correct data types
4. **Query Builder**: No raw SQL string concatenation

---

**Even with Raw Queries:**
```javascript
// If I need raw SQL, Prisma still protects:
const email = req.body.email;

// ✅ SAFE (Parameterized)
await prisma.$queryRaw`
  SELECT * FROM users WHERE email = ${email}
`;
// Prisma automatically parameterizes

// ❌ UNSAFE (Don't use)
await prisma.$queryRawUnsafe(`
  SELECT * FROM users WHERE email = '${email}'
`);
// Only use $queryRawUnsafe for trusted dynamic table/column names
```

---

**Input Validation Layer:**
```javascript
// Additional protection: validate input format
const emailSchema = Joi.string().email().required();

app.post('/api/auth/login', asyncHandler(async (req, res) => {
  // Validate format first
  const { error, value } = emailSchema.validate(req.body.email);
  if (error) {
    throw new ValidationError('Invalid email format');
  }
  
  // Then query with Prisma
  const user = await prisma.user.findUnique({
    where: { email: value }
  });
}));
```

---

**Defense in Depth:**
```
Layer 1: Input Validation (Joi schema)
    ↓
Layer 2: Prisma Parameterization
    ↓
Layer 3: Database Permissions (read-only user for select queries)
    ↓
Layer 4: Rate Limiting (prevent brute force attempts)
```

*Using an ORM like Prisma eliminates 99% of SQL injection risks by default."*

---

**Q: How do you prevent XSS and CSRF attacks?**

*"I use multiple layers of protection:*

**XSS (Cross-Site Scripting) Prevention:**

**1. React Automatic Escaping**
```javascript
// ✅ SAFE - React escapes by default
const userName = "<script>alert('xss')</script>";
return <div>{userName}</div>;

// Rendered as text, not executed:
// &lt;script&gt;alert('xss')&lt;/script&gt;
```

---

**2. Dangerous HTML Warning**
```javascript
// ❌ DANGEROUS - Bypasses escaping
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// ✅ ONLY for trusted content
<div dangerouslySetInnerHTML={{
  __html: sanitizeHtml(trustedMarkdown)
}} />
```

---

**3. Content Security Policy (CSP)**
```javascript
// backend/src/index.ts
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],  // Only allow scripts from our domain
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "http://localhost:5001"]  // Allow API calls
    }
  }
}));
```

**What CSP Does:**
- Blocks inline scripts injected by attackers
- Only allows scripts from whitelisted sources
- Prevents external script loading

---

**4. HTTP Headers**
```javascript
app.use(helmet());  // Sets multiple security headers:

// X-XSS-Protection: 1; mode=block
// Enables browser's built-in XSS filter

// X-Content-Type-Options: nosniff
// Prevents MIME type sniffing

// X-Frame-Options: DENY
// Prevents clickjacking
```

---

**CSRF (Cross-Site Request Forgery) Prevention:**

**1. SameSite Cookies**
```javascript
res.cookie('token', jwt, {
  httpOnly: true,      // JavaScript can't access
  secure: true,        // HTTPS only
  sameSite: 'strict'   // Block cross-origin requests
});
```

**What SameSite Does:**
```
Attacker site: evil.com
<form action="http://codemitra.com/api/rooms/delete" method="POST">
  <input type="hidden" name="roomId" value="123">
</form>

// With sameSite: 'strict', cookie NOT sent
// Request fails due to missing authentication
```

---

**2. CORS Configuration**
```javascript
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true  // Allow cookies
}));

// Only allows requests from our frontend domain
// Blocks requests from evil.com
```

---

**3. Custom Headers**
```javascript
// Require custom header on sensitive operations
app.delete('/api/rooms/:id', authenticate, (req, res) => {
  const customHeader = req.headers['x-requested-with'];
  
  if (customHeader !== 'XMLHttpRequest') {
    return res.status(403).json({ error: 'Invalid request' });
  }
  
  // Proceed with deletion
});

// Frontend includes header:
fetch('/api/rooms/123', {
  method: 'DELETE',
  headers: {
    'X-Requested-With': 'XMLHttpRequest',
    'Authorization': `Bearer ${token}`
  }
});

// Attacker's form can't set custom headers
```

---

**4. Token-Based (JWT) Instead of Session**
```javascript
// Using JWT in Authorization header
// CSRF doesn't work because:
// 1. Attacker's site can't read our JWT
// 2. Attacker's request won't include Authorization header
// 3. Even if they steal token, it's httpOnly cookie

// Traditional session cookies are more vulnerable to CSRF
```

---

**Combined Defense:**
```
XSS Protection:
✅ React auto-escaping
✅ Content Security Policy
✅ HTTP security headers
✅ Input validation

CSRF Protection:
✅ SameSite cookies
✅ CORS restrictions
✅ Custom headers
✅ JWT instead of session cookies
```

*These layers work together to prevent both XSS and CSRF attacks."*

---

**Q: How do you secure sensitive user data?**

*"I implement multiple security layers:*

**1. Encryption at Rest**
```javascript
// Passwords: bcrypt hashed
const hashedPassword = await bcrypt.hash(password, 10);
await prisma.user.create({
  data: { email, password: hashedPassword }
});

// Even if database compromised, passwords are hashed
```

---

**2. Encryption in Transit**
```javascript
// HTTPS for all communication
// nginx configuration:
server {
  listen 443 ssl;
  ssl_certificate /path/to/cert.pem;
  ssl_certificate_key /path/to/key.pem;
  ssl_protocols TLSv1.2 TLSv1.3;
}

// All data encrypted between client and server
```

---

**3. Environment Variables for Secrets**
```javascript
// .env file (never committed to git)
DATABASE_URL=postgresql://user:password@localhost/db
JWT_SECRET=super-secret-key-xyz
REDIS_URL=redis://localhost:6379

// .gitignore
.env
.env.local
.env.production

// Access in code:
const secret = process.env.JWT_SECRET;
```

---

**4. Selective Data Exposure**
```javascript
// ❌ BAD - Returns password hash
const user = await prisma.user.findUnique({ where: { id } });
res.json(user);  // { id, email, password: "$2a$10..." }

// ✅ GOOD - Select only needed fields
const user = await prisma.user.findUnique({
  where: { id },
  select: { id: true, email: true, name: true, avatar: true }
  // Password NOT included
});
res.json(user);  // { id, email, name, avatar }
```

---

**5. Database Security**
```javascript
// Separate database users with limited permissions
// Read-only user for analytics:
DATABASE_ANALYTICS_URL=postgresql://readonly_user:pass@localhost/db

// Read-write user for API:
DATABASE_URL=postgresql://api_user:pass@localhost/db

// Prevent accidental data deletion from analytics queries
```

---

**6. Secrets Management**
```javascript
// Production: Use cloud secrets manager
// AWS Secrets Manager / Azure Key Vault

import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const secret = await secretsManager.send(
  new GetSecretValueCommand({ SecretId: "db-password" })
);

const dbPassword = JSON.parse(secret.SecretString).password;
```

---

**7. Data Minimization**
```javascript
// Only collect necessary data
interface User {
  id: string;
  email: string;     // Required for login
  name: string;      // Required for display
  avatar?: string;   // Optional
  // NOT collecting: phone, address, SSN, etc.
}
```

---

**8. Access Logging**
```javascript
// Log sensitive data access
app.get('/api/users/:id', authenticate, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, email: true, name: true }
  });
  
  // Log access
  logger.info('User data accessed', {
    accessedBy: req.user.id,
    targetUser: req.params.id,
    timestamp: new Date(),
    ip: req.ip
  });
  
  res.json(user);
}));
```

---

**9. Rate Limiting on Sensitive Endpoints**
```javascript
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,  // 5 attempts
  message: 'Too many login attempts'
});

app.post('/api/auth/login', authLimiter, loginHandler);
```

---

**10. Secure File Uploads (if implemented)**
```javascript
// Validate file types
const allowedTypes = ['image/jpeg', 'image/png'];
if (!allowedTypes.includes(file.mimetype)) {
  throw new Error('Invalid file type');
}

// Limit file size
const MAX_SIZE = 5 * 1024 * 1024;  // 5MB
if (file.size > MAX_SIZE) {
  throw new Error('File too large');
}

// Store files outside web root
const uploadPath = '/var/uploads';  // Not publicly accessible
```

**Security Checklist:**
```
✅ Passwords hashed (bcrypt)
✅ HTTPS enabled
✅ Secrets in environment variables
✅ Selective data exposure (Prisma select)
✅ Database user permissions
✅ Access logging
✅ Rate limiting
✅ Input validation
✅ Error messages don't leak info
✅ Regular security audits
```

*Defense in depth - multiple layers ensure even if one fails, others protect."*

---

### 8️⃣ PERFORMANCE & OPTIMIZATION (Continued)

**Q: What are the performance bottlenecks?**

*"I identified and addressed several bottlenecks:*

**1. Database Query Performance**

**Problem:**
```javascript
// Slow room listing (2-3 seconds)
const rooms = await prisma.room.findMany({
  where: { visibility: true }
});
```

**Cause:** Full table scan (no index on visibility column)

**Solution:**
```sql
CREATE INDEX idx_rooms_visibility ON rooms(visibility);
```

**Result:** 100ms response time (20-30x faster)

---

**2. N+1 Query Problem**

**Problem:**
```javascript
// 1 query for rooms + N queries for participants
const rooms = await prisma.room.findMany();  // 1 query

for (const room of rooms) {
  room.participants = await prisma.roomParticipant.findMany({
    where: { roomId: room.id }
  });  // N queries
}
// 100 rooms = 101 queries!
```

**Solution:**
```javascript
// Single query with JOIN
const rooms = await prisma.room.findMany({
  include: { participants: true }
});
// 1 query total!
```

**Result:** 100x faster for 100 rooms

---

**3. Code Execution Queue Bottleneck**

**Problem:** Users wait in queue during peak hours

**Cause:** Single worker, sequential processing

**Solution:**
```javascript
// Scale workers horizontally
const worker = new Worker('code-execution', processJob, {
  concurrency: 5  // Process 5 jobs simultaneously
});

// Deploy multiple worker instances
// 10 workers × 5 concurrency = 50 parallel executions
```

**Result:** 5-10x throughput

---

**4. WebSocket Memory Usage**

**Problem:** High memory usage with many connections

**Cause:** Storing full user object in each socket

**Solution:**
```javascript
// ❌ Before: Store everything
socket.data.user = {
  id: '...',
  email: '...',
  name: '...',
  avatar: '...',
  createdAt: '...',
  updatedAt: '...'
  // ... more fields
};

// ✅ After: Store minimal data
socket.data.user = {
  id: user.id,
  name: user.name
};
// Fetch full data from database/cache when needed
```

**Result:** 70% memory reduction

---

**5. Frontend Bundle Size**

**Problem:** 3MB initial bundle (slow page load)

**Cause:** Loading Monaco Editor on homepage

**Solution:**
```javascript
// Lazy load editor
const MonacoEditor = dynamic(
  () => import('@monaco-editor/react'),
  { ssr: false }  // Don't load on server
);
```

**Result:** 1.5MB reduction, 2x faster initial load

*Identifying bottlenecks requires monitoring - I use console.time(), Prisma query logs, and profiling tools."*

---

**Q: How do you optimize response time?**

*"I use several optimization techniques:*

**1. Database Indexing**
```sql
-- Before: O(n) table scan
SELECT * FROM rooms WHERE visibility = true;

-- After: O(log n) index scan
CREATE INDEX idx_rooms_visibility ON rooms(visibility);
```

**Impact:** 20-100x faster queries

---

**2. Redis Caching**
```javascript
async function getRoom(roomId) {
  // Try cache first
  const cached = await redis.get(`room:${roomId}`);
  if (cached) {
    return JSON.parse(cached);  // ~1ms
  }
  
  // Cache miss - query database
  const room = await prisma.room.findUnique({
    where: { id: roomId }
  });  // ~20ms
  
  // Cache for 5 minutes
  await redis.set(
    `room:${roomId}`,
    JSON.stringify(room),
    'EX',
    300
  );
  
  return room;
}
```

**Impact:** 20x faster for cached data

---

**3. Connection Pooling**
```javascript
// Prisma maintains pool of connections
const prisma = new PrismaClient();

// Reuses existing connections instead of creating new ones
await prisma.room.findMany();
```

**Impact:** 10x faster than creating connection per request

---

**4. Debouncing Network Requests**
```javascript
// Reduce code update frequency
const debouncedUpdate = debounce((code) => {
  socket.emit('code:update', { code });
}, 300);

onChange={(code) => debouncedUpdate(code)}
```

**Impact:** 300x reduction in network traffic

---

**5. Parallel Queries**
```javascript
// ❌ Sequential (slow)
const user = await prisma.user.findUnique({ where: { id } });
const rooms = await prisma.room.findMany({ where: { creatorId: id } });
const executions = await prisma.codeExecution.findMany({ where: { userId: id } });
// Total: 60ms + 40ms + 30ms = 130ms

// ✅ Parallel (fast)
const [user, rooms, executions] = await Promise.all([
  prisma.user.findUnique({ where: { id } }),
  prisma.room.findMany({ where: { creatorId: id } }),
  prisma.codeExecution.findMany({ where: { userId: id } })
]);
// Total: max(60ms, 40ms, 30ms) = 60ms
```

**Impact:** 2x faster

---

**6. CDN for Static Assets**
```javascript
// Serve JS/CSS/images from CDN
<script src="https://cdn.codemitra.com/app.js"></script>

// Benefits:
// - Faster downloads (edge locations)
// - Reduced server load
// - Browser caching
```

**Impact:** 5-10x faster for global users

---

**7. Gzip Compression**
```javascript
import compression from 'compression';
app.use(compression());

// Compresses responses
// 100KB → 20KB (80% reduction)
```

**Impact:** 5x faster transfer

---

**8. Database Query Optimization**
```javascript
// ❌ Select all columns
const users = await prisma.user.findMany();

// ✅ Select only needed columns
const users = await prisma.user.findMany({
  select: { id: true, name: true, avatar: true }
});
```

**Impact:** 3x faster, less memory

**Response Time Breakdown:**
```
Target: < 200ms for API requests

Breakdown:
- Network latency: 20-50ms
- Authentication: 10ms (JWT verify)
- Database query: 20ms (with index + cache)
- Business logic: 10ms
- Response serialization: 5ms
Total: ~65-95ms ✓
```

*Optimization is about finding the slowest part and fixing it first."*

---

**Q: How would your system scale for 1M users?**

*"Here's my detailed scaling plan:*

**Current Capacity (Single Instance):**
- Backend: ~10K concurrent users
- Worker: ~100 executions/minute
- PostgreSQL: ~10K queries/second
- Redis: ~100K ops/second

**Scaling to 1M Users:**

**1. Horizontal Scaling**

**Load Balancer Layer:**
```
Internet
    ↓
AWS Application Load Balancer (ALB)
    ↓
┌──────┬──────┬──────┬──────┐
│ Backend instances (100)   │
└───────────────────────────┘
```

---

**2. Backend Scaling**
```bash
# Kubernetes auto-scaling
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
spec:
  scaleTargetRef:
    name: backend
  minReplicas: 10
  maxReplicas: 200
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70

# Scale based on:
# - CPU usage > 70%
# - Active connections > 8K per instance
# - Response time > 200ms
```

**Capacity:** 100 instances × 10K users = 1M concurrent users

---

**3. Redis Cluster (Pub/Sub for Socket.io)**
```javascript
// Setup Redis Cluster for cross-server communication
import { createAdapter } from '@socket.io/redis-adapter';
import { createCluster } from 'redis';

const pubClient = createCluster({
  rootNodes: [
    { url: 'redis://node1:6379' },
    { url: 'redis://node2:6379' },
    { url: 'redis://node3:6379' }
  ]
});

io.adapter(createAdapter(pubClient, subClient));
```

**Capacity:** Redis cluster handles millions of pub/sub messages/second

---

**4. Database Scaling**

**Read Replicas:**
```
Primary DB (writes)
    ↓
Replicate to 5 Read Replicas
    ↓
Load balance reads across replicas
```

**Connection Pooling:**
```javascript
// PgBouncer for connection pooling
// 100 backend instances × 10 connections = 1000 connections
// PgBouncer pools → 100 actual DB connections

DATABASE_URL=postgresql://user:pass@pgbouncer:6432/db
```

**Sharding (if needed):**
```javascript
// Shard by room ID
function getShardId(roomId) {
  return hashCode(roomId) % NUM_SHARDS;
}

// Room 'abc123' → Shard 2
// Route queries to appropriate shard
```

**Capacity:**
- Primary: 20K writes/second
- Replicas: 50K reads/second each × 5 = 250K reads/second

---

**5. Worker Auto-Scaling**
```bash
# Scale based on queue length
if queueLength > 1000:
  scaleWorkers(from=10, to=100)

# Kubernetes HPA for workers
minReplicas: 10
maxReplicas: 500
targetQueueLength: 50 jobs per worker
```

**Capacity:** 100 workers × 5 concurrency = 500 parallel executions

---

**6. CDN for Static Assets**
```
User requests app.js
    ↓
Served from nearest edge location (Cloudflare/CloudFront)
    ↓
99% requests served from CDN (not backend)
```

**Capacity:** Unlimited (CDN handles it)

---

**7. Caching Strategy**
```javascript
// Multi-tier caching
Browser Cache (1 hour)
    ↓ (miss)
CDN Cache (24 hours)
    ↓ (miss)
Redis Cache (5 minutes)
    ↓ (miss)
PostgreSQL
```

**Cache Hit Ratio:** 80-90% of requests served from cache

---

**8. Geographic Distribution**
```
Regions:
- US East (Virginia)
- US West (California)
- EU (Ireland)
- Asia (Singapore)

User connects to nearest region
Data replicated across regions
```

---

**Infrastructure Cost Estimate (1M Concurrent Users):**

```
100 EC2 instances (t3.medium):     $3,500/month
100 Worker instances (t3.small):   $2,000/month
5 PostgreSQL replicas:             $2,000/month
Redis cluster (3 nodes):           $500/month
Load balancer:                     $50/month
CDN (5TB):                         $500/month
Monitoring (Datadog):              $500/month
────────────────────────────────────────────
Total:                             ~$9,000/month
```

**Per-user cost:** $0.009/month = Less than 1 cent per user

*This architecture can handle 1M users with proper auto-scaling and caching."*

---

**Q: Did you use caching? Where and why?**

*"Yes, I use Redis for caching at multiple levels:*

**1. Room Data Caching**
```javascript
// Hot rooms accessed frequently
async function getRoom(roomId) {
  // L1: Check Redis
  const cached = await redis.get(`room:${roomId}`);
  if (cached) {
    console.log('Cache hit');
    return JSON.parse(cached);  // ~1ms
  }
  
  // L2: Query PostgreSQL
  console.log('Cache miss');
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { participants: true }
  });  // ~20-50ms
  
  // Store in cache
  await redis.set(
    `room:${roomId}`,
    JSON.stringify(room),
    'EX',
    300  // 5 minutes TTL
  );
  
  return room;
}
```

**Why:** Popular rooms accessed hundreds of times → 20-50x speedup

---

**2. User Session Caching**
```javascript
// Cache user data after authentication
socket.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  const decoded = jwt.verify(token, secret);
  
  // Check cache first
  let user = await redis.get(`user:${decoded.userId}`);
  
  if (!user) {
    // Cache miss - query database
    user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });
    await redis.set(
      `user:${decoded.userId}`,
      JSON.stringify(user),
      'EX',
      3600  // 1 hour
    );
  } else {
    user = JSON.parse(user);
  }
  
  socket.data.user = user;
  next();
});
```

**Why:** Same user connects multiple times → avoid database query each time

---

**3. Code Execution Results Caching**
```javascript
// Cache execution results
const resultKey = `execution-result:${executionId}`;
await redis.set(resultKey, JSON.stringify(result), 'EX', 300);

// Backend polls for result
const cached = await redis.get(resultKey);
if (cached) {
  return JSON.parse(cached);
}
```

**Why:** Worker stores result, Backend retrieves → temporary storage

---

**4. Room List Caching**
```javascript
// Cache paginated room listings
async function listRooms(page, language) {
  const cacheKey = `rooms:${language}:page${page}`;
  
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  
  const rooms = await prisma.room.findMany({
    where: { language, visibility: true },
    skip: (page - 1) * 20,
    take: 20,
    orderBy: { lastActivity: 'desc' }
  });
  
  await redis.set(cacheKey, JSON.stringify(rooms), 'EX', 60);
  return rooms;
}
```

**Why:** Room listings don't change often → cache for 1 minute

---

**5. Rate Limiting (Counter Cache)**
```javascript
// Track API requests
const key = `rate-limit:${userId}:${endpoint}`;
const count = await redis.incr(key);

if (count === 1) {
  await redis.expire(key, 900);  // 15 minutes
}

if (count > 100) {
  throw new Error('Rate limit exceeded');
}
```

**Why:** Fast in-memory counter, automatic expiration

---

**6. Cache Invalidation**
```javascript
// Invalidate when data changes
socket.on('code:update', async (data) => {
  // Update database
  await prisma.room.update({
    where: { id: roomId },
    data: { code, updatedAt: new Date() }
  });
  
  // Invalidate cache
  await redis.del(`room:${roomId}`);
  
  // Broadcast update
  io.to(roomId).emit('code:updated', { code });
});
```

**Why:** Ensure cache doesn't serve stale data

---

**7. Browser Caching**
```javascript
// Set cache headers
app.use('/static', express.static('public', {
  maxAge: '1d',  // Cache for 1 day
  immutable: true
}));

// Response headers:
// Cache-Control: public, max-age=86400, immutable
```

**Why:** Reduce server load, faster page loads

---

**Cache Strategy Summary:**

| Data Type | TTL | Why |
|-----------|-----|-----|
| Room data | 5 min | Changes frequently |
| User sessions | 1 hour | Relatively static |
| Execution results | 5 min | Temporary storage |
| Room listings | 1 min | Frequently accessed |
| Static assets | 1 day | Never changes |

**Cache Hit Ratio:** ~70-80% (most requests served from cache)

*Caching is the #1 performance optimization - reduces database load by 70%."*

---

### 9️⃣ TESTING & DEBUGGING

**Q: How did you test your project?**

*"I implemented multiple testing levels:*

**1. Unit Tests (Jest)**
```javascript
// backend/src/utils/__tests__/password.test.ts
import { hashPassword, comparePassword } from '../password';

describe('Password Hashing', () => {
  it('should hash password', async () => {
    const password = 'test123';
    const hash = await hashPassword(password);
    
    expect(hash).not.toBe(password);
    expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);  // bcrypt format
  });
  
  it('should verify correct password', async () => {
    const password = 'test123';
    const hash = await hashPassword(password);
    const isValid = await comparePassword(password, hash);
    
    expect(isValid).toBe(true);
  });
  
  it('should reject incorrect password', async () => {
    const hash = await hashPassword('test123');
    const isValid = await comparePassword('wrong', hash);
    
    expect(isValid).toBe(false);
  });
});
```

---

**2. Integration Tests**
```javascript
// backend/src/routes/__tests__/auth.test.ts
import request from 'supertest';
import { app } from '../index';

describe('POST /api/auth/register', () => {
  it('should register new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      });
    
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.user).toHaveProperty('id');
    expect(res.body.token).toBeDefined();
  });
  
  it('should reject duplicate email', async () => {
    // Create first user
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'test123', name: 'User 1' });
    
    // Try to create duplicate
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'test123', name: 'User 2' });
    
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('already exists');
  });
});
```

---

**3. End-to-End Tests (Puppeteer)**
```javascript
// automated-test-suite.js
import puppeteer from 'puppeteer';

describe('Collaborative Editing E2E', () => {
  let browser1, browser2, page1, page2;
  
  beforeAll(async () => {
    browser1 = await puppeteer.launch();
    browser2 = await puppeteer.launch();
    page1 = await browser1.newPage();
    page2 = await browser2.newPage();
  });
  
  it('should sync code between two users', async () => {
    // User 1 creates room
    await page1.goto('http://localhost:3000');
    await page1.click('[data-testid="create-room"]');
    await page1.type('[data-testid="room-name"]', 'Test Room');
    await page1.click('[data-testid="submit"]');
    
    const roomUrl = await page1.url();
    const roomId = roomUrl.split('/').pop();
    
    // User 2 joins room
    await page2.goto(`http://localhost:3000/room/${roomId}/editor`);
    
    // User 1 types code
    await page1.type('[data-testid="editor"]', 'console.log("Hello");');
    
    // Wait for sync
    await page2.waitForTimeout(1000);
    
    // Verify User 2 sees the code
    const code = await page2.$eval('[data-testid="editor"]', el => el.textContent);
    expect(code).toContain('console.log("Hello")');
  });
});
```

---

**4. Load Tests (k6)**
```javascript
// load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 100 },   // Ramp up to 100 users
    { duration: '3m', target: 100 },   // Stay at 100 users
    { duration: '1m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests < 500ms
    http_req_failed: ['rate<0.01'],    // Error rate < 1%
  },
};

export default function () {
  // Login
  const loginRes = http.post('http://localhost:5001/api/auth/login', {
    email: 'test@example.com',
    password: 'password123'
  });
  
  check(loginRes, {
    'login successful': (r) => r.status === 200,
    'token received': (r) => r.json('token') !== null,
  });
  
  const token = loginRes.json('token');
  
  // Create room
  const roomRes = http.post('http://localhost:5001/api/rooms', {
    name: 'Load Test Room',
    language: 'javascript'
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  check(roomRes, {
    'room created': (r) => r.status === 201,
  });
  
  sleep(1);
}
```

Run: `k6 run load-test.js`

---

**5. Manual Testing Checklist**
```
Authentication:
✅ Register with valid data
✅ Register with duplicate email
✅ Login with correct credentials
✅ Login with wrong password
✅ Access protected route without token

Room Management:
✅ Create public room
✅ Create private room with password
✅ Join public room
✅ Join private room with correct password
✅ Join private room with wrong password
✅ Leave room
✅ Delete room (as creator)
✅ Delete room (as non-creator - should fail)

Collaborative Editing:
✅ Two users type simultaneously
✅ Code syncs in real-time
✅ Cursor positions visible
✅ User joins and sees existing code
✅ User leaves and others notified

Code Execution:
✅ Execute JavaScript code
✅ Execute Python code
✅ Execute Java code
✅ Execute C++ code
✅ Handle compilation errors
✅ Handle runtime errors
✅ Handle timeouts
✅ See output in all user sessions
```

---

**Test Coverage:**
- Backend: ~70% line coverage
- Frontend: ~50% component coverage
- E2E: Critical user flows covered

*Testing at multiple levels catches bugs early and ensures reliability."*

---

**Q: What types of testing did you perform?**

*"I performed 5 types of testing:*

**1. Unit Testing**
- **What**: Test individual functions in isolation
- **Tools**: Jest, Testing Library
- **Coverage**: Password hashing, JWT generation, validation functions
- **Example**: Test that `hashPassword()` produces valid bcrypt hash

---

**2. Integration Testing**
- **What**: Test API endpoints with database
- **Tools**: Supertest, Jest
- **Coverage**: All REST APIs (auth, rooms, users)
- **Example**: Test that POST /api/rooms creates room in database

---

**3. End-to-End (E2E) Testing**
- **What**: Test full user flows in browser
- **Tools**: Puppeteer
- **Coverage**: Critical paths (registration, room creation, collaboration)
- **Example**: Test two browsers collaboratively editing code

---

**4. Load Testing**
- **What**: Test system under high traffic
- **Tools**: k6, Apache JMeter
- **Coverage**: API endpoints, WebSocket connections
- **Example**: Simulate 1000 concurrent users creating rooms

---

**5. Manual Testing**
- **What**: Human verification of features
- **Tools**: Browser DevTools, Postman
- **Coverage**: UI/UX, edge cases, cross-browser compatibility
- **Example**: Test on Chrome, Firefox, Safari

**Test Pyramid:**
```
       /\
      /E2E\      (Few tests, slow, comprehensive)
     /______\
    /Integration\
   /_____________\
  /    Unit       \  (Many tests, fast, focused)
 /_________________\
```

*Each level serves a purpose - unit for speed, integration for confidence, E2E for user perspective."*

---

**Q: How do you debug production issues?**

*"I use multiple debugging strategies:*

**1. Logging**
```javascript
// Structured logging with Winston
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// Log with context
logger.error('Room creation failed', {
  userId: user.id,
  roomData,
  error: error.message,
  stack: error.stack,
  timestamp: new Date().toISOString()
});
```

---

**2. Error Tracking (Sentry)**
```javascript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});

// Automatic error capture
app.use(Sentry.Handlers.errorHandler());

// Manual error capture
try {
  await executeCode(code, language);
} catch (error) {
  Sentry.captureException(error, {
    tags: { component: 'code-execution' },
    extra: { code, language, userId }
  });
  throw error;
}
```

---

**3. Monitoring (Prometheus + Grafana)**
```javascript
// Expose metrics endpoint
import prometheus from 'prom-client';

const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'route', 'status']
});

app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    end({ method: req.method, route: req.route?.path, status: res.statusCode });
  });
  next();
});

app.get('/metrics', (req, res) => {
  res.set('Content-Type', prometheus.register.contentType);
  res.end(prometheus.register.metrics());
});
```

---

**4. Health Checks**
```javascript
app.get('/healthz', async (req, res) => {
  try {
    // Check database
    await prisma.$queryRaw`SELECT 1`;
    
    // Check Redis
    await redis.ping();
    
    // Check worker queue
    const queueHealth = await queue.getJobCounts();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'ok',
        redis: 'ok',
        queue: `${queueHealth.waiting} jobs waiting`
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});
```

---

**5. Remote Debugging**
```bash
# Connect to production logs
kubectl logs -f deployment/backend --tail=100

# Execute commands in container
kubectl exec -it backend-pod -- /bin/sh

# Check database queries
kubectl exec -it postgres-pod -- psql -U user -d codemitra
SELECT * FROM rooms ORDER BY created_at DESC LIMIT 10;

# Check Redis keys
kubectl exec -it redis-pod -- redis-cli
KEYS *
GET room:abc123
```

---

**6. Database Query Logging**
```javascript
// Enable Prisma query logging
const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
});

// Logs show:
// Query: SELECT * FROM users WHERE id = $1
// Params: ['abc123']
// Duration: 23ms
```

---

**7. Replay Production Issues Locally**
```javascript
// Capture problematic data
logger.error('Code execution failed', {
  code: data.code,
  language: data.language,
  input: data.input
});

// Reproduce locally
const testData = {
  code: `/* from logs */`,
  language: 'javascript',
  input: ''
};

const result = await executeCode(testData.code, testData.language);
console.log(result);
```

---

**8. APM (Application Performance Monitoring)**
```javascript
// New Relic / Datadog integration
import newrelic from 'newrelic';

app.get('/api/rooms/:id', async (req, res) => {
  newrelic.startSegment('getRoom', true, async () => {
    const room = await prisma.room.findUnique({ where: { id: req.params.id } });
    res.json(room);
  });
});
```

**Debugging Checklist:**
```
1. Check logs (Winston, CloudWatch)
2. Check error tracking (Sentry)
3. Check metrics (Grafana)
4. Check health endpoints
5. Verify database state
6. Verify Redis cache
7. Check recent deployments
8. Reproduce locally
```

*Good logging and monitoring make debugging 10x faster."*

---

[Character limit - See INTERVIEW_PREP_GUIDE_PART3.md for remaining sections]
