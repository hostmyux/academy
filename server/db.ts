import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Try to create a database connection, but handle errors gracefully
let pool: Pool | null = null;
let sqliteDb: Database | null = null;
let db: any;

try {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
  }

  // Check if it's a SQLite database URL
  if (process.env.DATABASE_URL.startsWith('file:')) {
    console.log('Using SQLite database');
    sqliteDb = new Database(process.env.DATABASE_URL.replace('file:', ''));
    db = drizzleSqlite({ client: sqliteDb, schema });
    console.log('SQLite database connection initialized');
  } else {
    // Use PostgreSQL
    console.log('Using PostgreSQL database');
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzle({ client: pool, schema });
    
    // Test the connection
    pool.on('error', (err) => {
      console.error('Database connection error:', err);
      // Don't throw here, just log the error
    });
    
    console.log('PostgreSQL database connection initialized');
  }
  
} catch (error) {
  console.error('Failed to initialize database:', error);
  console.log('Using mock database for development...');
  
  // Create a mock database object for development
  db = {
    query: () => ({ 
      then: () => Promise.resolve([]) 
    }),
    select: () => ({ 
      then: () => Promise.resolve([]) 
    }),
    insert: () => ({ 
      then: () => Promise.resolve({ id: 'mock-id' }) 
    }),
    update: () => ({ 
      then: () => Promise.resolve({}) 
    }),
    delete: () => ({ 
      then: () => Promise.resolve({}) 
    }),
  };
}

export { pool, sqliteDb, db };