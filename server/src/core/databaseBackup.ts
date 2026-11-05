import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { logger } from './logger';

const BACKUP_DIR = path.resolve(__dirname, '../../../.mongo-data');
const BACKUP_FILE = path.join(BACKUP_DIR, 'stockpilot-backup.json');

/**
 * Creates an atomic JSON snapshot of all collections in the current database.
 */
export const saveDatabaseSnapshot = async (db: mongoose.mongo.Db): Promise<boolean> => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const collections = await db.listCollections().toArray();
    const payload: Record<string, any[]> = {};

    for (const col of collections) {
      if (col.name.startsWith('system.')) continue;
      const docs = await db.collection(col.name).find({}).toArray();
      payload[col.name] = docs;
    }

    const tempFile = `${BACKUP_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(payload, null, 2), 'utf-8');
    fs.renameSync(tempFile, BACKUP_FILE);

    logger.debug(`💾 Saved database snapshot (${Object.keys(payload).length} collections)`);
    return true;
  } catch (error: any) {
    logger.warn(`Failed to save database snapshot: ${error.message}`);
    return false;
  }
};

/**
 * Revives ObjectIds and Date objects from serialized JSON
 */
const reviveMongoTypes = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return obj.map(reviveMongoTypes);
  }

  if (typeof obj === 'object') {
    // Check if it's an ObjectId string (24 hex characters) in an _id or Ref field
    const res: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (
        (key === '_id' || key.endsWith('Id') || key.endsWith('By')) &&
        typeof value === 'string' &&
        /^[0-9a-fA-F]{24}$/.test(value)
      ) {
        try {
          res[key] = new mongoose.Types.ObjectId(value);
          continue;
        } catch {
          // Keep string if conversion fails
        }
      }

      // Check if it's an ISO date string
      if (
        (key.endsWith('At') || key === 'date' || key === 'timestamp' || key.endsWith('Date')) &&
        typeof value === 'string' &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)
      ) {
        const d = new Date(value);
        if (!isNaN(d.getTime())) {
          res[key] = d;
          continue;
        }
      }

      res[key] = reviveMongoTypes(value);
    }
    return res;
  }

  return obj;
};

/**
 * Restores collections from disk snapshot if database is empty.
 */
export const restoreDatabaseSnapshot = async (db: mongoose.mongo.Db): Promise<boolean> => {
  try {
    if (!fs.existsSync(BACKUP_FILE)) {
      logger.info('No persistent database snapshot file found to restore.');
      return false;
    }

    logger.info(`📦 Found persistent database backup at ${BACKUP_FILE}. Restoring data...`);
    const rawData = fs.readFileSync(BACKUP_FILE, 'utf-8');
    const parsed = JSON.parse(rawData);

    let restoredCollectionsCount = 0;
    let totalDocsRestored = 0;

    for (const [colName, rawDocs] of Object.entries(parsed)) {
      if (!Array.isArray(rawDocs) || rawDocs.length === 0) continue;

      const collection = db.collection(colName);
      const existingCount = await collection.countDocuments();
      if (existingCount === 0) {
        const revivedDocs = rawDocs.map(reviveMongoTypes);
        try {
          await collection.insertMany(revivedDocs, { ordered: false });
          restoredCollectionsCount++;
          totalDocsRestored += revivedDocs.length;
        } catch (insertErr: any) {
          // If partial duplicates, still proceed
          if (insertErr.insertedDocs || insertErr.result?.nInserted) {
            restoredCollectionsCount++;
            totalDocsRestored += (insertErr.result?.nInserted || 0);
          }
        }
      }
    }

    logger.info(
      `✅ Restored ${restoredCollectionsCount} collections (${totalDocsRestored} documents) from persistent backup.`
    );
    return true;
  } catch (error: any) {
    logger.error(`Failed to restore database snapshot: ${error.message}`);
    return false;
  }
};

/**
 * Starts automatic continuous snapshots every minute and on process termination.
 */
export const startContinuousBackup = (conn: typeof mongoose, intervalMs = 60000): NodeJS.Timeout => {
  const timer = setInterval(() => {
    if (conn.connection?.db) {
      saveDatabaseSnapshot(conn.connection.db);
    }
  }, intervalMs);

  const onShutdown = async () => {
    if (conn.connection?.db) {
      logger.info('Process shutting down. Taking final database snapshot...');
      await saveDatabaseSnapshot(conn.connection.db);
    }
  };

  process.once('SIGINT', onShutdown);
  process.once('SIGTERM', onShutdown);

  return timer;
};
