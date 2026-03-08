// Capturar errores no manejados (pero no cerrar el servidor inmediatamente)
process.on('uncaughtException', (error) => {
  console.error('❌ Error no capturado:', error);
  console.error('Stack:', error.stack);
  // No cerrar el servidor inmediatamente, solo loguear
  // process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesa rechazada no manejada:', reason);
  console.error('Promise:', promise);
  // No cerrar el servidor inmediatamente, solo loguear
  // process.exit(1);
});

// Importar después de los handlers de errores
// Cargar env PRIMERO para que dotenv y DATABASE_URL estén en process.env antes de Prisma
import { execSync } from 'child_process';
import path from 'path';
import { env } from './config/env';
import app from './app';
import { logger } from './utils/logger';
import prisma from './config/database';

const PORT = parseInt(process.env.PORT || '3000', 10);

console.log('PORT ==>>', PORT);

// Sincronizar schema con la BD al arrancar (útil en Hostinger sin consola).
// Actívalo en el panel: RUN_DB_PUSH_ON_START = true
function runDbPushIfEnabled() {
  if (process.env.RUN_DB_PUSH_ON_START !== 'true') return;
  const projectRoot = path.resolve(__dirname, '..');
  console.log('🔄 Sincronizando schema con la BD (prisma db push)...');
  try {
    const out = execSync('npx prisma db push --skip-generate', {
      cwd: projectRoot,
      encoding: 'utf8',
      env: process.env,
    });
    if (out) console.log(out);
    console.log('✅ Schema sincronizado.');
  } catch (e: any) {
    const msg = e?.stderr || e?.stdout || e?.message || String(e);
    console.error('❌ Error al sincronizar schema (la app seguirá; revisa que prisma/ esté en el servidor y DATABASE_URL sea correcta):', msg);
    // No lanzar: permitir que la app arranque por si la BD ya está bien
  }
}

// Función para iniciar el servidor
async function startServer() {
  try {
    console.log('🔄 Iniciando servidor...');
    runDbPushIfEnabled();

    // Verificar conexión a la base de datos
    console.log('🔄 Conectando a la base de datos...');
    await prisma.$connect();
    console.log('✅ Conexión a la base de datos establecida');

    // Iniciar servidor (escuchar en todas las interfaces)
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
      console.log(`📝 Ambiente: ${env.NODE_ENV}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`🌐 Servidor escuchando en: http://0.0.0.0:${PORT}`);
      logger.info(`🚀 Servidor corriendo en puerto ${PORT}`);
      logger.info(`📝 Ambiente: ${env.NODE_ENV}`);
      logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error: any) {
    console.error('❌ Error al iniciar el servidor:', error);
    console.error('Stack:', error?.stack);
    logger.error('❌ Error al iniciar el servidor:', error);
    process.exit(1);
  }
}

// Manejo de cierre graceful
process.on('SIGTERM', async () => {
  logger.info('SIGTERM recibido, cerrando servidor...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT recibido, cerrando servidor...');
  await prisma.$disconnect();
  process.exit(0);
});

startServer();

