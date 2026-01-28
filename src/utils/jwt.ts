import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface JwtPayload {
  userId: number;
  email: string;
  nombre: string;
  rolId: number;
  rolNombre: string;
}

export const generateToken = (payload: JwtPayload): string => {
  return jwt.sign(
    payload as object,
    env.JWT_SECRET,
    {
      expiresIn: env.JWT_EXPIRES_IN,
    } as jwt.SignOptions
  );
};

export const verifyToken = (token: string): JwtPayload => {
  try {
    return jwt.verify(token, env.JWT_SECRET as string) as JwtPayload;
  } catch (error) {
    throw new Error('Token inválido o expirado');
  }
};

