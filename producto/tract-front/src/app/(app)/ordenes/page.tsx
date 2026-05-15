import type { Metadata } from "next";
import { OrdenesClient } from "./ordenes-client";

export const metadata: Metadata = {
  title: "Ordenes de Trabajo 2 | Trackt",
  description:
    "Listado y trazabilidad de ordenes de trabajo: estados, SLA y responsables.",
};

export default function OrdenesPage() {
  return <OrdenesClient />;
}
