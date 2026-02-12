import prisma from '../config/database';
import type { UserResponse } from '../types';

export class UserService {
  /**
   * Lista usuarios, opcionalmente filtrados por nombre de rol (ej: CAJERO, ADMINISTRADOR).
   */
  async getUsers(role?: string): Promise<UserResponse[]> {
    const where: { rol?: { nombre: string } } = {};
    if (role && role.trim()) {
      where.rol = { nombre: role.trim().toUpperCase() };
    }

    const usuarios = await prisma.usuario.findMany({
      where,
      select: {
        id: true,
        email: true,
        nombre: true,
        rol: {
          select: {
            id: true,
            nombre: true
          }
        }
      },
      orderBy: { nombre: 'asc' }
    });

    return usuarios as UserResponse[];
  }
}
