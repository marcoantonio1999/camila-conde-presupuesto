import { startTransition, useDeferredValue, useEffect, useState } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import { idealistaMeta } from './data/idealistaMeta'
import { planningData } from './data/planningData'
import { reportData } from './data/reportData'
import { spotahomeMeta } from './data/spotahomeMeta'

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

const availabilityStyles = {
  ready: 'bg-emerald-100 text-emerald-800 ring-emerald-900/10',
  caution: 'bg-amber-100 text-amber-800 ring-amber-900/10',
  blocked: 'bg-rose-100 text-rose-800 ring-rose-900/10',
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

const dateFormatter = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

function convertToMxn(amount) {
  return amount * reportData.exchange.eur_to_mxn
}

function convertFromMxn(amount) {
  return amount / reportData.exchange.eur_to_mxn
}

function formatMoneyBoth(amount) {
  return `${currencyEuro.format(amount)} · ${currencyPeso.format(convertToMxn(amount))}`
}

const academicMonths = [
  { key: 'sep', label: 'sep 2026' },
  { key: 'oct', label: 'oct 2026' },
  { key: 'nov', label: 'nov 2026' },
  { key: 'dec', label: 'dic 2026' },
  { key: 'jan', label: 'ene 2027' },
  { key: 'feb', label: 'feb 2027' },
  { key: 'mar', label: 'mar 2027' },
  { key: 'apr', label: 'abr 2027' },
  { key: 'may', label: 'may 2027' },
  { key: 'jun', label: 'jun 2027' },
  { key: 'jul', label: 'jul 2027' },
  { key: 'aug', label: 'ago 2027' },
]

function haversineKm(lat1, lon1, lat2, lon2) {
  const radius = 6371
  const toRadians = (value) => (value * Math.PI) / 180
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)
  const phi1 = toRadians(lat1)
  const phi2 = toRadians(lat2)

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLon / 2) ** 2

  return 2 * radius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function cx(...values) {
  return values.filter(Boolean).join(' ')
}

function formatDistance(distance) {
  return `${distance.toFixed(2)} km`
}

function formatBeds(beds) {
  return beds === 0 ? 'Estudio' : beds ?? 'n/d'
}

function formatDate(value) {
  if (!value) {
    return 'Por confirmar'
  }

  return dateFormatter.format(new Date(`${value}T00:00:00`))
}

function spotPhotoUrl(photoId) {
  return `https://photos.spotahome.com/fsobscale_1600_900_nonverified_ur_15_50/${photoId}.webp`
}

function compareAnnualThenDistance(left, right) {
  if (left.annualRecurringTotal !== right.annualRecurringTotal) {
    return left.annualRecurringTotal - right.annualRecurringTotal
  }

  return left.distance_km - right.distance_km
}

function getUtilityBaseline(item) {
  if (item.beds === 0 || item.beds === 1 || item.beds == null) {
    return { ...planningData.utilities.baselines.compact }
  }

  if (item.beds === 2) {
    return { ...planningData.utilities.baselines.medium }
  }

  return { ...planningData.utilities.baselines.large }
}

function getUtilityEstimate(item) {
  const note = `${item.service_notes} ${item.cost_note}`.toLowerCase()
  const baseline = getUtilityBaseline(item)
  const breakdown = { ...baseline }
  const reasons = []

  const setAllIncluded = /todos los gastos est[aá]n incluidos|facturas incluidas/.test(note)

  if (setAllIncluded) {
    breakdown.electricity = 0
    breakdown.gas = 0
    breakdown.water = 0
    breakdown.internet = 0
    reasons.push('La ficha se comporta como costo cerrado.')
  }

  if (/electricidad: incluido hasta|luz hasta un l[ií]mite|electricidad \(con restricciones\)|electricidad y gas pueden tener limitaciones/.test(note)) {
    breakdown.electricity = planningData.utilities.cappedBuffers.electricity
  } else if (/electricidad: incluido|incluye .*luz/.test(note) || setAllIncluded) {
    breakdown.electricity = 0
  }

  if (/agua: incluido|incluye .*agua/.test(note) || setAllIncluded) {
    breakdown.water = 0
  }

  if (/gas: no hay gas/.test(note)) {
    breakdown.gas = 0
  } else if (/gas: incluido hasta|gas \(con restricciones\)/.test(note)) {
    breakdown.gas = planningData.utilities.cappedBuffers.gas
  } else if (/gas: incluido/.test(note) || setAllIncluded) {
    breakdown.gas = 0
  }

  if (/wifi: incluido|internet: incluido|incluye televisi[oó]n por cable, internet|menciona internet/.test(note) || (setAllIncluded && baseline.internet > 0)) {
    breakdown.internet = 0
  }

  if (/no se anuncian suministros incluidos/.test(note)) {
    reasons.push('La ficha no cierra suministros; se usa estimacion completa.')
  }

  if (/gastos de comunidad incluidos/.test(note)) {
    reasons.push('La comunidad ya va absorbida en la renta.')
  }

  if (/gas natural individual/.test(note)) {
    reasons.push('Hay consumo de gas separado del alquiler.')
  }

  const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0)
  const includedCount = Object.entries(baseline).reduce(
    (sum, [key, value]) => sum + (breakdown[key] < value ? 1 : 0),
    0,
  )

  return {
    baseline,
    breakdown,
    total,
    annualTotal: total * 12,
    includedCount,
    reasons,
  }
}

function getTransportEstimate(distanceKm) {
  const band =
    planningData.transport.rideBands.find((entry) => distanceKm <= entry.maxKm) ??
    planningData.transport.rideBands.at(-1)
  const monthly = band.ridesPerMonth * planningData.transport.farePerRideEur
  const annual =
    monthly * planningData.transport.activeMonths +
    monthly * planningData.transport.lightMonthFactor

  return {
    ...band,
    monthly,
    annual,
  }
}

function getRentSchedule(item, meta) {
  if (meta?.priceType === 'byMonth' && meta.pricesByMonth) {
    return academicMonths.map((month) => ({
      ...month,
      rent: meta.pricesByMonth[month.key] ?? item.price_eur,
    }))
  }

  return academicMonths.map((month) => ({
    ...month,
    rent: item.price_eur,
  }))
}

function getDepositMonths(item) {
  if (/dos meses de fianza/i.test(item.source_note)) {
    return 2
  }

  return 1
}

function getAvailability(item, meta) {
  if (meta?.availableFrom) {
    if (meta.availableFrom <= planningData.academicYear.start) {
      return {
        status: 'ready',
        label: 'sirve para septiembre 2026',
        ready: true,
      }
    }

    return {
      status: 'blocked',
      label: `disponible desde ${formatDate(meta.availableFrom)}`,
      ready: false,
    }
  }

  return {
    status: 'caution',
    label: 'disponibilidad no publicada',
    ready: null,
  }
}

function getStartupEstimate(item, firstMonthRent) {
  const depositMonths = getDepositMonths(item)
  const arrivalDays =
    item.source === 'Idealista'
      ? planningData.arrival.idealistaDaysEarly
      : planningData.arrival.onlineDaysEarly
  const temporaryStay = arrivalDays * planningData.arrival.nightlyBufferEur

  return {
    depositMonths,
    arrivalDays,
    temporaryStay,
    firstMonthRent,
    cashNeeded: firstMonthRent * (1 + depositMonths) + temporaryStay,
  }
}

function getRequirements(item, meta, availability) {
  const lines = []

  if (item.source === 'Idealista') {
    if (/m[ií]nimo un a[nñ]o/i.test(item.source_note)) {
      lines.push('La ficha esta orientada a contrato de 12 meses.')
    }

    if (/estancia m[ií]nima de 31 d[ií]as/i.test(item.source_note)) {
      lines.push('La ficha publica estancia minima de 31 dias.')
    }

    if (/menores de 6 meses/i.test(item.service_notes)) {
      lines.push('Si la estancia baja de 6 meses, el precio cambia y hay que consultarlo.')
    }

    if (/dos meses de fianza/i.test(item.source_note)) {
      lines.push('El anuncio publica dos meses de fianza.')
    } else {
      lines.push('Como minimo presupuesté una fianza recuperable de un mes.')
    }

    lines.push('Disponibilidad exacta no publicada: conviene escribir y pedir visita antes de volar.')
    return lines
  }

  lines.push(`Disponible desde ${formatDate(meta?.availableFrom)}.`)

  if (meta?.minDays) {
    lines.push(`Acepta reservas desde ${meta.minDays} dias.`)
  }

  if (meta?.maxDays) {
    lines.push(`La ficha publica un maximo de ${meta.maxDays} dias.`)
  }

  if (meta?.landlordName) {
    lines.push(`Gestor o anfitrion publicado: ${meta.landlordName}.`)
  }

  lines.push(meta?.petFriendly ? 'Admite mascotas.' : 'No admite mascotas.')
  lines.push(meta?.smokingAllowed ? 'Permite fumar.' : 'No permite fumar.')

  if (meta?.couplesAllowed) {
    lines.push('La ficha indica que acepta parejas.')
  }

  if (availability.ready === false) {
    lines.push('No sirve para entrar en septiembre de 2026 sin buscar alojamiento puente.')
  }

  lines.push('La tarifa/plataforma de Spotahome no se suma al total porque la ficha no publica un importe fijo.')
  return lines
}

function getPhotoGallery(item, meta) {
  if (meta?.photoUrls?.length) {
    return {
      photos: meta.photoUrls,
      capturedCount: meta.photoUrls.length,
      totalCount: meta.photoUrls.length,
      note:
        meta.photoUrls.length > 1
          ? `Galeria real capturada desde Idealista: ${meta.photoUrls.length} fotos visibles del anuncio.`
          : 'Solo se pudo capturar una foto real de Idealista en esta sesion.',
    }
  }

  if (meta?.photoIds?.length) {
    return {
      photos: meta.photoIds.map(spotPhotoUrl),
      capturedCount: meta.photoIds.length,
      totalCount: meta.photoCount,
      note:
        meta.photoCount > meta.photoIds.length
          ? `Se capturaron ${meta.photoIds.length} de ${meta.photoCount} fotos publicas de Spotahome.`
          : `Galeria publica capturada: ${meta.photoCount} fotos.`,
    }
  }

  if (item.image_url) {
    return {
      photos: [item.image_url],
      capturedCount: 1,
      totalCount: 1,
      note:
        item.source === 'Idealista'
          ? 'En esta extraccion Idealista deja visible la foto principal; abre el anuncio para ver la galeria completa.'
          : 'Solo se pudo capturar una imagen publica.',
    }
  }

  return {
    photos: [],
    capturedCount: 0,
    totalCount: 0,
    note: 'La ficha no expone fotos publicas reutilizables.',
  }
}

function getExchangeBudget() {
  const visaFee = convertFromMxn(planningData.exchange.visaFeeMxn)
  const documentsBuffer = convertFromMxn(planningData.exchange.documentsBufferMxn)
  const medicalInsuranceAnnual = planningData.exchange.medicalInsuranceMonthlyEur * 12
  const settlementFees =
    planningData.exchange.tieFeeEur + planningData.exchange.udcAccidentInsuranceEur
  const fixedAcademicTotal =
    visaFee +
    documentsBuffer +
    medicalInsuranceAnnual +
    planningData.exchange.flightRoundTripEur +
    settlementFees

  return {
    visaFee,
    documentsBuffer,
    medicalInsuranceAnnual,
    settlementFees,
    fixedAcademicTotal,
    preDepartureTotal:
      visaFee +
      documentsBuffer +
      medicalInsuranceAnnual +
      planningData.exchange.flightRoundTripEur,
    firstMonthLandingTotal:
      visaFee +
      documentsBuffer +
      medicalInsuranceAnnual +
      planningData.exchange.flightRoundTripEur +
      settlementFees,
  }
}

function enrichListing(item, campus, exchangeBudget) {
  const meta = item.source === 'Spotahome' ? spotahomeMeta[item.id] : idealistaMeta[item.id]
  const distance_km = haversineKm(item.lat, item.lon, campus.lat, campus.lon)
  const maps_url =
    'https://www.google.com/maps/dir/?api=1' +
    `&origin=${item.lat},${item.lon}` +
    `&destination=${campus.lat},${campus.lon}`
  const rentSchedule = getRentSchedule(item, meta)
  const annualRent = rentSchedule.reduce((sum, month) => sum + month.rent, 0)
  const averageMonthlyRent = annualRent / rentSchedule.length
  const utilities = getUtilityEstimate(item)
  const transport = getTransportEstimate(distance_km)
  const availability = getAvailability(item, meta)
  const startup = getStartupEstimate(item, rentSchedule[0].rent)
  const gallery = getPhotoGallery(item, meta)
  const requirementLines = getRequirements(item, meta, availability)
  const monthlyAverageTotal = averageMonthlyRent + utilities.total + transport.annual / 12
  const annualRecurringTotal = annualRent + utilities.annualTotal + transport.annual
  const allInAnnualTotal = annualRecurringTotal + exchangeBudget.fixedAcademicTotal
  const allInMonthlyAverage = allInAnnualTotal / 12
  const allInStartupTotal = startup.cashNeeded + exchangeBudget.firstMonthLandingTotal
  const predictableScore =
    (item.cost_mode !== 'base' ? 2 : 0) +
    utilities.includedCount +
    (availability.ready === true ? 1 : 0)
  const pricingProfile =
    meta?.priceType === 'byMonth'
      ? `Renta variable: sep ${currencyEuro.format(rentSchedule[0].rent)}, oct ${currencyEuro.format(rentSchedule[1].rent)}, jul ${currencyEuro.format(rentSchedule[10].rent)} y ago ${currencyEuro.format(rentSchedule[11].rent)}.`
      : `Renta estable para el anio completo: ${currencyEuro.format(item.price_eur)} al mes.`

  return {
    ...item,
    meta,
    distance_km,
    maps_url,
    rentSchedule,
    annualRent,
    averageMonthlyRent,
    utilities,
    transport,
    availability,
    startup,
    gallery,
    requirementLines,
    monthlyAverageTotal,
    annualRecurringTotal,
    allInAnnualTotal,
    allInMonthlyAverage,
    allInStartupTotal,
    predictableScore,
    pricingProfile,
  }
}

function pickScenario(candidates, chosenIds) {
  const next = candidates.find((item) => !chosenIds.has(item.id))

  if (next) {
    chosenIds.add(next.id)
  }

  return next ?? null
}

function buildRecommendedScenarios(listings) {
  const usable = listings
    .filter((item) => item.availability.ready !== false)
    .slice()
    .sort(compareAnnualThenDistance)
  const chosenIds = new Set()

  const economy = pickScenario(usable, chosenIds)
  const balanced = pickScenario(
    usable.filter((item) => item.distance_km <= 1.5).sort(compareAnnualThenDistance),
    chosenIds,
  )
  const predictable = pickScenario(
    usable.filter((item) => item.predictableScore >= 5).sort(compareAnnualThenDistance),
    chosenIds,
  )

  return [
    {
      id: 'economy',
      title: 'Presupuesto ajustado',
      kicker: 'minimo recurrente',
      description:
        'La opcion mas barata para sostener el anio completo aun asumiendo servicios, desplazamientos y caja inicial realista.',
      item: economy,
    },
    {
      id: 'balanced',
      title: 'Presupuesto equilibrado',
      kicker: 'precio + cercania',
      description:
        'El mejor punto medio para llegar a Arquitectura con poco traslado y sin disparar la renta total del curso.',
      item: balanced,
    },
    {
      id: 'predictable',
      title: 'Presupuesto predecible',
      kicker: 'menos sorpresas',
      description:
        'Prioriza fichas con mas gasto cerrado o mejor visibilidad de reglas, incluso si no son las mas baratas por renta base.',
      item: predictable,
    },
  ]
}

function FitMapToListings({ campus, listings }) {
  const map = useMap()

  useEffect(() => {
    const points = [
      [campus.lat, campus.lon],
      ...listings.map((item) => [item.lat, item.lon]),
    ]

    map.fitBounds(points, { padding: [36, 36], maxZoom: 13 })
  }, [campus.lat, campus.lon, listings, map])

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

function MoneyStack({ amount, euroClass = 'text-2xl font-extrabold text-slate-950', pesoClass = 'mt-1 text-sm font-semibold text-slate-500' }) {
  return (
    <div>
      <p className={euroClass}>{currencyEuro.format(amount)}</p>
      <p className={pesoClass}>{currencyPeso.format(convertToMxn(amount))}</p>
    </div>
  )
}

function MapLegendChip({ tone, children }) {
  return (
    <span className={cx('inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1', tone)}>
      {children}
    </span>
  )
}

function ScenarioCard({ scenario, exchangeBudget }) {
  if (!scenario.item) {
    return null
  }

  return (
    <article className="rounded-[1.7rem] border border-white/10 bg-white/10 p-5 backdrop-blur-xl">
      <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-white/58">{scenario.kicker}</p>
      <h3 className="mt-2 text-2xl font-bold leading-tight text-white">{scenario.title}</h3>
      <p className="mt-3 text-sm leading-6 text-white/78">{scenario.description}</p>
      <div className="mt-5 rounded-[1.4rem] border border-white/10 bg-white/12 p-4">
        <p className="text-sm font-semibold text-white/80">{scenario.item.title}</p>
        <p className="mt-1 text-sm text-white/60">{scenario.item.location_label}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-white/50">
              Intercambio completo
            </p>
            <MoneyStack
              amount={scenario.item.allInAnnualTotal}
              euroClass="mt-2 text-lg font-bold text-white"
              pesoClass="mt-1 text-xs font-semibold text-white/70"
            />
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-white/50">
              Caja para salir
            </p>
            <MoneyStack
              amount={scenario.item.allInStartupTotal}
              euroClass="mt-2 text-lg font-bold text-white"
              pesoClass="mt-1 text-xs font-semibold text-white/70"
            />
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-white/72">
          Vivienda + servicios + transporte: {formatMoneyBoth(scenario.item.annualRecurringTotal)}/anio.
          Fijo comun UNAM→UDC: {formatMoneyBoth(exchangeBudget.fixedAcademicTotal)}/anio.
        </p>
      </div>
    </article>
  )
}

function ListingCarousel({ item }) {
  const [index, setIndex] = useState(0)
  const totalSlides = item.gallery.photos.length

  if (totalSlides === 0) {
    return <div className="min-h-80 bg-[linear-gradient(135deg,#dfe9e4,#e9edf5)]" />
  }

  const currentPhoto = item.gallery.photos[index]

  return (
    <div className="relative min-h-80 overflow-hidden bg-slate-200">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(10,15,22,0.06), rgba(10,15,22,0.28)), url("${currentPhoto}")`,
        }}
      />

      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
        <span className="rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white">
          {index + 1} / {item.gallery.capturedCount}
          {item.gallery.totalCount > item.gallery.capturedCount ? ` de ${item.gallery.totalCount}` : ''}
        </span>
        <span className="rounded-full bg-white/88 px-3 py-1 text-xs font-semibold text-slate-700">
          {item.source}
        </span>
      </div>

      {totalSlides > 1 && (
        <>
          <button
            type="button"
            onClick={() => setIndex((previous) => (previous - 1 + totalSlides) % totalSlides)}
            className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl font-bold text-slate-900 shadow-xl transition hover:bg-white"
            aria-label="Foto anterior"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setIndex((previous) => (previous + 1) % totalSlides)}
            className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl font-bold text-slate-900 shadow-xl transition hover:bg-white"
            aria-label="Foto siguiente"
          >
            ›
          </button>
        </>
      )}

      {totalSlides > 1 && (
        <div className="absolute inset-x-0 bottom-4 flex justify-center gap-2 px-4">
          {item.gallery.photos.map((photo, photoIndex) => (
            <button
              key={`${item.id}-photo-${photo}`}
              type="button"
              onClick={() => setIndex(photoIndex)}
              className={cx(
                'h-2.5 w-8 rounded-full transition',
                photoIndex === index ? 'bg-white' : 'bg-white/45 hover:bg-white/70',
              )}
              aria-label={`Ir a foto ${photoIndex + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ListingCard({ item }) {
  const sourceStyle = sourceStyles[item.source]

  return (
    <article className="overflow-hidden rounded-[1.8rem] border border-white/70 bg-white/90 shadow-[0_20px_60px_rgba(49,38,20,0.08)] backdrop-blur">
      <div className="grid gap-0 xl:grid-cols-[0.92fr_1.08fr]">
        <ListingCarousel key={`${item.id}-${item.gallery.capturedCount}`} item={item} />

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
            <span
              className={cx(
                'inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1',
                availabilityStyles[item.availability.status],
              )}
            >
              {item.availability.label}
            </span>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">#{item.rank}</p>
            <h3 className="mt-2 text-2xl font-bold leading-tight text-slate-950">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">{item.location_label}</p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <MoneyStack
              amount={item.monthlyAverageTotal}
              euroClass="text-3xl font-black text-slate-950"
              pesoClass="mt-1 text-sm font-semibold text-slate-500"
            />
            <p className="pb-1 text-sm font-medium text-slate-500">mes comparable real</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-100/90 p-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">Dormitorios</p>
              <p className="mt-2 text-base font-semibold text-slate-900">{formatBeds(item.beds)}</p>
            </div>
            <div className="rounded-2xl bg-slate-100/90 p-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">Banos</p>
              <p className="mt-2 text-base font-semibold text-slate-900">{item.baths ?? 'n/d'}</p>
            </div>
            <div className="rounded-2xl bg-slate-100/90 p-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">Superficie</p>
              <p className="mt-2 text-base font-semibold text-slate-900">
                {item.area_sqm ? `${item.area_sqm} m²` : 'n/d'}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-100/90 p-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">Distancia</p>
              <p className="mt-2 text-base font-semibold text-slate-900">{formatDistance(item.distance_km)}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">Renta anual</p>
              <MoneyStack
                amount={item.annualRent}
                euroClass="mt-2 text-lg font-bold text-slate-950"
                pesoClass="mt-1 text-xs font-semibold text-slate-500"
              />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">
                Vivienda + servicios + bus
              </p>
              <MoneyStack
                amount={item.annualRecurringTotal}
                euroClass="mt-2 text-lg font-bold text-slate-950"
                pesoClass="mt-1 text-xs font-semibold text-slate-500"
              />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">
                Intercambio completo
              </p>
              <MoneyStack
                amount={item.allInAnnualTotal}
                euroClass="mt-2 text-lg font-bold text-slate-950"
                pesoClass="mt-1 text-xs font-semibold text-slate-500"
              />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">
                Caja total de salida
              </p>
              <MoneyStack
                amount={item.allInStartupTotal}
                euroClass="mt-2 text-lg font-bold text-slate-950"
                pesoClass="mt-1 text-xs font-semibold text-slate-500"
              />
            </div>
          </div>

          <div className="space-y-3 text-sm leading-6 text-slate-600">
            <p>
              <span className="font-bold text-slate-900">Resumen:</span> {item.summary}
            </p>
            <p>
              <span className="font-bold text-slate-900">Servicios publicados:</span> {item.service_notes}
            </p>
            <p>
              <span className="font-bold text-slate-900">Lectura anual:</span> {item.pricingProfile}
            </p>
            <p>
              <span className="font-bold text-slate-900">Galeria:</span> {item.gallery.note}
            </p>
          </div>

          <details className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <summary className="cursor-pointer list-none text-sm font-bold text-slate-950">
              Desglose de presupuesto anual
            </summary>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-white p-4">
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">Renta media</p>
                <p className="mt-2 text-base font-semibold text-slate-900">
                  {formatMoneyBoth(item.averageMonthlyRent)}/mes
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  {formatMoneyBoth(item.annualRent)} entre {academicMonths.length} meses.
                </p>
              </div>
              <div className="rounded-2xl bg-white p-4">
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">Traslado</p>
                <p className="mt-2 text-base font-semibold text-slate-900">
                  {formatMoneyBoth(item.transport.annual)}/anio
                </p>
                <p className="mt-2 text-sm text-slate-500">{item.transport.note}</p>
              </div>
              <div className="rounded-2xl bg-white p-4 sm:col-span-2">
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">
                  Servicios por mes
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    Electricidad: {formatMoneyBoth(item.utilities.breakdown.electricity)}
                  </p>
                  <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    Gas o calefaccion: {formatMoneyBoth(item.utilities.breakdown.gas)}
                  </p>
                  <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    Agua: {formatMoneyBoth(item.utilities.breakdown.water)}
                  </p>
                  <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    Internet: {formatMoneyBoth(item.utilities.breakdown.internet)}
                  </p>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  Total servicios: {formatMoneyBoth(item.utilities.total)}/mes. La fianza no entra en el
                  costo anual porque deberia recuperarse al salir si todo queda bien.
                </p>
              </div>
              <div className="rounded-2xl bg-white p-4 sm:col-span-2">
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">
                  Costo completo del intercambio
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    Tramites, seguro, vuelo y alta UDC/TIE: {formatMoneyBoth(item.allInAnnualTotal - item.annualRecurringTotal)}.
                  </p>
                  <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    Presupuesto completo septiembre 2026 a agosto 2027: {formatMoneyBoth(item.allInAnnualTotal)}.
                  </p>
                </div>
              </div>
            </div>
          </details>

          <details className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <summary className="cursor-pointer list-none text-sm font-bold text-slate-950">
              Requisitos, llegada y disponibilidad
            </summary>
            <div className="mt-4 space-y-3">
              <ul className="space-y-2 text-sm leading-6 text-slate-600">
                {item.requirementLines.map((line) => (
                  <li key={`${item.id}-${line}`} className="rounded-2xl bg-white px-4 py-3">
                    {line}
                  </li>
                ))}
              </ul>
              <div className="grid gap-3 sm:grid-cols-2">
                <p className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                  Llegada puente: {item.startup.arrivalDays} noches x {formatMoneyBoth(planningData.arrival.nightlyBufferEur)}.
                </p>
                <p className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                  Fianza presupuestada: {item.startup.depositMonths} mes(es) recuperables. Vivienda de arranque: {formatMoneyBoth(item.startup.cashNeeded)}.
                </p>
                <p className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                  Caja total recomendada antes de salir de Mexico: {formatMoneyBoth(item.allInStartupTotal)}.
                </p>
                <p className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                  Ese total ya mete vuelo redondo, visado, seguro medico anual, TIE, seguro UDC y buffer documental.
                </p>
              </div>
            </div>
          </details>

          {item.meta?.priceType === 'byMonth' && (
            <details className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <summary className="cursor-pointer list-none text-sm font-bold text-slate-950">
                Perfil de renta mes a mes
              </summary>
              <div className="mt-4 flex flex-wrap gap-2">
                {item.rentSchedule.map((month) => (
                  <span
                    key={`${item.id}-${month.key}`}
                    className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
                  >
                    {month.label}: {formatMoneyBoth(month.rent)}
                  </span>
                ))}
              </div>
            </details>
          )}

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
  const campus = reportData.campus
  const exchangeBudget = getExchangeBudget()
  const allListings = reportData.listings.map((item) => enrichListing(item, campus, exchangeBudget))
  const recommendedScenarios = buildRecommendedScenarios(allListings)

  const [sourceFilter, setSourceFilter] = useState('all')
  const [modeFilter, setModeFilter] = useState('all')
  const [distanceFilter, setDistanceFilter] = useState('all')
  const [arrivalFilter, setArrivalFilter] = useState('all')
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query.trim().toLowerCase())

  const filteredListings = allListings.filter((item) => {
    const sourceMatch = sourceFilter === 'all' || item.source === sourceFilter
    const modeMatch = modeFilter === 'all' || item.cost_mode === modeFilter
    const distanceMatch =
      distanceFilter === 'all' ||
      (distanceFilter === 'near' && item.distance_km <= 2) ||
      (distanceFilter === 'walkable' && item.distance_km <= 1)
    const arrivalMatch =
      arrivalFilter === 'all' ||
      (arrivalFilter === 'ready' && item.availability.ready !== false) ||
      (arrivalFilter === 'blocked' && item.availability.ready === false)
    const searchableFields = [
      item.title,
      item.location_label,
      item.summary,
      item.service_notes,
      item.cost_note,
      item.source_note,
      item.pricingProfile,
      item.requirementLines.join(' '),
    ]
    const queryMatch =
      deferredQuery.length === 0 ||
      searchableFields.some((field) => field.toLowerCase().includes(deferredQuery))

    return sourceMatch && modeMatch && distanceMatch && arrivalMatch && queryMatch
  })

  const visibleAnnualAverage =
    filteredListings.length > 0
      ? filteredListings.reduce((sum, item) => sum + item.annualRecurringTotal, 0) /
        filteredListings.length
      : 0
  const visibleAllInAnnualAverage =
    filteredListings.length > 0
      ? filteredListings.reduce((sum, item) => sum + item.allInAnnualTotal, 0) / filteredListings.length
      : 0
  const visibleMonthlyAverage =
    filteredListings.length > 0
      ? filteredListings.reduce((sum, item) => sum + item.monthlyAverageTotal, 0) /
        filteredListings.length
      : 0
  const visibleAllInMonthlyAverage =
    filteredListings.length > 0
      ? filteredListings.reduce((sum, item) => sum + item.allInMonthlyAverage, 0) / filteredListings.length
      : 0
  const visibleStartupAverage =
    filteredListings.length > 0
      ? filteredListings.reduce((sum, item) => sum + item.allInStartupTotal, 0) / filteredListings.length
      : 0
  const visibleReadyCount = filteredListings.filter((item) => item.availability.ready !== false).length
  const scenarioAverage =
    recommendedScenarios.reduce((sum, scenario) => sum + (scenario.item?.allInAnnualTotal ?? 0), 0) /
    recommendedScenarios.filter((scenario) => scenario.item).length

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(31,95,83,0.18),transparent_28rem),radial-gradient(circle_at_left_center,rgba(135,60,68,0.12),transparent_24rem),linear-gradient(180deg,#faf6ef_0%,#f4efe8_100%)] text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <header className="relative overflow-hidden rounded-[2.2rem] bg-[linear-gradient(135deg,rgba(16,47,43,0.98),rgba(31,79,127,0.92))] p-6 text-white shadow-[0_28px_80px_rgba(23,28,33,0.18)] sm:p-8 lg:p-10">
          <div className="absolute inset-y-0 right-0 hidden w-80 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.14),transparent_60%)] lg:block" />
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="relative z-10">
              <p className="inline-flex rounded-full bg-white/12 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.24em] text-white/90 ring-1 ring-white/10">
                Camila Conde • intercambio en Arquitectura UDC
              </p>
              <h1 className="mt-5 max-w-3xl font-display text-5xl leading-[0.94] text-balance sm:text-6xl lg:text-7xl">
                Presupuesto anual completo para vivir en A Coruna
              </h1>
               <p className="mt-5 max-w-3xl text-base leading-7 text-white/78 sm:text-lg">
                 Esta version proyecta el intercambio completo entre{' '}
                 <span className="font-semibold text-white">{planningData.academicYear.planningLabel}</span>,
                 suma vivienda, servicios, traslado a Arquitectura UDC, vuelo Mexico-Espana, visado, TIE,
                 seguro medico anual, seguro UDC, caja inicial para entrar al piso, y marca si una ficha sirve o
                 no para septiembre de 2026.
               </p>
              <div className="mt-6 flex flex-wrap gap-3 text-sm font-medium text-white/88">
                <span className="rounded-full bg-white/12 px-4 py-2 ring-1 ring-white/10">
                  1 EUR = {reportData.exchange.eur_to_mxn.toFixed(4)} MXN
                </span>
                <span className="rounded-full bg-white/12 px-4 py-2 ring-1 ring-white/10">
                  ETSAC • Campus da Zapateira • lineas 24 y UDC
                </span>
                <span className="rounded-full bg-white/12 px-4 py-2 ring-1 ring-white/10">
                  Bus universitario: {formatMoneyBoth(planningData.transport.farePerRideEur)} por viaje
                </span>
              </div>
            </div>

            <aside className="relative z-10 grid gap-4 self-end">
              {recommendedScenarios.map((scenario) => (
                <ScenarioCard key={scenario.id} scenario={scenario} exchangeBudget={exchangeBudget} />
              ))}
            </aside>
          </div>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Opciones visibles"
            value={`${filteredListings.length} anuncios`}
            note={`${visibleReadyCount} sirven para septiembre 2026 o no publican bloqueo de fecha.`}
          />
          <StatCard
            label="Promedio mensual vivienda"
            value={filteredListings.length ? formatMoneyBoth(visibleMonthlyAverage) : 'Sin resultados'}
            note="Renta media del anio + servicios estimados + transporte prorrateado."
          />
          <StatCard
            label="Promedio anual completo"
            value={filteredListings.length ? formatMoneyBoth(visibleAllInAnnualAverage) : 'Sin resultados'}
            note="Suma vivienda, transporte, servicios, vuelo, visado, seguro medico, TIE y seguro UDC."
          />
          <StatCard
            label="Caja total de arranque"
            value={filteredListings.length ? formatMoneyBoth(visibleStartupAverage) : 'Sin resultados'}
            note={`Incluye vivienda de entrada, vuelo, visado, seguro anual, TIE, seguro UDC y puente de ${planningData.arrival.nightlyBufferEur} €/noche.`}
          />
        </section>

        <section className="mt-6 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <article className="rounded-[2rem] border border-white/70 bg-white/82 p-5 shadow-[0_20px_60px_rgba(49,38,20,0.08)] backdrop-blur sm:p-6">
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-400">Metodologia anual</p>
            <h2 className="mt-2 font-display text-3xl leading-tight text-slate-950">Como se calcula el anio completo</h2>
            <div className="mt-5 space-y-4 text-sm leading-6 text-slate-600">
              <p>{planningData.academicYear.note}</p>
              <p>
                Las fichas con precio variable usan el perfil real de sep 2026 a ago 2027. Las fijas multiplican
                la renta publicada por 12.
              </p>
              <p>
                El transporte usa la tarifa oficial del bus universitario y una intensidad distinta segun la
                distancia a Arquitectura: caminar, mixto, bus habitual o bus casi diario.
              </p>
              <p>
                Los servicios se cierran con lo que publica cada ficha. Cuando el anuncio no dice nada, se mete
                un estimado conservador de electricidad, gas, agua e internet para que no te engañe la renta
                base.
              </p>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {planningData.academicYear.timeline.map((entry) => (
                <div key={entry} className="rounded-2xl bg-slate-100/85 p-4 text-sm leading-6 text-slate-700">
                  {entry}
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[2rem] border border-white/70 bg-white/82 p-5 shadow-[0_20px_60px_rgba(49,38,20,0.08)] backdrop-blur sm:p-6">
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-400">Llegada y firma</p>
            <h2 className="mt-2 font-display text-3xl leading-tight text-slate-950">Lo que conviene hacer antes de volar</h2>
            <div className="mt-5 grid gap-4">
              <div className="rounded-2xl bg-slate-100/85 p-4">
                <p className="text-sm font-semibold text-slate-900">Si cierras por Idealista</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Llega con al menos {planningData.arrival.idealistaDaysEarly} dias de margen para ver el piso,
                  revisar el contrato, pagar la fianza y levantar inventario.
                </p>
              </div>
              <div className="rounded-2xl bg-slate-100/85 p-4">
                <p className="text-sm font-semibold text-slate-900">Si cierras online</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Con Spotahome suele bastar un margen de {planningData.arrival.onlineDaysEarly} dias, pero solo
                  si la entrada ya quedo confirmada y la ficha si esta disponible para septiembre de 2026.
                </p>
              </div>
              <div className="rounded-2xl bg-slate-100/85 p-4">
                <p className="text-sm font-semibold text-slate-900">Documentos y caja</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Lleva carta de aceptacion de la UDC, pasaporte o NIE si ya lo tienes, prueba de beca o fondos,
                  y caja para primer mes, fianza y alojamiento puente.
                </p>
              </div>
            </div>
          </article>
        </section>

        <section className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-[2rem] border border-white/70 bg-white/82 p-5 shadow-[0_20px_60px_rgba(49,38,20,0.08)] backdrop-blur sm:p-6">
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-400">
              UNAM → UDC
            </p>
            <h2 className="mt-2 font-display text-3xl leading-tight text-slate-950">
              Costo fijo del intercambio y requisito consular
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-100/85 p-4">
                <p className="text-sm font-semibold text-slate-900">Visado de estudios</p>
                <p className="mt-2 text-2xl font-black text-slate-950">
                  {currencyPeso.format(planningData.exchange.visaFeeMxn)}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Referencia de la ultima tabla especifica indexada para estudios en Mexico; conviene
                  reconfirmar el monto exacto antes de pagar.
                </p>
              </div>
              <div className="rounded-2xl bg-slate-100/85 p-4">
                <p className="text-sm font-semibold text-slate-900">Seguro medico anual</p>
                <p className="mt-2 text-2xl font-black text-slate-950">
                  {formatMoneyBoth(exchangeBudget.medicalInsuranceAnnual)}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Se usa una referencia conservadora de {formatMoneyBoth(planningData.exchange.medicalInsuranceMonthlyEur)}
                  /mes para no quedarte corta en el expediente.
                </p>
              </div>
              <div className="rounded-2xl bg-slate-100/85 p-4">
                <p className="text-sm font-semibold text-slate-900">Vuelo redondo Mexico - A Coruna</p>
                <p className="mt-2 text-2xl font-black text-slate-950">
                  {formatMoneyBoth(planningData.exchange.flightRoundTripEur)}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Presupuestado con referencia publica de vuelo sencillo desde Ciudad de Mexico y duplicado
                  para no esconder el regreso.
                </p>
              </div>
              <div className="rounded-2xl bg-slate-100/85 p-4">
                <p className="text-sm font-semibold text-slate-900">TIE + seguro UDC + buffer documental</p>
                <p className="mt-2 text-2xl font-black text-slate-950">
                  {formatMoneyBoth(
                    planningData.exchange.tieFeeEur +
                      planningData.exchange.udcAccidentInsuranceEur +
                      exchangeBudget.documentsBuffer,
                  )}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Mete TIE, seguro de accidentes UDC y una reserva para certificado medico, apostilla, copias,
                  fotos y traslados de tramite en Mexico.
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">
                  Fijo comun que se suma a cualquier piso
                </p>
                <p className="mt-2 text-2xl font-black text-slate-950">
                  {formatMoneyBoth(exchangeBudget.fixedAcademicTotal)}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Este bloque es el mismo para los 28 anuncios: tramites, vuelo y seguro.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">
                  Solvencia consular orientativa
                </p>
                <p className="mt-2 text-2xl font-black text-slate-950">
                  {formatMoneyBoth(planningData.exchange.proofOfFundsAnnualEur)}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Equivale a {formatMoneyBoth(planningData.exchange.proofOfFundsMonthlyEur)}/mes. Es requisito
                  para demostrar medios economicos; no es un gasto extra separado.
                </p>
              </div>
            </div>
            <div className="mt-5 rounded-[1.6rem] border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">Lectura practica del presupuesto</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Promedio vivienda: {formatMoneyBoth(visibleAnnualAverage)}/anio. Promedio completo con
                migracion, seguro y vuelo: {formatMoneyBoth(visibleAllInAnnualAverage)}/anio, que equivale a{' '}
                {formatMoneyBoth(visibleAllInMonthlyAverage)}/mes. Para pedir el intercambio o justificar fondos,
                la cifra util es la completa.
              </p>
            </div>
          </article>

          <aside className="grid gap-4">
            <article className="rounded-[2rem] border border-white/70 bg-white/88 p-5 shadow-[0_20px_60px_rgba(49,38,20,0.08)] backdrop-blur">
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-400">
                Tramites clave
              </p>
              <h2 className="mt-2 font-display text-3xl text-slate-950">Que no se te puede ir</h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                {planningData.exchange.checklist.map((line) => (
                  <li key={line} className="rounded-2xl bg-slate-100/85 px-4 py-3">
                    {line}
                  </li>
                ))}
                {planningData.unam.checklist.map((line) => (
                  <li key={line} className="rounded-2xl bg-slate-100/85 px-4 py-3">
                    {line}
                  </li>
                ))}
              </ul>
            </article>

            <article className="rounded-[2rem] border border-white/70 bg-white/88 p-5 shadow-[0_20px_60px_rgba(49,38,20,0.08)] backdrop-blur">
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-400">Tiempos</p>
              <h2 className="mt-2 font-display text-3xl text-slate-950">Calendario operativo</h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                {planningData.exchange.timing.map((line) => (
                  <li key={line} className="rounded-2xl bg-slate-100/85 px-4 py-3">
                    {line}
                  </li>
                ))}
              </ul>
              <div className="mt-4 rounded-2xl bg-slate-100/85 px-4 py-4 text-sm leading-6 text-slate-600">
                Si vas a cerrar por Idealista, conserva margen real para visitar. Si vas a firmar online, no
                compres vuelo inflexible hasta tener visado resuelto y entrada de piso confirmada.
              </div>
            </article>
          </aside>
        </section>

        <section className="mt-6 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <article className="rounded-[2rem] border border-white/70 bg-white/82 p-5 shadow-[0_20px_60px_rgba(49,38,20,0.08)] backdrop-blur sm:p-6">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-400">Explorador</p>
                  <h2 className="mt-2 font-display text-3xl leading-tight text-slate-950">Filtra la comparativa</h2>
                </div>
                <p className="max-w-xl text-sm leading-6 text-slate-500">
                  El ranking se sigue leyendo por costo publicado, pero cada ficha ya muestra el impacto anual
                  realista para todo el intercambio.
                </p>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Buscar por zona, servicios o requisitos
                </span>
                <input
                  value={query}
                  onChange={(event) => {
                    const nextValue = event.target.value
                    startTransition(() => {
                      setQuery(nextValue)
                    })
                  }}
                  placeholder="Ejemplo: Matogrande, wifi, 12 meses, mascotas..."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-inner shadow-slate-200/40 outline-none transition focus:border-slate-950"
                />
              </label>

              <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
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
                <div>
                  <p className="mb-3 text-sm font-semibold text-slate-700">Entrada septiembre 2026</p>
                  <div className="flex flex-wrap gap-2">
                    <FilterButton active={arrivalFilter === 'all'} onClick={() => setArrivalFilter('all')}>
                      Todas
                    </FilterButton>
                    <FilterButton active={arrivalFilter === 'ready'} onClick={() => setArrivalFilter('ready')}>
                      Sirven o no bloquean
                    </FilterButton>
                    <FilterButton active={arrivalFilter === 'blocked'} onClick={() => setArrivalFilter('blocked')}>
                      No llegan
                    </FilterButton>
                  </div>
                </div>
              </div>
            </div>
          </article>

          <article className="rounded-[2rem] border border-white/70 bg-white/82 p-5 shadow-[0_20px_60px_rgba(49,38,20,0.08)] backdrop-blur sm:p-6">
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-400">Promedio util</p>
            <h2 className="mt-2 font-display text-3xl leading-tight text-slate-950">Tres referencias rapidas</h2>
            <div className="mt-5 grid gap-4">
              <div className="rounded-2xl bg-slate-100/85 p-4">
                <p className="text-sm font-semibold text-slate-900">Promedio de los 3 presupuestos buenos</p>
                <p className="mt-2 text-2xl font-black text-slate-950">{formatMoneyBoth(scenarioAverage)}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Ya incluye vivienda, tramites, vuelo y seguro, para no quedarte solo con la renta base mas
                  baja.
                </p>
              </div>
              <div className="rounded-2xl bg-slate-100/85 p-4">
                <p className="text-sm font-semibold text-slate-900">Fijo comun del intercambio</p>
                <p className="mt-2 text-2xl font-black text-slate-950">
                  {formatMoneyBoth(exchangeBudget.fixedAcademicTotal)}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Es el bloque que se suma a cualquier alojamiento para modelar el intercambio completo.
                </p>
              </div>
              <div className="rounded-2xl bg-slate-100/85 p-4">
                <p className="text-sm font-semibold text-slate-900">Posible apoyo UNAM</p>
                <p className="mt-2 text-2xl font-black text-slate-950">
                  {currencyPeso.format(planningData.unam.countryScholarshipMxn)}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Referencia de beca pais publicada por UNAM para Espana. No se descuenta del presupuesto hasta
                  tener asignacion formal.
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
                Azul = Idealista, verde = Spotahome, rojo = Arquitectura UDC.
              </p>
            </div>
            <div className="overflow-hidden rounded-[1.6rem] border border-slate-200/80">
              <MapContainer center={[campus.lat, campus.lon]} zoom={12} scrollWheelZoom={false} className="h-[520px] w-full">
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                  subdomains="abcd"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                />
                <FitMapToListings campus={campus} listings={filteredListings} />
                <CircleMarker
                  center={[campus.lat, campus.lon]}
                  radius={9}
                  pathOptions={{ color: '#873c44', fillColor: '#873c44', fillOpacity: 1, weight: 2 }}
                >
                  <Popup>
                    <div className="space-y-2">
                      <p className="font-semibold text-slate-950">{campus.name}</p>
                      <a href={campus.source_url} target="_blank" rel="noreferrer">
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
                        <p>
                          {formatMoneyBoth(item.monthlyAverageTotal)} • {formatDistance(item.distance_km)}
                        </p>
                        <p>{formatMoneyBoth(item.allInAnnualTotal)} al anio completo</p>
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
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-400">Lectura del mapa</p>
              <h2 className="mt-2 font-display text-3xl text-slate-950">Que si y que no significa</h2>
              <div className="mt-5 flex flex-wrap gap-2">
                <MapLegendChip tone="bg-sky-100 text-sky-800 ring-sky-900/10">Idealista</MapLegendChip>
                <MapLegendChip tone="bg-emerald-100 text-emerald-800 ring-emerald-900/10">Spotahome</MapLegendChip>
                <MapLegendChip tone="bg-rose-100 text-rose-800 ring-rose-900/10">base</MapLegendChip>
                <MapLegendChip tone="bg-emerald-100 text-emerald-800 ring-emerald-900/10">cerrado</MapLegendChip>
                <MapLegendChip tone="bg-amber-100 text-amber-800 ring-amber-900/10">variable</MapLegendChip>
              </div>
              <div className="mt-5 space-y-4 text-sm leading-6 text-slate-600">
                <p>La distancia es una comparacion homogenea contra la ETSAC, no tiempo real de Google Maps.</p>
                <p>El costo anual ya suma servicios y traslado. La fianza se separa para no inflar el total recurrente.</p>
                <p>Si una ficha bloquea la entrada hasta 2027, aparece marcada y conviene descartarla para septiembre de 2026.</p>
              </div>
            </article>

            <article className="rounded-[2rem] border border-white/70 bg-white/88 p-5 shadow-[0_20px_60px_rgba(49,38,20,0.08)] backdrop-blur">
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-400">Checklist</p>
              <h2 className="mt-2 font-display text-3xl text-slate-950">Requisitos tipicos</h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                <li className="rounded-2xl bg-slate-100/85 px-4 py-3">Carta de aceptacion o matricula de la UDC.</li>
                <li className="rounded-2xl bg-slate-100/85 px-4 py-3">Pasaporte, NIE si ya lo tienes, y contacto local.</li>
                <li className="rounded-2xl bg-slate-100/85 px-4 py-3">Prueba de fondos, beca, nomina o aval si el casero lo pide.</li>
                <li className="rounded-2xl bg-slate-100/85 px-4 py-3">Primer mes, fianza y a veces reserva o garantia adicional.</li>
                <li className="rounded-2xl bg-slate-100/85 px-4 py-3">Para contratos de mas de 6 meses, confirma por escrito servicios, inventario, duracion y fecha exacta de entrada.</li>
              </ul>
            </article>
          </aside>
        </section>

        <section className="mt-6 rounded-[2rem] border border-white/70 bg-white/88 p-5 shadow-[0_20px_60px_rgba(49,38,20,0.08)] backdrop-blur sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-400">Ranking</p>
              <h2 className="mt-2 font-display text-3xl text-slate-950">Orden por costo publicado y total real</h2>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-slate-500">
              El orden sigue el precio publicado del anuncio. Aun asi, aqui ya se ve lo que realmente cuesta sostener el intercambio durante todo el anio.
            </p>
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">
                  <th className="px-3 py-3">#</th>
                  <th className="px-3 py-3">Anuncio</th>
                  <th className="px-3 py-3">Publicado</th>
                  <th className="px-3 py-3">Mes real</th>
                  <th className="px-3 py-3">Anio vivienda</th>
                  <th className="px-3 py-3">Anio completo</th>
                  <th className="px-3 py-3">Caja salida</th>
                  <th className="px-3 py-3">Sept 2026</th>
                </tr>
              </thead>
              <tbody className="text-sm text-slate-600">
                {filteredListings.map((item) => (
                  <tr key={`row-${item.id}`} className="border-b border-slate-100 align-top hover:bg-slate-50/70">
                    <td className="px-3 py-4 font-semibold text-slate-950">{item.rank}</td>
                    <td className="px-3 py-4">
                      <p className="font-semibold text-slate-950">{item.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.location_label} • {formatDistance(item.distance_km)}
                      </p>
                    </td>
                    <td className="px-3 py-4">
                      <p className="font-semibold text-slate-950">{currencyEuro.format(item.price_eur)}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {currencyPeso.format(convertToMxn(item.price_eur))} • {item.cost_mode}
                      </p>
                    </td>
                    <td className="px-3 py-4">
                      <p className="font-semibold text-slate-950">{currencyEuro.format(item.monthlyAverageTotal)}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {currencyPeso.format(convertToMxn(item.monthlyAverageTotal))} • {currencyEuro.format(item.utilities.total)} servicios
                      </p>
                    </td>
                    <td className="px-3 py-4">
                      <p className="font-semibold text-slate-950">{currencyEuro.format(item.annualRecurringTotal)}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {currencyPeso.format(item.annualRecurringTotal * reportData.exchange.eur_to_mxn)}
                      </p>
                    </td>
                    <td className="px-3 py-4">
                      <p className="font-semibold text-slate-950">{currencyEuro.format(item.allInAnnualTotal)}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {currencyPeso.format(convertToMxn(item.allInAnnualTotal))}
                      </p>
                    </td>
                    <td className="px-3 py-4">
                      <p className="font-semibold text-slate-950">{currencyEuro.format(item.allInStartupTotal)}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {currencyPeso.format(convertToMxn(item.allInStartupTotal))} • {item.startup.depositMonths} mes(es) de fianza
                      </p>
                    </td>
                    <td className="px-3 py-4">
                      <span className={cx('inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1', availabilityStyles[item.availability.status])}>
                        {item.availability.label}
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
              Cada ficha ya trae galeria, presupuesto anual, servicios, traslado, caja inicial y requisitos publicados o inferidos de manera conservadora.
            </p>
          </div>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {filteredListings.map((item) => (
              <ListingCard key={item.id} item={item} />
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-white/70 bg-white/88 p-5 shadow-[0_20px_60px_rgba(49,38,20,0.08)] backdrop-blur sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-400">Fuentes reales</p>
              <h2 className="mt-2 font-display text-3xl text-slate-950">Enlaces usados para el presupuesto</h2>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-slate-500">
              Todo lo que ves arriba sale de los anuncios que diste y de fuentes publicas para universidad, transporte, cambio e hipotesis de contratacion.
            </p>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[
              { title: 'ETSAC - Arquitectura UDC', url: campus.source_url, note: campus.source_note },
              { title: `Calendario UDC ${planningData.academicYear.publishedCourse}`, url: planningData.academicYear.publishedSourceUrl, note: planningData.academicYear.note },
              { title: 'PDF oficial del calendario publicado', url: planningData.academicYear.publishedPdfUrl, note: 'Se usa como patron para el anio septiembre 2026 a agosto 2027.' },
              { title: 'Visado de estudios - Consulado de Espana en Mexico', url: planningData.exchange.studyVisaUrl, note: `Base oficial para estudios >180 dias, seguro medico, antecedentes y resolucion media de ${planningData.exchange.resolutionDays} dias.` },
              { title: 'Tasas de visados en Mexico', url: planningData.exchange.visaFeesUrl, note: 'Pagina oficial del consulado; la tasa especifica de estudios puede variar y debe reconfirmarse al pagar.' },
              { title: 'Tabla indexada de tasas para visado de estudios', url: planningData.exchange.indexedStudyVisaFeesUrl, note: `Ultima tabla especifica indexada para estudios: ${currencyPeso.format(planningData.exchange.visaFeeMxn)}.` },
              { title: 'Tasa oficial TIE en BOE', url: planningData.exchange.tieFeeUrl, note: `Referencia usada para TIE: ${formatMoneyBoth(planningData.exchange.tieFeeEur)}.` },
              { title: 'Student Guide UDC', url: planningData.exchange.udcInsuranceUrl, note: `La UDC exige cobertura medica valida en Espana y publica seguro de accidentes de ${formatMoneyBoth(planningData.exchange.udcAccidentInsuranceEur)}.` },
              { title: 'Seguro medico internacional de referencia', url: planningData.exchange.medicalInsuranceUrl, note: `Base conservadora: ${formatMoneyBoth(planningData.exchange.medicalInsuranceMonthlyEur)}/mes.` },
              { title: 'Ruta publica de vuelos CDMX - A Coruna', url: planningData.exchange.flightsUrl, note: `Referencia usada para vuelo redondo: ${formatMoneyBoth(planningData.exchange.flightRoundTripEur)}.` },
              { title: 'Tarifa oficial del bus urbano', url: planningData.transport.sourceUrl, note: planningData.transport.note },
              { title: 'Tipo de cambio EUR/MXN del BCE', url: reportData.exchange.source_url, note: `Cambio usado: ${reportData.exchange.eur_to_mxn.toFixed(4)} MXN por EUR en ${reportData.exchange.date}.` },
              { title: 'Fibra de referencia para internet', url: planningData.utilities.internetSourceUrl, note: planningData.utilities.note },
              { title: 'Requisitos internos de movilidad UNAM', url: planningData.unam.requirementsUrl, note: 'Base UNAM para oficio de postulacion, compromisos y seguro antes de la movilidad.' },
              { title: 'Beca pais UNAM para Espana', url: planningData.unam.scholarshipUrl, note: `Referencia de apoyo publicada por UNAM: ${currencyPeso.format(planningData.unam.countryScholarshipMxn)}.` },
              { title: 'Apoyo UNAM para seguro medico', url: planningData.unam.insuranceAidUrl, note: `Algunas convocatorias publican apoyo de ${formatMoneyBoth(planningData.unam.insuranceAidEur)} para seguro.` },
              { title: 'Documentos habituales para alquilar', url: planningData.renting.documentsUrl, note: 'Checklist base para no quedarte corto al escribir o firmar.' },
              { title: 'Fianza y garantia adicional', url: planningData.renting.depositUrl, note: 'Apoya el criterio de separar la fianza del costo recurrente anual.' },
              { title: 'Como funciona Spotahome', url: planningData.renting.spotahomeHowItWorksUrl, note: 'Sirve para revisar reserva online, condiciones y pasos previos.' },
            ].map((source) => (
              <article key={source.url} className="rounded-2xl bg-slate-100/85 p-4">
                <p className="text-sm font-semibold text-slate-900">{source.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{source.note}</p>
                <a className="mt-3 inline-flex text-sm font-semibold text-slate-950 underline decoration-slate-300 underline-offset-4" href={source.url} target="_blank" rel="noreferrer">
                  Abrir fuente
                </a>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export default App
