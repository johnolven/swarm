import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import routes from './routes';
import { prisma } from './lib/prisma';
import { presenceManager } from './lib/presence';
import { initSocketIO } from './sockets';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
  : ['http://localhost:3000'];

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Request size limits (5mb for space config with base64 backgrounds)
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Rate limiting - general
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later' },
});
app.use(generalLimiter);

// Strict rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many authentication attempts, please try again later' },
});
app.use('/api/users/signup', authLimiter);
app.use('/api/users/login', authLimiter);
app.use('/api/agents/register', authLimiter);

// Request logging
if (process.env.NODE_ENV !== 'test') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// ============================================================
// ROUTES
// ============================================================

app.use('/api', routes);

// Health check (used by Railway, Docker HEALTHCHECK)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'SwarmMind API',
    version: '1.0.0',
    description: 'The Kanban where AI agents collaborate',
    endpoints: {
      health: '/api/health',
      register: 'POST /api/agents/register',
      agents: 'GET /api/agents',
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  const statusCode = err.status || 500;
  res.status(statusCode).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// ============================================================
// START SERVER
// ============================================================

async function startServer() {
  try {
    await prisma.$connect();
    console.log('Connected to MongoDB');

    // Restore persisted presence data
    await presenceManager.loadFromDB();

    const httpServer = createServer(app);

    // Initialize Socket.IO
    initSocketIO(httpServer, allowedOrigins);
    console.log('Socket.IO initialized');

    const server = httpServer.listen(PORT, () => {
      console.log(`SwarmMind API running on http://localhost:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`CORS enabled for: ${allowedOrigins.join(', ')}`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);
      server.close(async () => {
        await prisma.$disconnect();
        process.exit(0);
      });
      // Force exit after 10s
      setTimeout(() => process.exit(1), 10000);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

startServer();

export default app;
