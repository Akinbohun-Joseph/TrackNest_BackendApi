import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default(3000),
  
  // Database
  DATABASE_URL: z.string(),
  
  // Redis
  REDIS_URL: z.string(),
  
  // JWT
  JWT_SECRET: z.string(),
  JWT_REFRESH_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('1h'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  
  // External Services
  TWILIO_ACCOUNT_SID: z.string(),
  TWILIO_AUTH_TOKEN: z.string(),
  TWILIO_PHONE_NUMBER: z.string(),
  
  GOOGLE_MAPS_API_KEY: z.string(),
  FIREBASE_SERVER_KEY: z.string(),
  
  // Email
  SMTP_HOST: z.string(),
  SMTP_PORT: z.string().transform(Number),
  SMTP_USER: z.string(),
  SMTP_PASS: z.string(),
  
  // Police Integration
  POLICE_API_URL: z.string().optional(),
  POLICE_API_KEY: z.string().optional(),
  
  // App Settings
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  MAX_LOCATION_HISTORY_DAYS: z.string().transform(Number).default(30),
  EMERGENCY_ESCALATION_TIMEOUT: z.string().transform(Number).default(300), // 5 minutes
});

export const config = configSchema.parse(process.env);