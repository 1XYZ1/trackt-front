'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SidebarMenu, SidebarMenuItem } from '@/components/ui/sidebar';
import type { User } from './types';

interface Props {
  user: User;
}

export function NavUser({ user }: Props) {
  const initials = (user.name || user.email).slice(0, 2).toUpperCase();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className="flex items-center gap-2 rounded-md p-2 text-sm">
          <Avatar className="h-8 w-8 rounded-lg">
            <AvatarImage src={user.avatar} alt={user.email} />
            <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
          </Avatar>
          <div className="grid flex-1 overflow-hidden text-left leading-tight">
            <span className="truncate font-semibold">
              {user.name || 'Usuario'}
            </span>
            <span className="truncate text-muted-foreground text-xs">
              {user.email}
            </span>
          </div>
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
