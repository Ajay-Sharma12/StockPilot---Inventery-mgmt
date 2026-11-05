import { createApp } from './app';
import { env } from './config/env.config';
import { connectDatabase, disconnectDatabase } from './config/database';
import { logger } from './core/logger';

const startServer = async () => {
  try {
    // 1. Connect database
    await connectDatabase();

    // 1b. Verify physical warehouse bins & backfill legacy balances
    try {
      const { inventoryService } = await import('./services/inventory.service');
      await inventoryService.ensureWarehouseBinsAndBackfill();
    } catch (binErr: any) {
      logger.warn(`Could not run warehouse bin verification on startup: ${binErr.message}`);
    }

    // 2. Initialize application
    const app = createApp();

    // 3. Start HTTP server
    const server = app.listen(env.PORT, '0.0.0.0', () => {
      logger.info(`🚀 StockPilot Backend API running on port ${env.PORT} [${env.NODE_ENV}]`);
      logger.info(`🔗 Base URL: http://localhost:${env.PORT}/api/v1`);
    });

    // 4. Start Background Scheduler Daemon
    const { backgroundScheduler } = await import('./jobs/scheduler');
    backgroundScheduler.start(60); // Check every 60 minutes

    // 5. Graceful shutdown listeners
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      backgroundScheduler.stop();
      server.close(async () => {
        await disconnectDatabase();
        logger.info('StockPilot API server stopped cleanly');
        process.exit(0);
      });

      // Force close after 10s if stuck
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('Fatal error during server startup:', error);
    process.exit(1);
  }
};

startServer();
 
