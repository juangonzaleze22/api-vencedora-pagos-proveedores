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
import app from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import prisma from './config/database';

const PORT = parseInt(process.env.PORT || '3000', 10);

console.log('PORT ==>>', PORT);

// Función para iniciar el servidor
async function startServer() {
  try {
    console.log('🔄 Iniciando servidor...');
    
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

