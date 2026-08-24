import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { connectDB } from './config/db.js';
import { parseAuth } from './middleware/auth.js';
import apiRoutes from './routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const app = express();
const PORT = Number(process.env.PORT || 4000);
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4000',
  'https://fundu52.vercel.app',
  'https://fundu.onrender.com',
  'https://thefundu.com',
  'https://www.thefundu.com',
  process.env.CLIENT_ORIGIN,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    if (
      allowedOrigins.includes(origin) ||
      /\.vercel\.app$/.test(origin) ||
      /\.onrender\.com$/.test(origin) ||
      /thefundu\.com$/.test(origin)
    ) {
      return callback(null, origin);
    }
    callback(null, origin);
  },
  credentials: true,
}));

app.use(express.json({ limit: '2mb' }));
app.use(parseAuth);

app.use('/api', apiRoutes);

app.use((error, req, res, _next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  const status = error.status || 500;
  res.status(status).json({
    error: {
      message: error.message || 'Internal server error',
    },
  });
});

await connectDB();

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
