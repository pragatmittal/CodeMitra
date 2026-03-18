"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = exports.app = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_1 = require("./routes/auth");
const users_1 = require("./routes/users");
const rooms_1 = require("./routes/rooms");
const code_1 = require("./routes/code");
const migrate_1 = require("./routes/migrate");
const errorHandler_1 = require("./middleware/errorHandler");
const socket_1 = require("./socket");
const prisma_1 = require("./utils/prisma");
dotenv_1.default.config();
const app = (0, express_1.default)();
exports.app = app;
const server = (0, http_1.createServer)(app);
const io = (0, socket_1.setupSocketIO)(server);
exports.io = io;
const PORT = process.env.PORT || 5001;
const corsOptions = {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin', 'Accept'],
    credentials: true,
    optionsSuccessStatus: 200,
    preflightContinue: false
};
app.use((0, cors_1.default)(corsOptions));
app.options('*', (0, cors_1.default)(corsOptions));
app.use((0, helmet_1.default)());
app.use((0, morgan_1.default)('combined'));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.get('/', (req, res) => {
    res.status(200).json({
        message: 'CodeMitra Backend API',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            health: '/healthz',
            auth: '/api/auth',
            users: '/api/users',
            rooms: '/api/rooms',
            code: '/api/code'
        }
    });
});
app.get('/healthz', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});
app.get('/api/test/db', async (req, res) => {
    try {
        const roomCount = await prisma_1.prisma.room.count();
        const userCount = await prisma_1.prisma.user.count();
        res.json({
            success: true,
            message: 'Database connection successful',
            data: {
                rooms: roomCount,
                users: userCount,
                database: 'connected',
                tables: 'exist'
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Database connection failed',
            details: error.message
        });
    }
});
app.use('/api/auth', auth_1.authRoutes);
app.use('/api/users', users_1.userRoutes);
app.use('/api/rooms', rooms_1.roomRoutes);
app.use('/api/code', code_1.codeRoutes);
app.use('/api/migrate', migrate_1.migrateRoutes);
app.use(errorHandler_1.errorHandler);
async function startServer() {
    try {
        const db = await prisma_1.prisma.$queryRaw `SELECT current_database();`;
        console.log("🔥 Connected to DB:", db);
        const tables = await prisma_1.prisma.$queryRaw `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `;
        console.log("🔥 Tables in DB:", tables);
        server.listen(Number(PORT), '0.0.0.0', () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV}`);
            console.log(`WebSocket server initialized`);
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}
process.on('SIGINT', async () => {
    console.log('Shutting down server...');
    await prisma_1.prisma.$disconnect();
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
startServer();
//# sourceMappingURL=index.js.map