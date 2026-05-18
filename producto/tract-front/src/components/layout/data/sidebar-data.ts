import {
  LayoutDashboard,
  Truck,
  Wrench,
  ClipboardList,
  Ticket,
  CheckCircle2,
  Users,
  UserCog,
  Command,
} from 'lucide-react';
import type { SidebarData } from '../types';

export const sidebarData: SidebarData = {
  teams: [
    {
      name: 'Trackt',
      logo: Command,
      plan: 'Gestion de equipos',
    },
  ],
  navGroups: [
    {
      title: 'Mi trabajo',
      roles: ['mechanic'],
      items: [
        {
          title: 'Mis tickets',
          url: '/mis-tickets',
          icon: Ticket,
          roles: ['mechanic'],
        },
      ],
    },
    {
      title: 'General',
      roles: ['admin'],
      items: [
        {
          title: 'Dashboard',
          url: '/dashboard',
          icon: LayoutDashboard,
          roles: ['admin'],
        },
        {
          title: 'Equipos',
          url: '/equipos',
          icon: Truck,
          roles: ['admin'],
        },
        {
          title: 'Mantenciones',
          url: '/mantenciones',
          icon: Wrench,
          roles: ['admin'],
        },
        {
          title: 'Ordenes',
          url: '/ordenes',
          icon: ClipboardList,
          roles: ['admin'],
        },
        {
          title: 'Tickets',
          url: '/tickets',
          icon: Ticket,
          roles: ['admin'],
        },
      ],
    },
    {
      title: 'Administracion',
      roles: ['admin'],
      items: [
        {
          title: 'Pendientes de validar',
          url: '/tickets?estado=EJECUTADO',
          icon: CheckCircle2,
          roles: ['admin'],
        },
        { title: 'Usuarios', url: '/usuarios', icon: Users, roles: ['admin'] },
      ],
    },
    {
      title: 'Cuenta',
      items: [
        { title: 'Mi perfil', url: '/configuracion/perfil', icon: UserCog },
      ],
    },
  ],
};
