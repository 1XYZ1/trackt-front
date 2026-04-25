export default function Dashboard() {
  return (
    <>
      {/* Título */}
      <section className="mb-8">
        <h3 className="text-3xl font-bold mb-2">Bienvenida a Trackt</h3>
        <p className="text-zinc-400">
          Resumen general del estado de equipos, mantenciones y alertas.
        </p>
      </section>

      {/* Cards resumen */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-zinc-400 text-sm">Equipos registrados</p>
          <p className="text-3xl font-bold mt-2">12</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-zinc-400 text-sm">Mantenciones pendientes</p>
          <p className="text-3xl font-bold mt-2">4</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-zinc-400 text-sm">Mantenciones completadas</p>
          <p className="text-3xl font-bold mt-2">8</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-zinc-400 text-sm">Alertas activas</p>
          <p className="text-3xl font-bold mt-2">2</p>
        </div>
      </section>

      {/* Secciones inferiores */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h4 className="text-xl font-semibold mb-4">Actividad reciente</h4>

          <div className="space-y-4">
            <div className="border-b border-zinc-800 pb-3">
              <p className="font-medium">Equipo agregado</p>
              <p className="text-sm text-zinc-400">
                Se registró una nueva excavadora.
              </p>
            </div>

            <div className="border-b border-zinc-800 pb-3">
              <p className="font-medium">Mantención actualizada</p>
              <p className="text-sm text-zinc-400">
                Se cambió el estado a pendiente.
              </p>
            </div>

            <div>
              <p className="font-medium">Alerta generada</p>
              <p className="text-sm text-zinc-400">
                Equipo requiere revisión preventiva.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h4 className="text-xl font-semibold mb-4">Mantenciones próximas</h4>

          <div className="space-y-4">
            <div className="flex justify-between border-b border-zinc-800 pb-3">
              <div>
                <p className="font-medium">Camión tolva</p>
                <p className="text-sm text-zinc-400">Cambio de aceite</p>
              </div>
              <span className="text-sm text-amber-400">Pendiente</span>
            </div>

            <div className="flex justify-between border-b border-zinc-800 pb-3">
              <div>
                <p className="font-medium">Excavadora</p>
                <p className="text-sm text-zinc-400">Revisión hidráulica</p>
              </div>
              <span className="text-sm text-amber-400">Pendiente</span>
            </div>

            <div className="flex justify-between">
              <div>
                <p className="font-medium">Grúa horquilla</p>
                <p className="text-sm text-zinc-400">Inspección general</p>
              </div>
              <span className="text-sm text-green-400">Programada</span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}