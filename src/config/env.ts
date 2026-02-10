import dotenv from 'dotenv';

dotenv.config();

interface EnvConfig {
  PORT: number;
  NODE_ENV: string;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  MAX_FILE_SIZE: number;
  UPLOAD_PATH: string;
  API_BASE_URL?: string; // URL base de la API (ej: http://localhost:3000)
}

function validateEnv(): EnvConfig {
  return {
    PORT: parseInt(process.env.PORT || '3000', 10),
    NODE_ENV: process.env.NODE_ENV || 'development',
    DATABASE_URL: process.env.DATABASE_URL || '',
    JWT_SECRET: process.env.JWT_SECRET || 'default-secret',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
    MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10), // 5MB por defecto
    UPLOAD_PATH: process.env.UPLOAD_PATH || './uploads',
    API_BASE_URL: process.env.API_BASE_URL, // Opcional: si no está, se usa URL relativa
  };
}

export const env = validateEnv();

