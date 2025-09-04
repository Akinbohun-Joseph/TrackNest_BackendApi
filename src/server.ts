// server.ts
import express from "express"
import 'dotenv/config';
import app from './app';
import prisma  from './config/prisma';
import {
  generalLimiter,
  authLimiter,
  panicButtonLimiter,
  redis
}\import cors from 'cors'
import { CorsOptions } from "cors";
//import { logger } from './config/logger';

const  PORT = Number(process.env.PORT) || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';



// DATABASE CONNECTION
/*
async function connectToDatabase() {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');
    const userCount = await prisma.user.count();
    logger.info(`Total users in the database: ${userCount}`);
  } catch (error) {
    logger.error('Database connection failed:', error);
    process.exit(1);
  }
}


// START SERVER

async function startServer() {
  await connectToDatabase();

  const server = app.listen(PORT, () => {
    logger.info(`TrackNest Server is running on port ${PORT}`);
    logger.info(`Environment: ${NODE_ENV}`);
    logger.info(` Server URL: http://localhost:${PORT}`);
    logger.info(` Health check: http://localhost:${PORT}/health`);

    if (NODE_ENV === 'development') {
      logger.info(`Development mode enabled`);
      logger.info(`Available routes:`);
      logger.info(`   - POST /api/auth/register`);
      logger.info(`   - POST /api/auth/login`);
      logger.info(`   - POST /api/emergency/trigger`);
      logger.info(`   - GET  /api/emergency/status`);
    }
  });

  // Graceful shutdown timeout fallback
  const killTimer = setTimeout(() => {
    logger.error('Graceful shutdown timed out');
    process.exit(1);
  }, 10_000); // 10 seconds

  // Graceful Shutdown Function
  async function gracefulShutdown(signal: NodeJS.Signals) {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    clearTimeout(killTimer);

    try {
      await prisma.$disconnect();
      logger.info('Database disconnected');
    } catch (error) {
      logger.error('Error disconnecting DB:', error);
    }

    server.close(() => {
      logger.info('🔌 Server closed');
      process.exit(0);
    });
  }

  // Shutdown and Error Handling
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection:', reason);
    process.exit(1);
  });
}

// Start the server
startServer().catch((err) => {
  logger.error('Startup failed:', err);
  process.exit(1);
});
*/