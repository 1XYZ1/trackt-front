import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { TicketEstado } from '@prisma/client';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
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
  const ticketsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    asignar: jest.fn(),
    iniciar: jest.fn(),
    finalizar: jest.fn(),
    validar: jest.fn(),
    cerrar: jest.fn(),
  };
  const tenantService = {
    resolveTenantId: jest.fn((u: AuthUser) => u.tenantId),
  };
  const supabase = { getClient: jest.fn() };
  const profiles = { getById: jest.fn() };

  const builder = Test.createTestingModule({
    controllers: [TicketsController],
    providers: [
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

  return { builder, ticketsService, tenantService };
}

describe('TicketsController', () => {
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

  describe('GET /tickets (findAll)', () => {
    it('resuelve tenantId y pasa filtros normalizados (camelCase) al service', async () => {
      const { builder, ticketsService, tenantService } = buildModule({
        authGuardOverride: { canActivate: jest.fn(() => true) },
      });
      const moduleRef = await builder.compile();
      const controller = moduleRef.get(TicketsController);

      const paginated = {
        data: [],
        meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
      };
      ticketsService.findAll.mockResolvedValue(paginated);

      const req = { user: ADMIN } as unknown as Parameters<
        typeof controller.findAll
      >[0];
      const query = {
        page: 1,
        limit: 10,
        estado: TicketEstado.PENDIENTE,
        mecanicoId: 'mec-1',
        otId: 'ot-1',
      };

      const result = await controller.findAll(req, query);

      expect(tenantService.resolveTenantId).toHaveBeenCalledWith(ADMIN);
      expect(ticketsService.findAll).toHaveBeenCalledWith(TENANT, {
        page: 1,
        limit: 10,
        estado: TicketEstado.PENDIENTE,
        mecanicoId: 'mec-1',
        otId: 'ot-1',
      });
      expect(result).toBe(paginated);
    });

    it('acepta alias snake_case (mecanico_id, ot_id) y los mapea a camelCase para el service', async () => {
      const { builder, ticketsService } = buildModule({
        authGuardOverride: { canActivate: jest.fn(() => true) },
      });
      const moduleRef = await builder.compile();
      const controller = moduleRef.get(TicketsController);
      ticketsService.findAll.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
      });

      const req = { user: ADMIN } as unknown as Parameters<
        typeof controller.findAll
      >[0];
      const query = {
        page: 1,
        limit: 10,
        mecanico_id: 'mec-snake',
        ot_id: 'ot-snake',
      };

      await controller.findAll(req, query);

      expect(ticketsService.findAll).toHaveBeenCalledWith(TENANT, {
        page: 1,
        limit: 10,
        estado: undefined,
        mecanicoId: 'mec-snake',
        otId: 'ot-snake',
      });
    });

    it('camelCase tiene prioridad sobre snake_case si se pasan ambos', async () => {
      const { builder, ticketsService } = buildModule({
        authGuardOverride: { canActivate: jest.fn(() => true) },
      });
      const moduleRef = await builder.compile();
      const controller = moduleRef.get(TicketsController);
      ticketsService.findAll.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
      });

      const req = { user: ADMIN } as unknown as Parameters<
        typeof controller.findAll
      >[0];
      await controller.findAll(req, {
        mecanicoId: 'win',
        mecanico_id: 'lose',
        otId: 'win-ot',
        ot_id: 'lose-ot',
      });

      const call = ticketsService.findAll.mock.calls[0][1];
      expect(call.mecanicoId).toBe('win');
      expect(call.otId).toBe('win-ot');
    });
  });

  describe('GET /tickets/:id (findOne)', () => {
    it('busca por id usando el tenant del request', async () => {
      const { builder, ticketsService } = buildModule({
        authGuardOverride: { canActivate: jest.fn(() => true) },
      });
      const moduleRef = await builder.compile();
      const controller = moduleRef.get(TicketsController);
      const ticket = { id: 'tk-1', timeline: [] };
      ticketsService.findOne.mockResolvedValue(ticket);

      const req = { user: ADMIN } as unknown as Parameters<
        typeof controller.findOne
      >[0];
      const result = await controller.findOne(req, 'tk-1');

      expect(ticketsService.findOne).toHaveBeenCalledWith(TENANT, 'tk-1');
      expect(result).toBe(ticket);
    });

    it('aislamiento por tenant: pasa el tenantId del usuario al service', async () => {
      const otroUser: AuthUser = { ...ADMIN, tenantId: 'otro-tenant' };
      const { builder, ticketsService, tenantService } = buildModule({
        authGuardOverride: { canActivate: jest.fn(() => true) },
      });
      const moduleRef = await builder.compile();
      const controller = moduleRef.get(TicketsController);
      ticketsService.findOne.mockResolvedValue({ id: 'tk-1' });

      const req = { user: otroUser } as unknown as Parameters<
        typeof controller.findOne
      >[0];
      await controller.findOne(req, 'tk-1');

      expect(tenantService.resolveTenantId).toHaveBeenCalledWith(otroUser);
      expect(ticketsService.findOne).toHaveBeenCalledWith(
        'otro-tenant',
        'tk-1',
      );
    });
  });

  // ---------- Transiciones (API-04) ----------

  describe('POST /tickets/:id/asignar', () => {
    it('delega en service.asignar(tenantId, actor=req.user, id, dto)', async () => {
      const { builder, ticketsService } = buildModule({
        authGuardOverride: { canActivate: jest.fn(() => true) },
      });
      const moduleRef = await builder.compile();
      const controller = moduleRef.get(TicketsController);
      const ticket = { id: 'tk-1', estado: TicketEstado.ASIGNADO };
      ticketsService.asignar.mockResolvedValue(ticket);

      const req = { user: ADMIN } as unknown as Parameters<
        typeof controller.asignar
      >[0];
      const dto = { mecanicoId: 'mec-99' };
      const result = await controller.asignar(req, 'tk-1', dto);

      expect(ticketsService.asignar).toHaveBeenCalledWith(
        TENANT,
        ADMIN,
        'tk-1',
        dto,
      );
      expect(result).toBe(ticket);
    });

    it('RolesGuard rechaza al rol mechanic (solo admin asigna)', () => {
      const reflector = new Reflector();
      const guard = new RolesGuard(reflector);
      const ctx = {
        getHandler: () => TicketsController.prototype.asignar,
        getClass: () => TicketsController,
        switchToHttp: () => ({ getRequest: () => ({ user: MECHANIC }) }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(ctx)).toThrow();
    });

    it('RolesGuard permite admin', () => {
      const reflector = new Reflector();
      const guard = new RolesGuard(reflector);
      const ctx = {
        getHandler: () => TicketsController.prototype.asignar,
        getClass: () => TicketsController,
        switchToHttp: () => ({ getRequest: () => ({ user: ADMIN }) }),
      } as unknown as ExecutionContext;

      expect(guard.canActivate(ctx)).toBe(true);
    });
  });

  describe('POST /tickets/:id/iniciar', () => {
    it('delega en service.iniciar(tenantId, actor=req.user, id)', async () => {
      const { builder, ticketsService } = buildModule({
        authGuardOverride: { canActivate: jest.fn(() => true) },
      });
      const moduleRef = await builder.compile();
      const controller = moduleRef.get(TicketsController);
      ticketsService.iniciar.mockResolvedValue({
        id: 'tk-1',
        estado: TicketEstado.EN_EJECUCION,
      });

      const req = { user: MECHANIC } as unknown as Parameters<
        typeof controller.iniciar
      >[0];
      await controller.iniciar(req, 'tk-1');

      expect(ticketsService.iniciar).toHaveBeenCalledWith(
        TENANT,
        MECHANIC,
        'tk-1',
      );
    });

    it('RolesGuard rechaza admin (solo mechanic puede iniciar)', () => {
      const reflector = new Reflector();
      const guard = new RolesGuard(reflector);
      const ctx = {
        getHandler: () => TicketsController.prototype.iniciar,
        getClass: () => TicketsController,
        switchToHttp: () => ({ getRequest: () => ({ user: ADMIN }) }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(ctx)).toThrow();
    });
  });

  describe('POST /tickets/:id/finalizar', () => {
    it('delega en service.finalizar con tenant, actor, id y dto', async () => {
      const { builder, ticketsService } = buildModule({
        authGuardOverride: { canActivate: jest.fn(() => true) },
      });
      const moduleRef = await builder.compile();
      const controller = moduleRef.get(TicketsController);
      ticketsService.finalizar.mockResolvedValue({
        id: 'tk-1',
        estado: TicketEstado.EJECUTADO,
      });

      const req = { user: MECHANIC } as unknown as Parameters<
        typeof controller.finalizar
      >[0];
      const dto = { observacion: 'listo' };
      await controller.finalizar(req, 'tk-1', dto);

      expect(ticketsService.finalizar).toHaveBeenCalledWith(
        TENANT,
        MECHANIC,
        'tk-1',
        dto,
      );
    });

    it('RolesGuard rechaza admin (solo mechanic puede finalizar)', () => {
      const reflector = new Reflector();
      const guard = new RolesGuard(reflector);
      const ctx = {
        getHandler: () => TicketsController.prototype.finalizar,
        getClass: () => TicketsController,
        switchToHttp: () => ({ getRequest: () => ({ user: ADMIN }) }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(ctx)).toThrow();
    });
  });

  describe('POST /tickets/:id/validar', () => {
    it('aprobado=true: delega y service responde con estado CERRADO', async () => {
      const { builder, ticketsService } = buildModule({
        authGuardOverride: { canActivate: jest.fn(() => true) },
      });
      const moduleRef = await builder.compile();
      const controller = moduleRef.get(TicketsController);
      ticketsService.validar.mockResolvedValue({
        id: 'tk-1',
        estado: TicketEstado.CERRADO,
      });

      const req = { user: ADMIN } as unknown as Parameters<
        typeof controller.validar
      >[0];
      const dto = { aprobado: true };
      const res = await controller.validar(req, 'tk-1', dto);

      expect(ticketsService.validar).toHaveBeenCalledWith(
        TENANT,
        ADMIN,
        'tk-1',
        dto,
      );
      expect(res.estado).toBe(TicketEstado.CERRADO);
    });

    it('aprobado=false: service responde con estado EN_EJECUCION', async () => {
      const { builder, ticketsService } = buildModule({
        authGuardOverride: { canActivate: jest.fn(() => true) },
      });
      const moduleRef = await builder.compile();
      const controller = moduleRef.get(TicketsController);
      ticketsService.validar.mockResolvedValue({
        id: 'tk-1',
        estado: TicketEstado.EN_EJECUCION,
      });

      const req = { user: ADMIN } as unknown as Parameters<
        typeof controller.validar
      >[0];
      await controller.validar(req, 'tk-1', { aprobado: false });

      const callArgs = ticketsService.validar.mock.calls[0];
      expect(callArgs[3].aprobado).toBe(false);
    });

    it('RolesGuard rechaza mechanic (solo admin valida)', () => {
      const reflector = new Reflector();
      const guard = new RolesGuard(reflector);
      const ctx = {
        getHandler: () => TicketsController.prototype.validar,
        getClass: () => TicketsController,
        switchToHttp: () => ({ getRequest: () => ({ user: MECHANIC }) }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(ctx)).toThrow();
    });
  });
});
