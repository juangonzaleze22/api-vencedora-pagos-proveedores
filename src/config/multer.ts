import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { env } from './env';

// Crear directorio base si no existe
if (!fs.existsSync(env.UPLOAD_PATH)) {
  fs.mkdirSync(env.UPLOAD_PATH, { recursive: true });
}

// Crear directorio para comprobantes (receipts) si no existe
const receiptsPath = path.join(env.UPLOAD_PATH, 'receipt');
if (!fs.existsSync(receiptsPath)) {
  fs.mkdirSync(receiptsPath, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Guardar comprobantes en la subcarpeta receipt/
    cb(null, receiptsPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Tipos de archivo permitidos (ajusta según tus necesidades)
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de archivo no permitido. Tipos permitidos: ${allowedMimes.join(', ')}`));
  }
};

export const upload = multer({
  storage: storage,
  limits: {
    fileSize: env.MAX_FILE_SIZE, // Tamaño máximo en bytes
  },
  fileFilter: fileFilter,
});

// Middleware para manejar errores de Multer
export const handleMulterError = (err: any, req: any, res: any, next: any) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: `El archivo excede el tamaño máximo permitido (${env.MAX_FILE_SIZE / 1024 / 1024}MB)`
      });
    }
    return res.status(400).json({
      success: false,
      message: `Error al subir archivo: ${err.message}`
    });
  }
  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || 'Error al procesar el archivo'
    });
  }
  next();
};

// Configuraciones específicas
export const uploadSingle = (fieldName: string) => upload.single(fieldName);
export const uploadMultiple = (fieldName: string, maxCount?: number) => upload.array(fieldName, maxCount);
export const uploadFields = (fields: multer.Field[]) => upload.fields(fields);

