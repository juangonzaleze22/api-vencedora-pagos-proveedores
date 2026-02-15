import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Cargar .env: primero desde la raíz del proyecto (carpeta que contiene /dist), luego desde process.cwd()
const projectRoot = path.resolve(__dirname, '..', '..');
const envPaths = [
  path.join(projectRoot, '.env'),
  path.join(process.cwd(), '.env'),
];
let loaded = false;
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    const result = dotenv.config({ path: envPath });
    if (!result.error) {
      loaded = true;
      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ .env cargado desde ${envPath}`);
      }
      break;
    }
  }
}
if (!loaded && process.env.NODE_ENV !== 'test') {
  console.warn(`⚠️ No se encontró .env en: ${envPaths.join(' ni en ')}. Se usan variables del sistema.`);
}

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
  const config = {
    PORT: parseInt(process.env.PORT || '3000', 10),
    NODE_ENV: process.env.NODE_ENV || 'development',
    DATABASE_URL: process.env.DATABASE_URL || '',
    JWT_SECRET: process.env.JWT_SECRET || 'default-secret',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
    MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10), // 5MB por defecto
    UPLOAD_PATH: process.env.UPLOAD_PATH || './uploads',
    API_BASE_URL: process.env.API_BASE_URL,
  };

  let dbUrl = (config.DATABASE_URL || '').trim();
  if ((dbUrl.startsWith('"') && dbUrl.endsWith('"')) || (dbUrl.startsWith("'") && dbUrl.endsWith("'"))) {
    dbUrl = dbUrl.slice(1, -1).trim();
  }

  if (!dbUrl) {
    const msg =
      'DATABASE_URL no está definida. Usa postgresql://... en local o mysql://... en producción.';
    console.error('❌ ' + msg);
    throw new Error(msg);
  }

  const validProtocol = /^(postgresql|postgres|mysql):\/\//i.test(dbUrl);
  if (!validProtocol) {
    const msg =
      'DATABASE_URL debe empezar por postgresql:// (local) o mysql:// (ej. producción).';
    console.error('❌ ' + msg);
    throw new Error(msg);
  }

  config.DATABASE_URL = dbUrl;
  process.env.DATABASE_URL = config.DATABASE_URL;
  if (!process.env.JWT_SECRET) process.env.JWT_SECRET = config.JWT_SECRET;

  return config;
}

export const env = validateEnv();

