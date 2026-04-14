import "server-only";
import mongoose from "mongoose";
import type { MongoMemoryServer } from "mongodb-memory-server";
import { env } from "@/lib/env";

/**
 * Connection caching across Next.js hot reloads.
 *
 * - `__mongooseCache` : holds the single Mongoose connection promise so HMR
 *                      doesn't open dozens of sockets to Atlas.
 * - `__memoryMongo`   : holds the single MongoMemoryServer instance so HMR
 *                      doesn't spin up dozens of in-process Mongo daemons.
 *
 * Both caches must outlive any module reload but die with the dev process.
 */

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

type MemoryMongoCache = {
  instance: MongoMemoryServer | null;
  uri: string | null;
};

const g = globalThis as unknown as {
  __mongooseCache?: MongooseCache;
  __memoryMongo?: MemoryMongoCache;
};

g.__mongooseCache ??= { conn: null, promise: null };
g.__memoryMongo ??= { instance: null, uri: null };

const cache = g.__mongooseCache;
const memCache = g.__memoryMongo;

const MEMORY_SCHEME = "memory://";

const isMemoryMode = (uri: string | undefined): boolean =>
  !uri || uri.startsWith(MEMORY_SCHEME);

const resolveUri = async (): Promise<string> => {
  if (!isMemoryMode(env.MONGO_URI)) return env.MONGO_URI;
  if (memCache.uri) return memCache.uri;

  // Lazy-import so production bundles don't pull in the dev-only package.
  const { MongoMemoryServer } = await import("mongodb-memory-server");
  const server = await MongoMemoryServer.create({
    instance: { dbName: "ceh-prep" },
  });

  memCache.instance = server;
  // `getUri()` with no args returns `mongodb://host:port/` without the db
  // segment — mongoose would then default to `test`. Pass the dbName
  // explicitly so the URI includes `/ceh-prep` and the app talks to the
  // intended database.
  memCache.uri = server.getUri("ceh-prep");

  // Single-line dev signal so the developer knows what's running.
  // (Replace with pino in Phase 5 once the logger boundary lands.)
  // eslint-disable-next-line no-console
  console.log(`[mongo] in-process MongoMemoryServer at ${memCache.uri}`);

  return memCache.uri;
};

export const connectDB = async (): Promise<typeof mongoose> => {
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    const uri = await resolveUri();
    cache.promise = mongoose.connect(uri, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 8_000,
      maxPoolSize: 5, // STAB-07: down from 10 for Atlas M0 (100-conn cap)
      minPoolSize: 0, // Don't hold connections idle on M0
      maxIdleTimeMS: 30_000, // Free M0 slots after 30s idle
    });
  }

  cache.conn = await cache.promise;
  return cache.conn;
};
