import {
  LayoutDashboard,
  Truck,
  Wrench,
  ClipboardList,
  Ticket,
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
      title: 'General',
      items: [
        { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
        { title: 'Equipos', url: '/equipos', icon: Truck },
        { title: 'Mantenciones', url: '/mantenciones', icon: Wrench },
        { title: 'Ordenes', url: '/ordenes', icon: ClipboardList },
        { title: 'Tickets', url: '/tickets', icon: Ticket },
      ],
    },
    {
      title: 'Administracion',
      roles: ['admin'],
      items: [
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
