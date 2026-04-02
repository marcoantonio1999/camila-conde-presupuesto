export const planningData = {
  academicYear: {
    start: '2026-09-01',
    end: '2027-08-31',
    planningLabel: 'septiembre 2026 a agosto 2027',
    publishedCourse: '2025/2026',
    publishedSourceUrl: 'https://www.udc.es/es/futuros_estudantes/calendario-academico/',
    publishedPdfUrl:
      'https://www.udc.es/export/sites/udc/turismo/_galeria_down/informacion-academica/Calendario_Academico_curso-2025_2026_es.pdf_2063069294.pdf',
    note:
      'A 1 de abril de 2026 la UDC todavia no publica en abierto el calendario 2026/2027. Esta pagina proyecta el intercambio completo de septiembre de 2026 a agosto de 2027 usando la misma estructura oficial del curso 2025/2026.',
    timeline: [
      'Curso academico oficial 2025/2026: 1 septiembre 2025 a 31 agosto 2026.',
      'Primer cuatrimestre 2025/2026: 8 septiembre a 19 diciembre de 2025.',
      'Segundo cuatrimestre 2025/2026: 26 enero a 15 mayo de 2026.',
      'Evaluacion ordinaria del segundo cuatrimestre 2025/2026: 18 mayo a 5 junio de 2026.',
      'Segunda oportunidad 2025/2026: hasta julio de 2026; algunas actas de practicas y TFG/TFM llegan hasta septiembre.',
    ],
  },
  transport: {
    farePerRideEur: 0.15,
    sourceUrl:
      'https://www.coruna.gal/web/es/actualidad/noticias/noticia/o-concello-da-continuidade-as-bonificacions-no-servizo-de-transporte-urbano-e-reducira-ademais-o/suceso/1453908774304?argIdioma=es',
    note:
      'El Concello mantiene la tarifa plana universitaria y el bonobus general bonificado en 0,15 € por viaje desde 2026-01-01.',
    activeMonths: 10,
    lightMonthFactor: 0.4,
    rideBands: [
      {
        label: 'A pie',
        maxKm: 1,
        ridesPerMonth: 0,
        note: 'La ubicacion permite resolver casi todo caminando.',
      },
      {
        label: 'Mixto',
        maxKm: 2.5,
        ridesPerMonth: 20,
        note: 'Caminar la mayor parte del tiempo y usar bus en lluvia, noche o semanas de entrega.',
      },
      {
        label: 'Bus habitual',
        maxKm: 4.5,
        ridesPerMonth: 36,
        note: 'Ida y vuelta en bus la mayor parte del curso.',
      },
      {
        label: 'Bus casi diario',
        maxKm: Infinity,
        ridesPerMonth: 44,
        note: 'Zona mas alejada o peor conectada a Arquitectura.',
      },
    ],
  },
  utilities: {
    internetBaselineEur: 25,
    internetSourceUrl: 'https://www.digimobil.es/fibra-optica',
    note:
      'Internet usa como referencia una fibra domestica economica publicada en Espana. Electricidad, agua y gas son estimaciones conservadoras para comparar anuncios cuando la ficha no cierra suministros.',
    baselines: {
      compact: {
        electricity: 45,
        gas: 20,
        water: 18,
        internet: 25,
      },
      medium: {
        electricity: 60,
        gas: 25,
        water: 22,
        internet: 25,
      },
      large: {
        electricity: 80,
        gas: 35,
        water: 25,
        internet: 25,
      },
    },
    cappedBuffers: {
      electricity: 10,
      gas: 5,
    },
  },
  arrival: {
    idealistaDaysEarly: 7,
    onlineDaysEarly: 3,
    nightlyBufferEur: 60,
    note:
      'Para anuncios de agencia/particular como Idealista conviene llegar una semana antes para visitar, firmar, pagar fianza y levantar inventario. Con reserva online suele bastar un margen de 3 dias si la entrada ya esta cerrada.',
  },
  renting: {
    documentsUrl:
      'https://www.idealista.com/news/inmobiliario/vivienda/2023/07/27/807060-que-documentos-debes-entregar-para-alquilar-un-piso',
    depositUrl:
      'https://www.idealista.com/news/inmobiliario/vivienda/2025/05/16/842737-se-puede-negociar-no-pagar-la-fianza-o-bajarla-en-un-alquiler',
    advanceUrl:
      'https://www.idealista.com/news/inmobiliario/vivienda/2025/11/04/869571-es-legal-pagar-una-reserva-para-un-piso-en-alquiler',
    spotahomeHowItWorksUrl: 'https://www.spotahome.com/how-it-works',
    spotahomeTermsUrl: 'https://www.spotahome.com/terms-and-conditions',
  },
}
