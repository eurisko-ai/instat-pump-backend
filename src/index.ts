import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeDatabase, AppDataSource } from './database/DataSource';
import metadataRouter from './routes/metadata';
import publishRouter from './routes/publish';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'],
    credentials: true,
  })
);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));

// Routes
// metadataRouter includes /api/metadata and /api/generate-metadata
app.use(metadataRouter);
app.use(publishRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
async function start() {
  try {
    // Initialize database
    await initializeDatabase();

    // Run migrations
    console.log('🔄 Running migrations...');
    const migrations = await AppDataSource.runMigrations();
    console.log(`✅ Migrations complete: ${migrations.length} applied`);

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Instat Pump Backend running on http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

start();
