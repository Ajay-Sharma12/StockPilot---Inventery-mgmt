import mongoose from 'mongoose';
import { env } from './env.config';
import { logger } from '../core/logger';

let memoryServer: any = null;

export const connectDatabase = async (): Promise<typeof mongoose> => {
  try {
    logger.info(`Attempting to connect to MongoDB at ${env.MONGO_URI}...`);
    
    // Attempt standard connection with 2s timeout
    const conn = await mongoose.connect(env.MONGO_URI, {
      serverSelectionTimeoutMS: 2000,
      autoIndex: true,
    });

    logger.info(`MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    return conn;
  } catch (error: any) {
    if (env.NODE_ENV === 'production') {
      logger.error(`FATAL: Failed to connect to MongoDB in production mode (${error.message}). In-memory fallback is disabled.`);
      throw error;
    }

    logger.warn(`Could not connect to external MongoDB (${error.message}). Initializing embedded Persistent MongoDB for development...`);

    try {
      const path = await import('path');
      const fs = await import('fs');
      const { MongoMemoryServer } = await import('mongodb-memory-server');

      // Use persistent disk storage for embedded MongoDB so data and sessions survive restarts
      const dataDir = path.resolve(__dirname, '../../.mongo-data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      const lockFile = path.join(dataDir, 'mongod.lock');
      if (fs.existsSync(lockFile)) {
        try {
          const lockContent = fs.readFileSync(lockFile, 'utf-8').trim();
          const pid = parseInt(lockContent, 10);
          let isRunning = false;
          if (!isNaN(pid) && pid > 0) {
            try {
              process.kill(pid, 0);
              isRunning = true;
            } catch {
              isRunning = false;
            }
          }
          if (!isRunning) {
            fs.unlinkSync(lockFile);
            logger.info(`Cleaned up stale mongod.lock (PID ${pid || 'empty'} was not running)`);
          }
        } catch {
          // Ignore
        }
      }

      let boundDisk = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          memoryServer = await MongoMemoryServer.create({
            instance: {
              dbName: 'stockpilot',
              dbPath: dataDir,
              storageEngine: 'wiredTiger',
            },
          });
          logger.info(`⚡ Embedded Persistent MongoDB started with disk storage: ${dataDir}`);
          boundDisk = true;
          break;
        } catch (storageErr: any) {
          logger.warn(`Could not bind to custom dbPath (attempt ${attempt}/3: ${storageErr.message}). Cleaning lock and retrying in 1.2s...`);
          try {
            if (fs.existsSync(lockFile)) {
              fs.unlinkSync(lockFile);
            }
          } catch {}
          await new Promise((r) => setTimeout(r, 1200));
        }
      }

      if (!boundDisk) {
        logger.error(`Could not bind to custom dbPath after 3 attempts. Initializing embedded fallback instance...`);
        memoryServer = await MongoMemoryServer.create({
          instance: {
            dbName: 'stockpilot',
          },
        });
      }

      const rawUri = memoryServer.getUri();
      const uri = rawUri.endsWith('/') ? `${rawUri}stockpilot` : `${rawUri}/stockpilot`;
      logger.info(`⚡ MongoDB server active at: ${uri}`);

      const conn = await mongoose.connect(uri, {
        dbName: 'stockpilot',
        autoIndex: true,
      });

      logger.info('Connected to MongoDB');

      // Purge any legacy Apex Logistics or Nova Dynamics demo data
      try {
        const apexId = new mongoose.Types.ObjectId('6abb60c6223d5d2f763c3656');
        const novaId = new mongoose.Types.ObjectId('6abb60c7223d5d2f763c3667');
        const collections = await conn.connection.db!.listCollections().toArray();
        for (const c of collections) {
          if (c.name.startsWith('system.')) continue;
          await conn.connection.db!.collection(c.name).deleteMany({
            $or: [
              { tenantId: { $in: [apexId, novaId] } },
              { _id: { $in: [apexId, novaId] } },
              { slug: { $in: ['apex-logistics', 'nova-dynamics'] } },
              { email: { $regex: /@(apexlogistics\.com|novadynamics\.io)$/i } },
              { contactEmail: { $regex: /@(apexlogistics\.com|novadynamics\.io)$/i } },
            ],
          } as any);
        }
      } catch (cleanErr: any) {
        logger.debug('Apex cleanup notice:', cleanErr.message);
      }

      // 1. Check if database has data; if empty, restore from persistent snapshot
      const { restoreDatabaseSnapshot, startContinuousBackup, saveDatabaseSnapshot } = await import('../core/databaseBackup');
      const { Tenant } = await import('../models/tenant.model');
      let tenantCount = await Tenant.countDocuments();

      if (tenantCount === 0) {
        logger.info('Database has 0 tenants. Attempting restore from persistent disk snapshot...');
        const restored = await restoreDatabaseSnapshot(conn.connection.db!);
        if (restored) {
          tenantCount = await Tenant.countDocuments();
        }
      }

      // 2. If still unpopulated (no backup existed), run Enterprise Seed
      if (tenantCount === 0) {
        logger.info('Database is unpopulated and no backup found. Auto-running Enterprise Seed...');
        const { seedDatabase } = await import('../scripts/seed');
        await seedDatabase();
        if (conn.connection?.db) {
          await saveDatabaseSnapshot(conn.connection.db);
        }
      }

      // 3. Start continuous automatic disk snapshots so every added item/data stays permanently
      startContinuousBackup(conn, 30000);

      return conn;
    } catch (memError: any) {
      logger.error(`Failed to initialize in-memory database: ${memError?.message}\n${memError?.stack}`);
      throw error;
    }
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
  }
  logger.info('MongoDB disconnected gracefully');
};
