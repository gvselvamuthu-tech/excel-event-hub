const mongoose = require("mongoose");
const path = require("path");

// Load .env if present (local dev)
if (!process.env.MONGODB_URI) {
  try {
    require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
  } catch (e) {
    // ignore
  }
}

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI || MONGODB_URI === "YOUR_MONGODB_CONNECTION_STRING") {
  console.warn("Warning: MONGODB_URI is not configured.");
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development and serverless function executions in production.
 */
let cached = global._mongoose;

if (!cached) {
  cached = global._mongoose = { conn: null, promise: null };
}

async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongooseInstance) => {
      return mongooseInstance;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

module.exports = { connectToDatabase };
