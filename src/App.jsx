import { startTransition, useDeferredValue, useEffect, useState } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import { reportData } from './data/reportData'

const sourceStyles = {
  Idealista: {
    dot: '#1f4f7f',
    pill: 'bg-sky-100 text-sky-800 ring-sky-900/10',
  },
  Spotahome: {
    dot: '#1f5f53',
    pill: 'bg-emerald-100 text-emerald-800 ring-emerald-900/10',
  },
}

const modeStyles = {
  base: 'bg-rose-100 text-rose-800 ring-rose-900/10',
  cerrado: 'bg-emerald-100 text-emerald-800 ring-emerald-900/10',
  variable: 'bg-amber-100 text-amber-800 ring-amber-900/10',
}

const currencyEuro = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

const currencyPeso = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
})

function cx(...values) {
  return values.filter(Boolean).join(' ')
}

function formatDistance(distance) {
  return `${distance.toFixed(2)} km`
}

function formatBeds(beds) {
  return beds === 0 ? 'Estudio' : beds ?? 'n/d'
}

function FitMapToListings({ listings }) {
  const map = useMap()

  useEffect(() => {
    const points = [
      [reportData.campus.lat, reportData.campus.lon],
      ...listings.map((item) => [item.lat, item.lon]),
    ]

    map.fitBounds(points, { padding: [36, 36], maxZoom: 13 })
  }, [listings, map])

  return null
}

function FilterButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'rounded-full px-4 py-2 text-sm font-semibold transition',
        active
          ? 'bg-slate-950 text-white shadow-lg shadow-slate-950/15'
          : 'bg-white/80 text-slate-600 ring-1 ring-slate-200 hover:bg-white hover:text-slate-950',
      )}
    >
      {children}
    </button>
  )
}

function StatCard({ label, value, note }) {
  return (
    <article className="rounded-[1.6rem] border border-white/70 bg-white/80 p-5 shadow-[0_20px_60px_rgba(49,38,20,0.08)] backdrop-blur">
      <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-extrabold leading-tight text-slate-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{note}</p>
    </article>
  )
}

function SpotlightCard({ title, item, accent }) {
  if (!item) {
    return null
  }

  return (
    <article className="rounded-[1.5rem] border border-slate-200/80 bg-white/85 p-4">
      <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-slate-400">{title}</p>
      <h3 className="mt-2 text-lg font-bold leading-tight text-slate-950">{item.title}</h3>
      <p className="mt-2 text-sm text-slate-500">{item.location_label}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className={cx('rounded-full px-3 py-1 text-sm font-semibold', accent)}>
          {currencyEuro.format(item.price_eur)}
        </span>
        <span className="text-sm font-medium text-slate-500">{formatDistance(item.distance_km)} al campus</span>
      </div>
    </article>
  )
}

function MapLegendChip({ tone, children }) {
  return (
    <span className={cx('inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1', tone)}>{children}</span>
  )
}

function ListingCard({ item }) {
  const sourceStyle = sourceStyles[item.source]
  const imageStyle = item.image_url
    ? {
        backgroundImage: `linear-gradient(180deg, rgba(10,15,22,0.05), rgba(10,15,22,0.2)), url("${item.image_url}")`,
      }
    : undefined

  return (
    <article className="overflow-hidden rounded-[1.8rem] border border-white/70 bg-white/90 shadow-[0_20px_60px_rgba(49,38,20,0.08)] backdrop-blur">
      <div className="grid gap-0 xl:grid-cols-[0.92fr_1.08fr]">
        <div
          className="min-h-72 bg-[linear-gradient(135deg,#dfe9e4,#e9edf5)] bg-cover bg-center"
          style={imageStyle}
        />
        <div className="flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex flex-wrap gap-2">
            <span
              className={cx(
                'inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1',
                sourceStyle.pill,
              )}
            >
              {item.source}
            </span>
            <span
              className={cx(
                'inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ring-1',
                modeStyles[item.cost_mode],
              )}
            >
              {item.cost_mode}
            </span>
            <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-900/5">
              {item.approximate ? 'ubicacion aproximada' : 'ubicacion precisa'}
            </span>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">#{item.rank}</p>
            <h3 className="mt-2 text-2xl font-bold leading-tight text-slate-950">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">{item.location_label}</p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <p className="text-3xl font-black text-slate-950">{currencyEuro.format(item.price_eur)}</p>
            <p className="pb-1 text-sm font-medium text-slate-500">{currencyPeso.format(item.price_mxn)}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-100/90 p-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">Dormitorios</p>
              <p className="mt-2 text-base font-semibold text-slate-900">{formatBeds(item.beds)}</p>
            </div>
            <div className="rounded-2xl bg-slate-100/90 p-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">Baños</p>
              <p className="mt-2 text-base font-semibold text-slate-900">{item.baths ?? 'n/d'}</p>
            </div>
            <div className="rounded-2xl bg-slate-100/90 p-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">Superficie</p>
              <p className="mt-2 text-base font-semibold text-slate-900">{item.area_sqm ? `${item.area_sqm} m²` : 'n/d'}</p>
            </div>
            <div className="rounded-2xl bg-slate-100/90 p-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">Distancia</p>
              <p className="mt-2 text-base font-semibold text-slate-900">{formatDistance(item.distance_km)}</p>
            </div>
          </div>

          <div className="space-y-3 text-sm leading-6 text-slate-600">
            <p>
              <span className="font-bold text-slate-900">Resumen:</span> {item.summary}
            </p>
            <p>
              <span className="font-bold text-slate-900">Servicios:</span> {item.service_notes}
            </p>
            <p>
              <span className="font-bold text-slate-900">Nota de costo:</span> {item.cost_note}
            </p>
          </div>

          <div className="mt-auto flex flex-wrap gap-3">
            <a
              className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              href={item.url}
              target="_blank"
              rel="noreferrer"
            >
              Abrir anuncio
            </a>
            <a
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
              href={item.maps_url}
              target="_blank"
              rel="noreferrer"
            >
              Ruta al campus
            </a>
          </div>
        </div>
      </div>
    </article>
  )
}

function App() {
  const [sourceFilter, setSourceFilter] = useState('all')
  const [modeFilter, setModeFilter] = useState('all')
  const [distanceFilter, setDistanceFilter] = useState('all')
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query.trim().toLowerCase())

  const filteredListings = reportData.listings.filter((item) => {
    const sourceMatch = sourceFilter === 'all' || item.source === sourceFilter
    const modeMatch = modeFilter === 'all' || item.cost_mode === modeFilter
    const distanceMatch =
      distanceFilter === 'all' ||
      (distanceFilter === 'near' && item.distance_km <= 2) ||
      (distanceFilter === 'walkable' && item.distance_km <= 1)
    const queryMatch =
      deferredQuery.length === 0 ||
      [item.title, item.location_label, item.summary, item.service_notes].some((field) =>
        field.toLowerCase().includes(deferredQuery),
      )

    return sourceMatch && modeMatch && distanceMatch && queryMatch
  })

  const cheapestVisible = filteredListings[0]
  const closestVisible = [...filteredListings].sort((a, b) => a.distance_km - b.distance_km)[0]
  const bestClosedVisible = filteredListings.find((item) => item.cost_mode === 'cerrado')
  const visibleBudget = filteredListings.filter((item) => item.within_budget).length
  const visibleAverage =
    filteredListings.length > 0
      ? filteredListings.reduce((sum, item) => sum + item.price_eur, 0) / filteredListings.length
      : 0

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(31,95,83,0.18),transparent_28rem),radial-gradient(circle_at_left_center,rgba(135,60,68,0.12),transparent_24rem),linear-gradient(180deg,#faf6ef_0%,#f4efe8_100%)] text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <header className="relative overflow-hidden rounded-[2.2rem] bg-[linear-gradient(135deg,rgba(16,47,43,0.98),rgba(31,79,127,0.92))] p-6 text-white shadow-[0_28px_80px_rgba(23,28,33,0.18)] sm:p-8 lg:p-10">
          <div className="absolute inset-y-0 right-0 hidden w-80 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.14),transparent_60%)] lg:block" />
          <div className="grid gap-8 lg:grid-cols-[1.3fr_0.9fr]">
            <div className="relative z-10">
              <p className="inline-flex rounded-full bg-white/12 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.24em] text-white/90 ring-1 ring-white/10">
                Camila Conde • intercambio en A Coruña
              </p>
              <h1 className="mt-5 max-w-xl font-display text-5xl leading-[0.94] text-balance sm:text-6xl lg:text-7xl">
                Presupuesto de Camila Conde
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-7 text-white/78 sm:text-lg">
                Comparativa real de 28 anuncios para el intercambio en la UDC. La app mantiene el mapa,
                costos en EUR y MXN, servicios y distancia al Campus de Elviña, pero ahora en una UI más
                limpia para revisar opciones, filtrar y abrir cada anuncio desde internet.
              </p>
              <div className="mt-6 flex flex-wrap gap-3 text-sm font-medium text-white/88">
                <span className="rounded-full bg-white/12 px-4 py-2 ring-1 ring-white/10">
                  1 EUR = {reportData.exchange.eur_to_mxn.toFixed(4)} MXN
                </span>
                <span className="rounded-full bg-white/12 px-4 py-2 ring-1 ring-white/10">
                  Campus con lineas UDC, 20, 22 y 24
                </span>
              </div>
            </div>

            <aside className="relative z-10 self-end rounded-[1.8rem] border border-white/10 bg-white/10 p-5 backdrop-blur-xl">
              <p className="text-sm font-extrabold uppercase tracking-[0.22em] text-white/60">Decision rapida</p>
              <div className="mt-4 grid gap-4">
                <SpotlightCard
                  title="Mas barato en el filtro actual"
                  item={cheapestVisible}
                  accent="bg-white/15 text-white"
                />
                <SpotlightCard
                  title="Mas cerca del campus"
                  item={closestVisible}
                  accent="bg-emerald-300/20 text-emerald-50"
                />
                <SpotlightCard
                  title="Costo cerrado mas competitivo"
                  item={bestClosedVisible}
                  accent="bg-amber-300/20 text-amber-50"
                />
              </div>
            </aside>
          </div>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Anuncios visibles"
            value={`${filteredListings.length} opciones`}
            note="Se actualiza con la busqueda y los filtros activos."
          />
          <StatCard
            label="Dentro del tope"
            value={`${visibleBudget} / ${filteredListings.length || 0}`}
            note={`Tope objetivo: ${currencyEuro.format(reportData.summary.budget_eur)} o ${currencyPeso.format(reportData.summary.budget_mxn)}.`}
          />
          <StatCard
            label="Promedio visible"
            value={filteredListings.length ? currencyEuro.format(visibleAverage) : 'Sin resultados'}
            note="Promedio simple del costo publicado de las opciones visibles."
          />
          <StatCard
            label="Referencia de campus"
            value="Elviña - UDC"
            note="La distancia compara cada anuncio contra la Facultade de Economia e Empresa."
          />
        </section>

        <section className="mt-6 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <article className="rounded-[2rem] border border-white/70 bg-white/82 p-5 shadow-[0_20px_60px_rgba(49,38,20,0.08)] backdrop-blur sm:p-6">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-400">Explorador</p>
                  <h2 className="mt-2 font-display text-3xl leading-tight text-slate-950">Filtra y compara</h2>
                </div>
                <p className="max-w-xl text-sm leading-6 text-slate-500">
                  Puedes quedarte con solo una fuente, revisar un tipo de costo o reducir a opciones cerca del
                  campus. Todo sigue ordenado por costo publicado.
                </p>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Buscar por titulo, zona o servicios</span>
                <input
                  value={query}
                  onChange={(event) => {
                    const nextValue = event.target.value
                    startTransition(() => {
                      setQuery(nextValue)
                    })
                  }}
                  placeholder="Ejemplo: Matogrande, estudio, wifi, terraza..."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-inner shadow-slate-200/40 outline-none transition focus:border-slate-950"
                />
              </label>

              <div className="grid gap-4 lg:grid-cols-3">
                <div>
                  <p className="mb-3 text-sm font-semibold text-slate-700">Fuente</p>
                  <div className="flex flex-wrap gap-2">
                    <FilterButton active={sourceFilter === 'all'} onClick={() => setSourceFilter('all')}>
                      Todas
                    </FilterButton>
                    <FilterButton active={sourceFilter === 'Idealista'} onClick={() => setSourceFilter('Idealista')}>
                      Idealista
                    </FilterButton>
                    <FilterButton active={sourceFilter === 'Spotahome'} onClick={() => setSourceFilter('Spotahome')}>
                      Spotahome
                    </FilterButton>
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-sm font-semibold text-slate-700">Costo</p>
                  <div className="flex flex-wrap gap-2">
                    <FilterButton active={modeFilter === 'all'} onClick={() => setModeFilter('all')}>
                      Todos
                    </FilterButton>
                    <FilterButton active={modeFilter === 'base'} onClick={() => setModeFilter('base')}>
                      Base
                    </FilterButton>
                    <FilterButton active={modeFilter === 'cerrado'} onClick={() => setModeFilter('cerrado')}>
                      Cerrado
                    </FilterButton>
                    <FilterButton active={modeFilter === 'variable'} onClick={() => setModeFilter('variable')}>
                      Variable
                    </FilterButton>
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-sm font-semibold text-slate-700">Distancia</p>
                  <div className="flex flex-wrap gap-2">
                    <FilterButton active={distanceFilter === 'all'} onClick={() => setDistanceFilter('all')}>
                      Cualquiera
                    </FilterButton>
                    <FilterButton active={distanceFilter === 'near'} onClick={() => setDistanceFilter('near')}>
                      Menos de 2 km
                    </FilterButton>
                    <FilterButton active={distanceFilter === 'walkable'} onClick={() => setDistanceFilter('walkable')}>
                      Menos de 1 km
                    </FilterButton>
                  </div>
                </div>
              </div>
            </div>
          </article>

          <article className="rounded-[2rem] border border-white/70 bg-white/82 p-5 shadow-[0_20px_60px_rgba(49,38,20,0.08)] backdrop-blur sm:p-6">
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-400">Metodologia</p>
            <h2 className="mt-2 font-display text-3xl leading-tight text-slate-950">Lo que si esta documentado</h2>
            <div className="mt-5 grid gap-4">
              <div className="rounded-2xl bg-slate-100/85 p-4">
                <p className="text-sm font-semibold text-slate-900">Universidad</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  La referencia del campus sale de{' '}
                  <a className="font-semibold text-slate-950 underline decoration-slate-300 underline-offset-4" href={reportData.campus.source_url} target="_blank" rel="noreferrer">
                    la UDC
                  </a>
                  . Las lineas mencionadas son UDC, 20, 22 y 24.
                </p>
              </div>
              <div className="rounded-2xl bg-slate-100/85 p-4">
                <p className="text-sm font-semibold text-slate-900">Tipo de cambio</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  1 EUR = {reportData.exchange.eur_to_mxn.toFixed(4)} MXN con fecha {reportData.exchange.date}.
                </p>
              </div>
              <div className="rounded-2xl bg-slate-100/85 p-4">
                <p className="text-sm font-semibold text-slate-900">Lectura correcta del costo</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Base significa renta sin cerrar suministros. Cerrado indica que el anuncio incluye o casi
                  incluye facturas. Variable marca precios que cambian por mes o duracion.
                </p>
              </div>
            </div>
          </article>
        </section>

        <section className="mt-6 grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          <article className="rounded-[2rem] border border-white/70 bg-white/88 p-3 shadow-[0_20px_60px_rgba(49,38,20,0.08)] backdrop-blur sm:p-4">
            <div className="mb-4 flex flex-col gap-2 px-2 pt-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-400">Mapa</p>
                <h2 className="mt-2 font-display text-3xl text-slate-950">Ubicacion de las opciones</h2>
              </div>
              <p className="max-w-xl text-sm leading-6 text-slate-500">
                Azul = Idealista, verde = Spotahome, rojo = Campus. Si una direccion no era publica, se uso el
                punto aproximado que si mostraba el anuncio.
              </p>
            </div>
            <div className="overflow-hidden rounded-[1.6rem] border border-slate-200/80">
              <MapContainer center={[reportData.campus.lat, reportData.campus.lon]} zoom={12} scrollWheelZoom={false} className="h-[520px] w-full">
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                  subdomains="abcd"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                />
                <FitMapToListings listings={filteredListings} />

                <CircleMarker
                  center={[reportData.campus.lat, reportData.campus.lon]}
                  radius={9}
                  pathOptions={{ color: '#873c44', fillColor: '#873c44', fillOpacity: 1, weight: 2 }}
                >
                  <Popup>
                    <div className="space-y-2">
                      <p className="font-semibold text-slate-950">{reportData.campus.name}</p>
                      <a href={reportData.campus.source_url} target="_blank" rel="noreferrer">
                        Fuente UDC
                      </a>
                    </div>
                  </Popup>
                </CircleMarker>

                {filteredListings.map((item) => (
                  <CircleMarker
                    key={item.id}
                    center={[item.lat, item.lon]}
                    radius={7}
                    pathOptions={{
                      color: sourceStyles[item.source].dot,
                      fillColor: sourceStyles[item.source].dot,
                      fillOpacity: 0.88,
                      weight: 2,
                    }}
                  >
                    <Popup>
                      <div className="max-w-60 space-y-2 text-sm text-slate-700">
                        <p className="font-semibold text-slate-950">{item.title}</p>
                        <p>{item.location_label}</p>
                        <p>{currencyEuro.format(item.price_eur)} • {formatDistance(item.distance_km)}</p>
                        <a href={item.url} target="_blank" rel="noreferrer">
                          Abrir anuncio
                        </a>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
          </article>

          <aside className="grid gap-4">
            <article className="rounded-[2rem] border border-white/70 bg-white/88 p-5 shadow-[0_20px_60px_rgba(49,38,20,0.08)] backdrop-blur">
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-400">Leyenda</p>
              <h2 className="mt-2 font-display text-3xl text-slate-950">Contexto rapido</h2>
              <div className="mt-5 flex flex-wrap gap-2">
                <MapLegendChip tone="bg-sky-100 text-sky-800 ring-sky-900/10">Idealista</MapLegendChip>
                <MapLegendChip tone="bg-emerald-100 text-emerald-800 ring-emerald-900/10">Spotahome</MapLegendChip>
                <MapLegendChip tone="bg-rose-100 text-rose-800 ring-rose-900/10">base</MapLegendChip>
                <MapLegendChip tone="bg-emerald-100 text-emerald-800 ring-emerald-900/10">cerrado</MapLegendChip>
                <MapLegendChip tone="bg-amber-100 text-amber-800 ring-amber-900/10">variable</MapLegendChip>
              </div>
              <div className="mt-5 space-y-4 text-sm leading-6 text-slate-600">
                <p>
                  El filtro actual deja <span className="font-bold text-slate-950">{filteredListings.length}</span>{' '}
                  opciones visibles.
                </p>
                <p>
                  <span className="font-bold text-slate-950">{visibleBudget}</span> caben en el tope de{' '}
                  {currencyPeso.format(reportData.summary.budget_mxn)}.
                </p>
                <p>
                  La distancia es una comparacion homogenea contra el campus, no tiempo real de bus o caminata.
                </p>
              </div>
            </article>

            <article className="rounded-[2rem] border border-white/70 bg-white/88 p-5 shadow-[0_20px_60px_rgba(49,38,20,0.08)] backdrop-blur">
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-400">Sugerencia</p>
              <h2 className="mt-2 font-display text-3xl text-slate-950">Primer corte recomendado</h2>
              <div className="mt-4 space-y-4 text-sm leading-6 text-slate-600">
                <p>
                  Si quieres reducir rapido: filtra a <span className="font-bold text-slate-950">menos de 2 km</span>{' '}
                  y compara primero Matogrande, Someso, O Picho y Mesoiro.
                </p>
                <p>
                  Si prefieres costos mas predecibles: revisa primero las opciones{' '}
                  <span className="font-bold text-slate-950">cerradas</span> de Spotahome.
                </p>
                <p>
                  Si buscas pagar menos: comienza por el ranking y abre los anuncios con mejor relacion precio-distancia.
                </p>
              </div>
            </article>
          </aside>
        </section>

        <section className="mt-6 rounded-[2rem] border border-white/70 bg-white/88 p-5 shadow-[0_20px_60px_rgba(49,38,20,0.08)] backdrop-blur sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-400">Ranking</p>
              <h2 className="mt-2 font-display text-3xl text-slate-950">Orden por costo publicado</h2>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-slate-500">
              El ranking siempre se mantiene ordenado por costo publicado. Si no ves algo, probablemente quedo
              fuera por el filtro actual.
            </p>
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">
                  <th className="px-3 py-3">#</th>
                  <th className="px-3 py-3">Anuncio</th>
                  <th className="px-3 py-3">Costo</th>
                  <th className="px-3 py-3">Distancia</th>
                  <th className="px-3 py-3">Tipo</th>
                  <th className="px-3 py-3">Fuente</th>
                </tr>
              </thead>
              <tbody className="text-sm text-slate-600">
                {filteredListings.map((item) => (
                  <tr key={`row-${item.id}`} className="border-b border-slate-100 align-top hover:bg-slate-50/70">
                    <td className="px-3 py-4 font-semibold text-slate-950">{item.rank}</td>
                    <td className="px-3 py-4">
                      <p className="font-semibold text-slate-950">{item.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.location_label}</p>
                    </td>
                    <td className="px-3 py-4">
                      <p className="font-semibold text-slate-950">{currencyEuro.format(item.price_eur)}</p>
                      <p className="mt-1 text-xs text-slate-500">{currencyPeso.format(item.price_mxn)}</p>
                    </td>
                    <td className="px-3 py-4">{formatDistance(item.distance_km)}</td>
                    <td className="px-3 py-4">
                      <span className={cx('inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ring-1', modeStyles[item.cost_mode])}>
                        {item.cost_mode}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <span className={cx('inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1', sourceStyles[item.source].pill)}>
                        {item.source}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-400">Fichas</p>
              <h2 className="mt-2 font-display text-3xl text-slate-950">Todas las opciones visibles</h2>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-slate-500">
              Cada ficha conserva imagen, resumen, servicios y enlaces reales a la publicacion y la ruta al campus.
            </p>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {filteredListings.map((item) => (
              <ListingCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export default App
