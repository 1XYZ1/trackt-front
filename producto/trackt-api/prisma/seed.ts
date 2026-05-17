/**
 * TRA-17 — Seed demo
 *
 * Pobla la DB con data realista para QA y demos en vivo.
 *
 * Requiere variables de entorno:
 *   - DATABASE_URL / DIRECT_URL (Prisma)
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * Re-ejecutable: usa UUIDs determinísticos + upserts.
 */
import { PrismaClient, Prioridad } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

type UserRole = 'admin' | 'mechanic';

interface SeedUser {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
}

const TENANT_ID = 'demo';
const TENANT_NOMBRE = 'Trackt Demo';
const PASSWORD = 'Trackt!2026';

const USERS: SeedUser[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'admin@trackt.demo',
    role: 'admin',
    fullName: 'Andrés Admin',
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'mecanico1@trackt.demo',
    role: 'mechanic',
    fullName: 'Pablo Pérez',
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    email: 'mecanico2@trackt.demo',
    role: 'mechanic',
    fullName: 'Marta Muñoz',
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    email: 'mecanico3@trackt.demo',
    role: 'mechanic',
    fullName: 'Diego Díaz',
  },
  {
    id: '00000000-0000-0000-0000-000000000005',
    email: 'mecanico4@trackt.demo',
    role: 'mechanic',
    fullName: 'Sofía Soto',
  },
];

const [ADMIN, MEC1, MEC2, MEC3, MEC4] = USERS;

const EQUIPOS = [
  {
    id: 'eq-demo-001',
    codigo: 'EQ-001',
    nombre: 'Camión Minero CA-22',
    marca: 'Caterpillar',
    modelo: '793F',
    ubicacion: 'Rajo principal',
  },
  {
    id: 'eq-demo-002',
    codigo: 'EQ-002',
    nombre: 'Cargador Frontal CL-08',
    marca: 'Komatsu',
    modelo: 'WA900',
    ubicacion: 'Acopio sur',
  },
  {
    id: 'eq-demo-003',
    codigo: 'EQ-003',
    nombre: 'LHD Subterránea LH-03',
    marca: 'Sandvik',
    modelo: 'LH517',
    ubicacion: 'Mina subterránea nivel 4',
  },
];

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

const ORDENES = [
  {
    id: 'ot-demo-1001',
    codigo: 'OT-1001',
    equipoId: 'eq-demo-001',
    descripcion: 'Mantenimiento preventivo 500h camión CA-22',
    prioridad: Prioridad.ALTA,
    estado: 'EN_PROCESO' as const,
    fechaCierre: null as Date | null,
  },
  {
    id: 'ot-demo-1002',
    codigo: 'OT-1002',
    equipoId: 'eq-demo-001',
    descripcion: 'Inspección visual de neumáticos y suspensión',
    prioridad: Prioridad.MEDIA,
    estado: 'PENDIENTE' as const,
    fechaCierre: null,
  },
  {
    id: 'ot-demo-1003',
    codigo: 'OT-1003',
    equipoId: 'eq-demo-002',
    descripcion: 'Cambio de filtros hidráulicos cargador CL-08',
    prioridad: Prioridad.ALTA,
    estado: 'EN_PROCESO' as const,
    fechaCierre: null,
  },
  {
    id: 'ot-demo-1004',
    codigo: 'OT-1004',
    equipoId: 'eq-demo-002',
    descripcion: 'Lubricación general y revisión de fugas',
    prioridad: Prioridad.BAJA,
    estado: 'PENDIENTE' as const,
    fechaCierre: null,
  },
  {
    id: 'ot-demo-1005',
    codigo: 'OT-1005',
    equipoId: 'eq-demo-003',
    descripcion: 'Overhaul LHD subterránea LH-03 ciclo completo',
    prioridad: Prioridad.MEDIA,
    estado: 'CERRADA' as const,
    fechaCierre: hoursAgo(2),
  },
];

const TICKETS = [
  // 2 PENDIENTE
  {
    id: 'tk-demo-2001',
    codigo: 'ITCM-2001',
    otId: 'ot-demo-1001',
    titulo: 'Revisar fuga hidráulica en línea principal',
    descripcion: 'Fuga reportada en inspección previa al turno mañana.',
    estado: 'PENDIENTE' as const,
    prioridad: Prioridad.ALTA,
    mecanicoId: null as string | null,
    jefeId: null as string | null,
    fechaAsignacion: null as Date | null,
    fechaInicioEjecucion: null as Date | null,
    fechaFinEjecucion: null as Date | null,
    fechaValidacion: null as Date | null,
    fechaCierre: null as Date | null,
  },
  {
    id: 'tk-demo-2002',
    codigo: 'ITCM-2002',
    otId: 'ot-demo-1002',
    titulo: 'Inspeccionar neumático delantero derecho',
    descripcion: 'Desgaste irregular detectado por operador.',
    estado: 'PENDIENTE' as const,
    prioridad: Prioridad.MEDIA,
    mecanicoId: null,
    jefeId: null,
    fechaAsignacion: null,
    fechaInicioEjecucion: null,
    fechaFinEjecucion: null,
    fechaValidacion: null,
    fechaCierre: null,
  },
  // 2 ASIGNADO
  {
    id: 'tk-demo-2003',
    codigo: 'ITCM-2003',
    otId: 'ot-demo-1001',
    titulo: 'Cambiar manguera hidráulica de pluma',
    descripcion: 'Manguera con desgaste superficial, prevenir falla.',
    estado: 'ASIGNADO' as const,
    prioridad: Prioridad.ALTA,
    mecanicoId: MEC1.id,
    jefeId: ADMIN.id,
    fechaAsignacion: hoursAgo(3),
    fechaInicioEjecucion: null,
    fechaFinEjecucion: null,
    fechaValidacion: null,
    fechaCierre: null,
  },
  {
    id: 'tk-demo-2004',
    codigo: 'ITCM-2004',
    otId: 'ot-demo-1003',
    titulo: 'Reemplazar filtro de retorno hidráulico',
    descripcion: 'Filtro próximo a vencimiento según horómetro.',
    estado: 'ASIGNADO' as const,
    prioridad: Prioridad.MEDIA,
    mecanicoId: MEC2.id,
    jefeId: ADMIN.id,
    fechaAsignacion: hoursAgo(2),
    fechaInicioEjecucion: null,
    fechaFinEjecucion: null,
    fechaValidacion: null,
    fechaCierre: null,
  },
  // 2 EN_EJECUCION
  {
    id: 'tk-demo-2005',
    codigo: 'ITCM-2005',
    otId: 'ot-demo-1003',
    titulo: 'Cambiar filtros de succión hidráulica',
    descripcion: 'Reemplazo programado, requiere fotos antes y después.',
    estado: 'EN_EJECUCION' as const,
    prioridad: Prioridad.ALTA,
    mecanicoId: MEC3.id,
    jefeId: ADMIN.id,
    fechaAsignacion: hoursAgo(5),
    fechaInicioEjecucion: hoursAgo(1),
    fechaFinEjecucion: null,
    fechaValidacion: null,
    fechaCierre: null,
  },
  {
    id: 'tk-demo-2006',
    codigo: 'ITCM-2006',
    otId: 'ot-demo-1004',
    titulo: 'Lubricar puntos de engrase chasis',
    descripcion: 'Rutina semanal de lubricación.',
    estado: 'EN_EJECUCION' as const,
    prioridad: Prioridad.BAJA,
    mecanicoId: MEC4.id,
    jefeId: ADMIN.id,
    fechaAsignacion: hoursAgo(4),
    fechaInicioEjecucion: hoursAgo(1),
    fechaFinEjecucion: null,
    fechaValidacion: null,
    fechaCierre: null,
  },
  // 1 EJECUTADO
  {
    id: 'tk-demo-2007',
    codigo: 'ITCM-2007',
    otId: 'ot-demo-1005',
    titulo: 'Inspeccionar tren de rodaje',
    descripcion: 'Verificar desgaste de rodillos y tensores.',
    estado: 'EJECUTADO' as const,
    prioridad: Prioridad.MEDIA,
    mecanicoId: MEC1.id,
    jefeId: ADMIN.id,
    fechaAsignacion: hoursAgo(24),
    fechaInicioEjecucion: hoursAgo(22),
    fechaFinEjecucion: hoursAgo(4),
    fechaValidacion: null,
    fechaCierre: null,
  },
  // 1 CERRADO
  {
    id: 'tk-demo-2008',
    codigo: 'ITCM-2008',
    otId: 'ot-demo-1005',
    titulo: 'Overhaul motor diésel etapa final',
    descripcion: 'Última fase del overhaul, listo para entrega.',
    estado: 'CERRADO' as const,
    prioridad: Prioridad.ALTA,
    mecanicoId: MEC2.id,
    jefeId: ADMIN.id,
    fechaAsignacion: hoursAgo(72),
    fechaInicioEjecucion: hoursAgo(70),
    fechaFinEjecucion: hoursAgo(10),
    fechaValidacion: hoursAgo(5),
    fechaCierre: hoursAgo(2),
  },
];

function validateEnv() {
  const required = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Faltan variables de entorno: ${missing.join(', ')}`);
  }
}

const prisma = new PrismaClient();
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function seedTenant() {
  await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    create: { id: TENANT_ID, nombre: TENANT_NOMBRE },
    update: { nombre: TENANT_NOMBRE },
  });
  console.log(`✓ Tenant "${TENANT_ID}" listo`);
}

async function seedUsers() {
  for (const u of USERS) {
    const { error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: u.fullName, role: u.role },
      // @ts-expect-error — supabase-js admin acepta `id` aunque el tipo no lo declare
      id: u.id,
    });

    if (error && !/already/i.test(error.message)) {
      throw new Error(`createUser ${u.email}: ${error.message}`);
    }

    await prisma.$executeRaw`
      INSERT INTO public.profiles (id, full_name, role, tenant_id)
      VALUES (${u.id}::uuid, ${u.fullName}, ${u.role}::user_role, ${TENANT_ID})
      ON CONFLICT (id) DO UPDATE
        SET full_name = EXCLUDED.full_name,
            role      = EXCLUDED.role,
            tenant_id = EXCLUDED.tenant_id,
            updated_at = NOW();
    `;
  }
  console.log(`✓ ${USERS.length} usuarios (1 admin, 4 mecánicos)`);
}

async function seedEquipos() {
  for (const eq of EQUIPOS) {
    await prisma.equipo.upsert({
      where: { tenantId_codigo: { tenantId: TENANT_ID, codigo: eq.codigo } },
      create: { ...eq, tenantId: TENANT_ID },
      update: { nombre: eq.nombre, marca: eq.marca, modelo: eq.modelo, ubicacion: eq.ubicacion },
    });
  }
  console.log(`✓ ${EQUIPOS.length} equipos`);
}

async function seedOrdenes() {
  for (const ot of ORDENES) {
    await prisma.ordenTrabajo.upsert({
      where: { tenantId_codigo: { tenantId: TENANT_ID, codigo: ot.codigo } },
      create: {
        id: ot.id,
        tenantId: TENANT_ID,
        codigo: ot.codigo,
        equipoId: ot.equipoId,
        descripcion: ot.descripcion,
        prioridad: ot.prioridad,
        estado: ot.estado,
        creadoPorId: ADMIN.id,
        fechaCierre: ot.fechaCierre,
      },
      update: {
        descripcion: ot.descripcion,
        prioridad: ot.prioridad,
        estado: ot.estado,
        fechaCierre: ot.fechaCierre,
      },
    });
  }
  console.log(`✓ ${ORDENES.length} órdenes de trabajo`);
}

async function seedTickets() {
  for (const t of TICKETS) {
    await prisma.ticket.upsert({
      where: { tenantId_codigo: { tenantId: TENANT_ID, codigo: t.codigo } },
      create: {
        id: t.id,
        tenantId: TENANT_ID,
        otId: t.otId,
        codigo: t.codigo,
        titulo: t.titulo,
        descripcion: t.descripcion,
        estado: t.estado,
        prioridad: t.prioridad,
        mecanicoId: t.mecanicoId,
        jefeId: t.jefeId,
        fechaAsignacion: t.fechaAsignacion,
        fechaInicioEjecucion: t.fechaInicioEjecucion,
        fechaFinEjecucion: t.fechaFinEjecucion,
        fechaValidacion: t.fechaValidacion,
        fechaCierre: t.fechaCierre,
      },
      update: {
        titulo: t.titulo,
        descripcion: t.descripcion,
        estado: t.estado,
        prioridad: t.prioridad,
        mecanicoId: t.mecanicoId,
        jefeId: t.jefeId,
        fechaAsignacion: t.fechaAsignacion,
        fechaInicioEjecucion: t.fechaInicioEjecucion,
        fechaFinEjecucion: t.fechaFinEjecucion,
        fechaValidacion: t.fechaValidacion,
        fechaCierre: t.fechaCierre,
      },
    });
  }
  console.log(
    `✓ ${TICKETS.length} tickets (2 PENDIENTE, 2 ASIGNADO, 2 EN_EJECUCION, 1 EJECUTADO, 1 CERRADO)`,
  );
}

async function seedEventos() {
  // Limpiar eventos previos del seed para no duplicar (no hay unique natural en este modelo)
  await prisma.eventoEstadoTicket.deleteMany({
    where: { ticket: { tenantId: TENANT_ID } },
  });

  type Evento = {
    ticketId: string;
    estadoAnterior: 'PENDIENTE' | 'ASIGNADO' | 'EN_EJECUCION' | 'EJECUTADO' | null;
    estadoNuevo: 'ASIGNADO' | 'EN_EJECUCION' | 'EJECUTADO' | 'CERRADO';
    usuarioId: string;
    observacion?: string;
    createdAt: Date;
  };

  const eventos: Evento[] = [
    // ITCM-2003 ASIGNADO
    { ticketId: 'tk-demo-2003', estadoAnterior: 'PENDIENTE', estadoNuevo: 'ASIGNADO', usuarioId: ADMIN.id, createdAt: hoursAgo(3) },
    // ITCM-2004 ASIGNADO
    { ticketId: 'tk-demo-2004', estadoAnterior: 'PENDIENTE', estadoNuevo: 'ASIGNADO', usuarioId: ADMIN.id, createdAt: hoursAgo(2) },
    // ITCM-2005 ASIGNADO -> EN_EJECUCION
    { ticketId: 'tk-demo-2005', estadoAnterior: 'PENDIENTE', estadoNuevo: 'ASIGNADO', usuarioId: ADMIN.id, createdAt: hoursAgo(5) },
    { ticketId: 'tk-demo-2005', estadoAnterior: 'ASIGNADO', estadoNuevo: 'EN_EJECUCION', usuarioId: MEC3.id, createdAt: hoursAgo(1) },
    // ITCM-2006 ASIGNADO -> EN_EJECUCION
    { ticketId: 'tk-demo-2006', estadoAnterior: 'PENDIENTE', estadoNuevo: 'ASIGNADO', usuarioId: ADMIN.id, createdAt: hoursAgo(4) },
    { ticketId: 'tk-demo-2006', estadoAnterior: 'ASIGNADO', estadoNuevo: 'EN_EJECUCION', usuarioId: MEC4.id, createdAt: hoursAgo(1) },
    // ITCM-2007 hasta EJECUTADO
    { ticketId: 'tk-demo-2007', estadoAnterior: 'PENDIENTE', estadoNuevo: 'ASIGNADO', usuarioId: ADMIN.id, createdAt: hoursAgo(24) },
    { ticketId: 'tk-demo-2007', estadoAnterior: 'ASIGNADO', estadoNuevo: 'EN_EJECUCION', usuarioId: MEC1.id, createdAt: hoursAgo(22) },
    { ticketId: 'tk-demo-2007', estadoAnterior: 'EN_EJECUCION', estadoNuevo: 'EJECUTADO', usuarioId: MEC1.id, observacion: 'Inspección completada, sin observaciones.', createdAt: hoursAgo(4) },
    // ITCM-2008 hasta CERRADO
    { ticketId: 'tk-demo-2008', estadoAnterior: 'PENDIENTE', estadoNuevo: 'ASIGNADO', usuarioId: ADMIN.id, createdAt: hoursAgo(72) },
    { ticketId: 'tk-demo-2008', estadoAnterior: 'ASIGNADO', estadoNuevo: 'EN_EJECUCION', usuarioId: MEC2.id, createdAt: hoursAgo(70) },
    { ticketId: 'tk-demo-2008', estadoAnterior: 'EN_EJECUCION', estadoNuevo: 'EJECUTADO', usuarioId: MEC2.id, observacion: 'Overhaul terminado, listo para validación.', createdAt: hoursAgo(10) },
    { ticketId: 'tk-demo-2008', estadoAnterior: 'EJECUTADO', estadoNuevo: 'CERRADO', usuarioId: ADMIN.id, observacion: 'Validado y entregado a operación.', createdAt: hoursAgo(2) },
  ];

  await prisma.eventoEstadoTicket.createMany({ data: eventos });
  console.log(`✓ ${eventos.length} eventos timeline`);
}

async function main() {
  validateEnv();
  console.log('Iniciando seed demo (TRA-17)...');
  await seedTenant();
  await seedUsers();
  await seedEquipos();
  await seedOrdenes();
  await seedTickets();
  await seedEventos();
  console.log('✓ Seed completado');
}

main()
  .catch((e) => {
    console.error('✗ Seed falló:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
