import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.config';
import { requestIdMiddleware } from './middleware/requestId.middleware';
import { errorHandler } from './middleware/errorHandler.middleware';
import apiRouter from './routes';
import { NotFoundError } from './core/errors';

export const createApp = (): express.Application => {
  const app = express();

  // Trust proxy for reverse proxies / tunnels (Ngrok, Cloudflare, etc.)
  app.set('trust proxy', 1);

  // Disable ETags to prevent conditional 304 errors on API endpoints
  app.set('etag', false);

  // Prevent browser caching on dynamic API responses
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
  });

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // Keep flexible for dev and SPA assets
    })
  );

  // CORS configuration
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like curl, mobile apps, or same-origin)
        if (!origin) return callback(null, true);
        if (
          origin === env.CLIENT_URL ||
          origin === 'http://localhost:5173' ||
          origin === 'http://127.0.0.1:5173' ||
          /^http:\/\/(localhost|127\.0\.0\.1|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin) ||
          env.NODE_ENV !== 'production'
        ) {
          return callback(null, true);
        }
        callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-Request-ID'],
    })
  );

  // Body and cookie parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // Request ID tracing
  app.use(requestIdMiddleware);

  // Root & Health check
  app.get('/', (_req, res) => {
    res.json({
      name: 'StockPilot API',
      version: '1.0.0',
      phase: 'Phase 1: Multi-Tenant Architecture & Authorization Engine',
      status: 'operational',
    });
  });

  // Mount API v1
  app.use('/api/v1', apiRouter);

  // 404 handler
  app.use((req, _res, next) => {
    next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
  });

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
};
