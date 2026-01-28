import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...');

  // Crear roles
  const roles = [
    { nombre: 'ADMINISTRADOR' },
    { nombre: 'SUPERVISOR' },
    { nombre: 'CAJERO' }
  ];

  const createdRoles: { [key: string]: any } = {};

  for (const rol of roles) {
    const existingRol = await prisma.rol.findUnique({
      where: { nombre: rol.nombre }
    });

    if (!existingRol) {
      const newRol = await prisma.rol.create({
        data: rol
      });
      createdRoles[rol.nombre] = newRol;
      console.log(`✅ Rol creado: ${rol.nombre}`);
    } else {
      createdRoles[rol.nombre] = existingRol;
      console.log(`ℹ️  Rol ya existe: ${rol.nombre}`);
    }
  }

  // Hash de password por defecto
  const defaultPassword = 'password123';
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  // Crear usuarios
  const usuarios = [
    {
      email: 'admin@vencedora.com',
      nombre: 'Administrador',
      rolNombre: 'ADMINISTRADOR'
    },
    {
      email: 'supervisor@vencedora.com',
      nombre: 'Supervisor',
      rolNombre: 'SUPERVISOR'
    },
    {
      email: 'cajero1@vencedora.com',
      nombre: 'Cajero 1',
      rolNombre: 'CAJERO'
    },
    {
      email: 'cajero2@vencedora.com',
      nombre: 'Cajero 2',
      rolNombre: 'CAJERO'
    },
    {
      email: 'cajero3@vencedora.com',
      nombre: 'Cajero 3',
      rolNombre: 'CAJERO'
    }
  ];

  for (const usuario of usuarios) {
    const existingUsuario = await prisma.usuario.findUnique({
      where: { email: usuario.email }
    });

    if (!existingUsuario) {
      await prisma.usuario.create({
        data: {
          email: usuario.email,
          nombre: usuario.nombre,
          password: hashedPassword,
          rolId: createdRoles[usuario.rolNombre].id
        }
      });
      console.log(`✅ Usuario creado: ${usuario.email} (${usuario.rolNombre})`);
    } else {
      console.log(`ℹ️  Usuario ya existe: ${usuario.email}`);
    }
  }

  // Crear proveedores de ejemplo
  const suppliers = [
    {
      companyName: 'Distribuidora Central S.A.',
      taxId: 'J-12345678-9',
      status: 'PENDING' as const, // Tiene deuda inicial
      initialDebt: 4250.00
    },
    {
      companyName: 'Distribuidora Los Andes C.A.',
      taxId: 'J-98765432-1',
      status: 'PENDING' as const, // Tiene deuda inicial
      initialDebt: 1250.00
    },
    {
      companyName: 'Tech Solutions C.A.',
      taxId: 'J-11223344-5',
      status: 'COMPLETED' as const, // No tiene deuda inicial
      initialDebt: 0
    }
  ];

  const createdSuppliers: any[] = [];

  for (const supplierData of suppliers) {
    const existingSupplier = await prisma.supplier.findUnique({
      where: { taxId: supplierData.taxId }
    });

    if (!existingSupplier) {
      const supplier = await prisma.supplier.create({
        data: {
          companyName: supplierData.companyName,
          taxId: supplierData.taxId,
          status: supplierData.status,
          totalDebt: supplierData.initialDebt
        }
      });
      createdSuppliers.push(supplier);
      console.log(`✅ Proveedor creado: ${supplierData.companyName}`);
    } else {
      createdSuppliers.push(existingSupplier);
      console.log(`ℹ️  Proveedor ya existe: ${supplierData.companyName}`);
    }
  }

  // Crear pedidos y deudas de ejemplo
  const adminUser = await prisma.usuario.findFirst({
    where: { email: 'admin@vencedora.com' }
  });

  if (adminUser && createdSuppliers.length > 0) {
    // Pedido 1 para Distribuidora Central
    const dispatchDate1 = new Date('2023-09-01');
    const dueDate1 = new Date(dispatchDate1);
    dueDate1.setDate(dueDate1.getDate() + 30);

    const order1 = await prisma.order.create({
      data: {
        supplierId: createdSuppliers[0].id,
        amount: 4250.00,
        dispatchDate: dispatchDate1,
        creditDays: 30,
        dueDate: dueDate1,
        createdBy: adminUser.id
      }
    });

    await prisma.debt.create({
      data: {
        orderId: order1.id,
        supplierId: createdSuppliers[0].id,
        initialAmount: 4250.00,
        remainingAmount: 4250.00,
        dueDate: dueDate1,
        status: 'PENDING'
      }
    });
    console.log(`✅ Pedido y deuda creados para ${createdSuppliers[0].companyName}`);

    // Pedido 2 para Distribuidora Los Andes
    const dispatchDate2 = new Date('2023-10-01');
    const dueDate2 = new Date(dispatchDate2);
    dueDate2.setDate(dueDate2.getDate() + 15);

    const order2 = await prisma.order.create({
      data: {
        supplierId: createdSuppliers[1].id,
        amount: 1250.00,
        dispatchDate: dispatchDate2,
        creditDays: 15,
        dueDate: dueDate2,
        createdBy: adminUser.id
      }
    });

    const debt2 = await prisma.debt.create({
      data: {
        orderId: order2.id,
        supplierId: createdSuppliers[1].id,
        initialAmount: 1250.00,
        remainingAmount: 1000.00, // Ya tiene un pago parcial
        dueDate: dueDate2,
        status: 'PARTIALLY_PAID'
      }
    });

    // Crear un pago de ejemplo para Distribuidora Los Andes
    await prisma.payment.create({
      data: {
        debtId: debt2.id,
        supplierId: createdSuppliers[1].id,
        amount: 250.00,
        paymentMethod: 'ZELLE',
        senderName: 'Maria Rodriguez',
        confirmationNumber: '54892',
        paymentDate: new Date('2023-10-05'),
        verified: true,
        createdBy: adminUser.id
      }
    });

    // Actualizar total de deuda del proveedor
    await prisma.supplier.update({
      where: { id: createdSuppliers[1].id },
      data: {
        totalDebt: 1000.00,
        lastPaymentDate: new Date('2023-10-05')
      }
    });

    console.log(`✅ Pedido, deuda y pago creados para ${createdSuppliers[1].companyName}`);
  }

  console.log('✨ Seed completado exitosamente!');
  console.log('\n📝 Credenciales por defecto:');
  console.log('   Email: admin@vencedora.com | supervisor@vencedora.com | cajero1@vencedora.com');
  console.log('   Password: password123');
  console.log('\n📦 Datos de ejemplo creados:');
  console.log('   - 3 Proveedores');
  console.log('   - 2 Pedidos con deudas');
  console.log('   - 1 Pago de ejemplo');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

