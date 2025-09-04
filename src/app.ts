import express from 'express';
import cors from 'cors';
import helmet from 'helmet'; 
import ratelimiting from 'express-rate-limit';
import prisma from './config/prisma';

//import authRoutes from './routes/auth.routes';
//import locationRoutes from './routes/location.routes'
import emergencyRoutes from './routes/emergency.routes';

//import middleware
import {errorHandler} from './middleware/error.middleware';
import logger from './utils/logger';
//Create an Express application
const app = express();

app.use(helmet());
app.use(cors({
origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET,HEAD,PUT,PATCH,POST,DELETE'] 
}));
const limiter = ratelimiting({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests, please try again later.',
  },
  });
  app.use(limiter);
  //Parse incoming JSON requests
  app.use(express.json({limit: '10mb'})); // Increase the limit for large JSON payloads
  app.use(express.urlencoded({ extended: true, limit: '10mb'}))
  //Log all incoming requests
  app.use((req, res, next) => {
    //logger.info(`${req.method} ${req.path} - ${req.ip}`);
    next();
  })
  // Health check endpoint 
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uiptime: process.uptime() // How long the server has been running
    })
  })

  //API Routes 
  ///app.use('/api/auth', authRoutes);
  //app.use('/api/location', locationRoutes);
  app.use('/api/emergency', emergencyRoutes);

  //Handle 404 errors - Route not found
  app.use((req, res)=> {
    res.status(404).json({
      success: false,
      message: `Route ${req.originalUrl} not found`
    })
  })

  app.use(errorHandler);
  //Handle process termination signals for graceful shutdown
  process.on('SIGINT', async() => {
    console.log('Received SIGINT. Shutting down gracefully...');
    await prisma.$disconnect();
    process.exit(0);
  });
process.on('SIGTERM', async() => {
  console.log('Receieved SIGTERM. Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});
//Export the app
export default app;