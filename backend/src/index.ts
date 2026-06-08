import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config, validateConfig } from './config/env.js';
import sessionRoutes from './routes/session.routes.js';
import { setupWebSocket } from './websocket/chat.handler.js';
import { getDatabase } from './services/database.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Validate configuration
validateConfig();

// Ensure data directory exists
const dataDir = path.resolve(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
getDatabase();

// Create Express app
const app = express();

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (same-origin, mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    // In production, allow the configured origin and any DigitalOcean app URL
    const allowedOrigins = [
      config.corsOrigin,
      /\.ondigitalocean\.app$/,
      /localhost:\d+$/,
    ];

    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed instanceof RegExp) return allowed.test(origin);
      return allowed === origin;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/session', sessionRoutes);

// SPA fallback: serve frontend build and redirect all non-API routes to index.html
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server (no path - we handle routing in the handler)
const wss = new WebSocketServer({
  noServer: true,
});

// Handle upgrade requests manually for path-based routing
server.on('upgrade', (request, socket, head) => {
  const pathname = request.url?.split('?')[0] || '';

  // Only accept connections to /ws/chat/* paths
  if (pathname.startsWith('/ws/chat')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Setup WebSocket handlers
setupWebSocket(wss);

// Start server
const PORT = config.port;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
====================================
  FAB SME Onboarding Backend Started
====================================
  Port: ${PORT}
  Environment: ${config.nodeEnv}
  CORS Origin: ${config.corsOrigin}
  Pinecone: ${config.enablePinecone ? 'Enabled' : 'Disabled (using local KB)'}
====================================

Endpoints:
  REST API: http://localhost:${PORT}/api/session
  WebSocket: ws://localhost:${PORT}/ws/chat/:sessionId
  Health:    http://localhost:${PORT}/health
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
