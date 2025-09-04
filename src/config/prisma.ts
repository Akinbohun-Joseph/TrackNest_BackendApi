import { PrismaClient } from '@prisma/client';

// Create a single shared Prisma client instance
const prisma = new PrismaClient();

// Export it so other files can use it
export default prisma;
