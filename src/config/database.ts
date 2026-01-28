import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
}) as any; // Temporal: usar 'as any' hasta que se regenere el cliente de Prisma

export default prisma;

