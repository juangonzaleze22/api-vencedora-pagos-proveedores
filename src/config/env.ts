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

  if (!config.DATABASE_URL || config.DATABASE_URL.trim() === '') {
    const msg =
      'DATABASE_URL no está definida. En el servidor, crea un archivo .env en la carpeta desde donde ejecutas la app (ej. public_html) con DATABASE_URL="mysql://usuario:contraseña@host:3306/nombre_bd", o configura la variable en el panel del hosting.';
    console.error('❌ ' + msg);
    throw new Error(msg);
  }

  // Asegurar que Prisma y el resto del código vean las variables en process.env
  if (!process.env.DATABASE_URL) process.env.DATABASE_URL = config.DATABASE_URL;
  if (!process.env.JWT_SECRET) process.env.JWT_SECRET = config.JWT_SECRET;

  return config;
}

export const env = validateEnv();

