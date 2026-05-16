import type { Metadata } from "next";
import { TicketsClient, type TicketsSearchParams } from "./tickets-client";

type TicketsPageProps = {
  searchParams: Promise<TicketsSearchParams>;
};

export const metadata: Metadata = {
  title: "Tickets | Trackt",
  description:
    "Listado global de tickets de taller con filtros por estado, mecanico y OT.",
};

export default async function TicketsPage({ searchParams }: TicketsPageProps) {
  const params = await searchParams;

  return <TicketsClient initialFilters={params} />;
}
