import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import config from './config/index.js';
import apiRouter from './routes/index.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();

app.set('trust proxy', 1);

// Security headers. crossOriginResourcePolicy is relaxed so the frontend
// (served from a different origin/port) can load uploaded images.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  }),
);

// CORS - reflect any allow-listed origin; a '*' entry allows everything (dev).
const allowAll = config.corsOrigins.includes('*');
app.use(
  cors({
    origin(origin, cb) {
      // Non-browser clients (curl, server-to-server) send no Origin.
      if (!origin || allowAll || config.corsOrigins.includes(origin)) {
        return cb(null, true);
      }
      return cb(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

if (config.env !== 'test') {
  app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));
}

// Serve uploaded files (avatars, ID docs, attachments).
app.use('/uploads', express.static(config.uploadDir));

// Liveness probe.
app.get(['/health', '/api/health'], (req, res) => {
  res.json({ success: true, message: 'Kibarua API is running', env: config.env });
});

// All API routes live under /api. The frontend's API_BASE constants should
// point here (e.g. http://localhost:5000/api).
app.use('/api', apiRouter);

// 404 + centralised error handling (must be last).
app.use(notFound);
app.use(errorHandler);

export default app;
