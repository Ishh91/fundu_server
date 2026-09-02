import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env FIRST before importing any routes or services
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';
import { parseAuth } from './middleware/auth.js';
import apiRoutes from './routes/index.js';

const app = express();
const PORT = Number(process.env.PORT || 4000);

// Bulletproof Universal CORS Middleware (Always set headers first)
app.use((req, res, next) => {
  const requestOrigin = req.headers.origin;
  
  // Set CORS headers for all origins including production domain
  if (requestOrigin) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Range, x-custom-header, apikey');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, X-Total-Count');

  // Handle browser OPTIONS preflight requests cleanly
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// Configure cors module with origin fallback function
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server) or any origin
      callback(null, origin || '*');
    },
    credentials: true,
    optionsSuccessStatus: 204,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(parseAuth);
app.use('/api', apiRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'fundu-api', time: new Date().toISOString() });
});

// Global Error Handler with guaranteed CORS headers on failure
app.use((err, req, res, _next) => {
  console.error('Unhandled server error:', err);
  const requestOrigin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', requestOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Internal Server Error',
  });
});

async function startServer() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
