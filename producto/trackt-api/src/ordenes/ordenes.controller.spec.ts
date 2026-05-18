import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { OrdenTrabajoEstado, Prioridad } from '@prisma/client';
import { OrdenesController } from './ordenes.controller';
import { OrdenesService } from './ordenes.service';
import { TicketsService } from '../tickets/tickets.service';
import { TenantService } from '../common/tenant/tenant.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { SupabaseService } from '../supabase.service';
import { ProfileService } from '../auth/profile.service';
import { AuthUser } from '../auth/types';

const TENANT = 'tenant-1';

const ADMIN: AuthUser = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'admin@trackt.demo',
  role: 'admin',
  tenantId: TENANT,
};

const MECHANIC: AuthUser = {
  id: '00000000-0000-0000-0000-000000000002',
  email: 'mec@trackt.demo',
  role: 'mechanic',
  tenantId: TENANT,
};

function buildModule(opts?: {
  authGuardOverride?: { canActivate: jest.Mock | (() => boolean) };
}) {
  const ordenesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    cancelar: jest.fn(),
  };
  const ticketsService = {
    createFromOrden: jest.fn(),
  };
  const tenantService = {
    resolveTenantId: jest.fn((u: AuthUser) => u.tenantId),
  };
  const supabase = { getClient: jest.fn() };
  const profiles = { getById: jest.fn() };

  const builder = Test.createTestingModule({
    controllers: [OrdenesController],
    providers: [
      { provide: OrdenesService, useValue: ordenesService },
      { provide: TicketsService, useValue: ticketsService },
      { provide: TenantService, useValue: tenantService },
      { provide: SupabaseService, useValue: supabase },
      { provide: ProfileService, useValue: profiles },
      AuthGuard,
      RolesGuard,
      Reflector,
    ],
  });

  if (opts?.authGuardOverride) {
    builder.overrideGuard(AuthGuard).useValue(opts.authGuardOverride);
  }

  return {
    builder,
    ordenesService,
    ticketsService,
    tenantService,
    supabase,
    profiles,
  };
}

describe('OrdenesController', () => {
  describe('autenticación', () => {
    it('AuthGuard sin Authorization header → UnauthorizedException (401)', async () => {
      const { builder } = buildModule();
      const moduleRef = await builder.compile();
      const guard = moduleRef.get(AuthGuard);

      const ctx = {
        switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
      } as unknown as ExecutionContext;

      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('POST /ordenes (create)', () => {
    it('resuelve tenantId y delega en ordenesService.create con userId del request', async () => {
      const { builder, ordenesService, tenantService } = buildModule({
        authGuardOverride: { canActivate: jest.fn(() => true) },
      });
      const moduleRef = await builder.compile();
      const controller = moduleRef.get(OrdenesController);

      const ot = {
        id: 'ot-1',
        codigo: 'OT-2026-0001',
        estado: OrdenTrabajoEstado.PENDIENTE,
      };
      ordenesService.create.mockResolvedValue(ot);

      const dto = {
        equipoId: 'eq-1',
        descripcion: 'mant',
        prioridad: Prioridad.ALTA,
      };
      const req = { user: ADMIN } as unknown as Parameters<
        typeof controller.create
      >[0];

      const result = await controller.create(req, dto);

      expect(tenantService.resolveTenantId).toHaveBeenCalledWith(ADMIN);
      expect(ordenesService.create).toHaveBeenCalledWith(TENANT, ADMIN.id, dto);
      expect(result).toBe(ot);
    });
  });

  describe('GET /ordenes (findAll)', () => {
    it('pasa tenantId y query (estado/equipoId/paginación) al service', async () => {
      const { builder, ordenesService } = buildModule({
        authGuardOverride: { canActivate: jest.fn(() => true) },
      });
      const moduleRef = await builder.compile();
      const controller = moduleRef.get(OrdenesController);

      const paginated = {
        data: [],
        meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
      };
      ordenesService.findAll.mockResolvedValue(paginated);

      const req = { user: ADMIN } as unknown as Parameters<
        typeof controller.findAll
      >[0];
      const query = {
        page: 1,
        limit: 10,
        estado: OrdenTrabajoEstado.PENDIENTE,
        equipoId: 'eq-1',
      };

      const result = await controller.findAll(req, query);

      expect(ordenesService.findAll).toHaveBeenCalledWith(TENANT, query);
      expect(result).toBe(paginated);
    });
  });

  describe('GET /ordenes/:id (findOne)', () => {
    it('busca por id usando el tenant del request', async () => {
      const { builder, ordenesService } = buildModule({
        authGuardOverride: { canActivate: jest.fn(() => true) },
      });
      const moduleRef = await builder.compile();
      const controller = moduleRef.get(OrdenesController);
      ordenesService.findOne.mockResolvedValue({ id: 'ot-1', tickets: [] });

      const req = { user: ADMIN } as unknown as Parameters<
        typeof controller.findOne
      >[0];
      const result = await controller.findOne(req, 'ot-1');

      expect(ordenesService.findOne).toHaveBeenCalledWith(TENANT, 'ot-1');
      expect(result).toEqual({ id: 'ot-1', tickets: [] });
    });

    it('usuario de OTRO tenant: el service no expone la OT (NotFound se valida en service.spec)', async () => {
      // Aquí solo nos aseguramos que el controller propaga el tenantId resuelto.
      const otroUser: AuthUser = { ...ADMIN, tenantId: 'otro-tenant' };
      const { builder, ordenesService, tenantService } = buildModule({
        authGuardOverride: { canActivate: jest.fn(() => true) },
      });
      const moduleRef = await builder.compile();
      const controller = moduleRef.get(OrdenesController);
      ordenesService.findOne.mockResolvedValue({ id: 'ot-1' });

      const req = { user: otroUser } as unknown as Parameters<
        typeof controller.findOne
      >[0];
      await controller.findOne(req, 'ot-1');

      expect(tenantService.resolveTenantId).toHaveBeenCalledWith(otroUser);
      expect(ordenesService.findOne).toHaveBeenCalledWith(
        'otro-tenant',
        'ot-1',
      );
    });
  });

  describe('PATCH /ordenes/:id (update)', () => {
    it('delega update con tenant + dto', async () => {
      const { builder, ordenesService } = buildModule({
        authGuardOverride: { canActivate: jest.fn(() => true) },
      });
      const moduleRef = await builder.compile();
      const controller = moduleRef.get(OrdenesController);
      ordenesService.update.mockResolvedValue({ id: 'ot-1', descripcion: 'x' });

      const req = { user: ADMIN } as unknown as Parameters<
        typeof controller.update
      >[0];
      const dto = { descripcion: 'x', prioridad: Prioridad.BAJA };
      await controller.update(req, 'ot-1', dto);

      expect(ordenesService.update).toHaveBeenCalledWith(TENANT, 'ot-1', dto);
    });
  });

  describe('POST /ordenes/:id/cancelar', () => {
    it('delega cancelar con tenant + id', async () => {
      const { builder, ordenesService } = buildModule({
        authGuardOverride: { canActivate: jest.fn(() => true) },
      });
      const moduleRef = await builder.compile();
      const controller = moduleRef.get(OrdenesController);
      ordenesService.cancelar.mockResolvedValue({
        id: 'ot-1',
        estado: OrdenTrabajoEstado.CANCELADA,
      });

      const req = { user: ADMIN } as unknown as Parameters<
        typeof controller.cancelar
      >[0];
      const result = await controller.cancelar(req, 'ot-1');

      expect(ordenesService.cancelar).toHaveBeenCalledWith(TENANT, 'ot-1');
      expect(result.estado).toBe(OrdenTrabajoEstado.CANCELADA);
    });

    it('RolesGuard rechaza a mechanic (solo admin puede cancelar)', async () => {
      const { builder } = buildModule();
      const moduleRef = await builder.compile();
      const reflector = moduleRef.get(Reflector);
      const guard = new RolesGuard(reflector);

      // Mock del context para que getHandler() devuelva el método decorado
      // con @Roles('admin').
      const ctx = {
        getHandler: () => OrdenesController.prototype.cancelar,
        getClass: () => OrdenesController,
        switchToHttp: () => ({
          getRequest: () => ({ user: MECHANIC }),
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('RolesGuard permite a admin', () => {
      const reflector = new Reflector();
      const guard = new RolesGuard(reflector);
      const ctx = {
        getHandler: () => OrdenesController.prototype.cancelar,
        getClass: () => OrdenesController,
        switchToHttp: () => ({ getRequest: () => ({ user: ADMIN }) }),
      } as unknown as ExecutionContext;

      expect(guard.canActivate(ctx)).toBe(true);
    });
  });

  describe('POST /ordenes/:otId/tickets (createTicket)', () => {
    it('delega en ticketsService.createFromOrden con tenant + userId + otId', async () => {
      const { builder, ticketsService } = buildModule({
        authGuardOverride: { canActivate: jest.fn(() => true) },
      });
      const moduleRef = await builder.compile();
      const controller = moduleRef.get(OrdenesController);
      const ticket = { id: 'tk-1', codigo: 'TKT-2026-0001' };
      ticketsService.createFromOrden.mockResolvedValue(ticket);

      const req = { user: ADMIN } as unknown as Parameters<
        typeof controller.createTicket
      >[0];
      const dto = { titulo: 'Falla', descripcion: 'detalle' };

      const result = await controller.createTicket(req, 'ot-1', dto);

      expect(ticketsService.createFromOrden).toHaveBeenCalledWith(
        TENANT,
        ADMIN.id,
        'ot-1',
        dto,
      );
      expect(result).toBe(ticket);
    });
  });
});
