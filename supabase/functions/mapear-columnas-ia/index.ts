import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

interface RequestBody {
  columnasDesconocidas: string[];
  todasLasColumnas?: string[];
  entidad?: string;              // si el cliente lo envía, se usa directamente (sin detección)
}

type MapeoResultado = Record<string, string>;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ── Schemas por entidad ──────────────────────────────────────────────────────
const CAMPOS_POR_ENTIDAD: Record<string, readonly string[]> = {
  embarcaciones: [
    'propietario', 'dni', 'matricula', 'nombre_embarcacion',
    'categoria', 'eslora', 'manga', 'telefono', 'email', 'notas',
  ],
  clientes: [
    'nombre', 'apellido', 'dni', 'telefono', 'email',
    'direccion', 'localidad', 'notas',
  ],
  proveedores: [
    'nombre_proveedor', 'rubro', 'cuit', 'telefono', 'email',
    'direccion', 'contacto', 'notas',
  ],
};

// Entidades válidas que puede devolver la IA
const ENTIDADES_VALIDAS = new Set(Object.keys(CAMPOS_POR_ENTIDAD));

// ── Campos técnicos que NUNCA deben ir a notas ───────────────────────────────
const CAMPOS_TECNICOS_POR_ENTIDAD: Record<string, Set<string>> = {
  embarcaciones: new Set(['dni', 'matricula', 'propietario', 'nombre_embarcacion', 'categoria', 'eslora', 'manga', 'telefono', 'email']),
  clientes:      new Set(['nombre', 'apellido', 'dni', 'telefono', 'email']),
  proveedores:   new Set(['nombre_proveedor', 'cuit', 'rubro', 'telefono', 'email']),
};

// ── Campos exclusivos (una sola columna puede reclamarlos) ───────────────────
const CAMPOS_EXCLUSIVOS_POR_ENTIDAD: Record<string, Set<string>> = {
  embarcaciones: new Set(['nombre_embarcacion', 'matricula', 'dni', 'eslora', 'manga', 'email', 'telefono']),
  clientes:      new Set(['dni', 'email', 'telefono']),
  proveedores:   new Set(['cuit', 'email', 'telefono']),
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido.' }, 405);
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Body inválido: se esperaba JSON.' }, 400);
  }

  const { columnasDesconocidas, todasLasColumnas, entidad: entidadParam } = body;

  if (!Array.isArray(columnasDesconocidas) || columnasDesconocidas.length === 0) {
    return json({ error: 'columnasDesconocidas debe ser un array no vacío.' }, 400);
  }

  // Entidad forzada por el cliente (toggle del usuario) — si es válida, se usa directamente
  const entidadForzada = (entidadParam && ENTIDADES_VALIDAS.has(entidadParam))
    ? entidadParam
    : null;

  const todasColumnas = Array.isArray(todasLasColumnas) && todasLasColumnas.length
    ? todasLasColumnas
    : columnasDesconocidas;
  const columnas = todasColumnas.slice(0, 30);

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    return json({ error: 'OPENAI_API_KEY no configurada en el servidor.' }, 500);
  }

  let resultado: { entidad: string; mapeo: MapeoResultado };
  try {
    resultado = await llamarOpenAI(apiKey, columnas, todasColumnas, entidadForzada);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: `Error al llamar a OpenAI: ${msg}` }, 502);
  }

  return json(resultado, 200);
});

// ── Detector local de entidad (fallback determinista) ───────────────────────
// Corre antes Y después de la IA para validar su respuesta.
function detectarEntidadLocal(columnas: string[]): string {
  const cn = columnas.map(c => norm(c));

  // Señales náuticas son definitivas — si aparece alguna es embarcaciones
  const hayNautico = cn.some(c =>
    /matricula|reginave|eslora|manga|sigla|registro_pna|calado|amarre|velero|lancha|buque|embarcac/.test(c)
  );
  if (hayNautico) return 'embarcaciones';

  // Señales de empresa/proveedor
  const hayProveedor = cn.some(c =>
    /proveedor|razon_social|empresa|rubro|actividad/.test(c)
  );
  if (hayProveedor) return 'proveedores';

  // Señales de persona sin náutica → clientes
  const señalesPersona = cn.filter(c =>
    /apellido|domicilio|localidad|partido|socio|cliente/.test(c)
  );
  if (señalesPersona.length >= 1) return 'clientes';

  // Si hay columnas de contacto pero no náuticas → probablemente clientes
  const soloContacto = cn.filter(c => /nombre|dni|cuit|telefono|email|direccion/.test(c));
  if (soloContacto.length >= 3 && !hayNautico) return 'clientes';

  return 'embarcaciones'; // default conservador
}

// ── Prompt dinámico según contexto ──────────────────────────────────────────
function buildPrompt(todasColumnas: string[], columnasAMapear: string[], entidadForzada: string | null): string {
  const listaTotal  = todasColumnas.map(c => `"${c}"`).join(', ');
  const listaMapear = columnasAMapear.map(c => `"${c}"`).join(', ');

  if (entidadForzada) {
    // Prompt simplificado: entidad ya conocida, solo mapear
    const campos  = CAMPOS_POR_ENTIDAD[entidadForzada].join(', ');
    const reglasEspecificas = entidadForzada === 'embarcaciones'
      ? 'nombre propio del barco → nombre_embarcacion | tipo/clase ("Lancha","Velero") → categoria (JAMÁS nombre_embarcacion) | matrícula/reginave → matricula | titular/dueño → propietario | largo → eslora | ancho → manga | doc propietario → dni | color/zona/seguro → notas'
      : entidadForzada === 'clientes'
        ? 'nombre de pila → nombre | apellido → apellido | "Apellido y Nombre" → nombre | DNI/documento/socio → dni | dirección/domicilio → direccion | ciudad/localidad/partido → localidad | tel/cel → telefono | email/correo → email | resto → notas'
        : 'razón social/empresa → nombre_proveedor | rubro/actividad → rubro | CUIT → cuit | contacto/responsable → contacto | tel → telefono | email → email | resto → notas';

    return (
      `Eres un sistema de mapeo de datos para un gestor náutico argentino.\n` +
      `La tabla ya fue identificada como: ${entidadForzada.toUpperCase()}.\n` +
      `Tu única tarea: mapear cada columna al campo correcto del schema.\n\n` +

      `TODOS LOS ENCABEZADOS: [${listaTotal}]\n` +
      `COLUMNAS A MAPEAR: [${listaMapear}]\n\n` +

      `SCHEMA DE ${entidadForzada.toUpperCase()}: ${campos}\n\n` +

      `REGLAS:\n${reglasEspecificas}\n\n` +

      `"ignorar" SOLO para IDs técnicos, timestamps, UUIDs o nros de fila. NUNCA para datos reales.\n\n` +

      `RESPUESTA — JSON en UNA línea, sin texto extra:\n` +
      `{"entidad":"${entidadForzada}","mapeo":{"Columna1":"campo1","Columna2":"campo2"}}`
    );
  }

  // Prompt completo con detección de entidad (fallback si el cliente no envió entidad)
  const schemasStr = Object.entries(CAMPOS_POR_ENTIDAD)
    .map(([e, c]) => `  ${e.toUpperCase()}: ${c.join(', ')}`)
    .join('\n');

  return (
    'Eres un sistema de mapeo de datos para un gestor náutico argentino.\n' +
    'Tarea: (1) identificar qué tipo de tabla es esta, (2) mapear las columnas desconocidas.\n\n' +

    `TODOS LOS ENCABEZADOS DEL EXCEL: [${listaTotal}]\n` +
    `COLUMNAS A MAPEAR: [${listaMapear}]\n\n` +

    '═══ PASO 1: IDENTIFICAR ENTIDAD ═══\n' +
    '▶ EMBARCACIONES — Matrícula, Reginave, Eslora, Manga, Sigla, Registro PNA, Nombre Barco/Buque/Embarcación\n' +
    '▶ CLIENTES — Apellido, Nombre y Apellido, DNI (sin contexto náutico), Domicilio, Localidad, Socio\n' +
    '▶ PROVEEDORES — Razón Social, CUIT, Rubro, Empresa, Actividad\n\n' +

    '═══ PASO 2: SCHEMAS ═══\n' +
    schemasStr + '\n\n' +

    '═══ REGLAS DE MAPEO ═══\n' +
    'EMBARCACIONES: nombre propio → nombre_embarcacion | tipo/clase → categoria | matrícula → matricula | titular → propietario\n' +
    'CLIENTES: nombre/apellido → nombre/apellido | DNI → dni | domicilio → direccion | localidad → localidad\n' +
    'PROVEEDORES: empresa → nombre_proveedor | CUIT → cuit | rubro → rubro\n\n' +

    '"ignorar" SOLO para IDs técnicos, timestamps, UUIDs. NUNCA para datos reales.\n\n' +

    'FORMATO — JSON en UNA línea:\n' +
    '{"entidad":"<entidad>","mapeo":{"Columna1":"campo1"}}\n\n' +

    'EJEMPLOS:\n' +
    '• {"entidad":"embarcaciones","mapeo":{"Nombre":"nombre_embarcacion","Reginave":"matricula","Titular":"propietario","Tipo":"categoria","Eslora (m)":"eslora"}}\n' +
    '• {"entidad":"clientes","mapeo":{"Apellido y Nombre":"nombre","Documento":"dni","Domicilio":"direccion","Localidad":"localidad"}}'
  );
}

async function llamarOpenAI(
  apiKey: string,
  columnas: string[],
  todasColumnas: string[],
  entidadForzada: string | null,
): Promise<{ entidad: string; mapeo: MapeoResultado }> {
  const url = 'https://api.openai.com/v1/chat/completions';

  const userMsg = entidadForzada
    ? `Mapeá estas columnas al schema de ${entidadForzada}: [${columnas.map(c => `"${c}"`).join(', ')}]`
    : `Detectá la entidad y mapeá estas columnas: [${columnas.map(c => `"${c}"`).join(', ')}]`;

  const requestBody = {
    model: 'gpt-4o-mini',
    temperature: 0,
    max_tokens: 768,
    messages: [
      {
        role: 'system',
        content: buildPrompt(todasColumnas, columnas, entidadForzada),
      },
      {
        role: 'user',
        content: userMsg,
      },
    ],
  };

  console.log('[mapear-columnas-ia] REQUEST a OpenAI:', JSON.stringify(requestBody, null, 2));

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`OpenAI HTTP ${res.status}: ${detail}`);
  }

  const data = await res.json();
  console.log('RESPUESTA CRUDA AI:', JSON.stringify(data, null, 2));

  const texto: string = data?.choices?.[0]?.message?.content ?? '';
  return parsearRespuesta(texto, columnas, todasColumnas, entidadForzada);
}

// ── Parser de la respuesta IA ────────────────────────────────────────────────
function parsearRespuesta(
  texto: string,
  columnas: string[],
  todasColumnas: string[],
  entidadForzada: string | null,
): { entidad: string; mapeo: MapeoResultado } {
  console.log('[parsearRespuesta] Texto crudo:', texto);

  const matchJson = texto.match(/\{[\s\S]*\}/);
  if (!matchJson) throw new Error('No se encontró JSON en la respuesta: ' + texto);

  let crudo: Record<string, unknown>;
  try {
    crudo = JSON.parse(matchJson[0]);
  } catch {
    throw new Error('JSON malformado: ' + matchJson[0]);
  }

  console.log('[parsearRespuesta] JSON parseado:', JSON.stringify(crudo));

  // ── Resolución de entidad ────────────────────────────────────────────────
  let entidad: string;
  if (entidadForzada) {
    // El usuario eligió explícitamente — ignorar lo que diga la IA
    entidad = entidadForzada;
    console.log(`[parsearRespuesta] Entidad forzada por cliente: "${entidad}"`);
  } else {
    const entidadIA    = String(crudo['entidad'] ?? '').toLowerCase().trim();
    const entidadLocal = detectarEntidadLocal(todasColumnas);
    if (ENTIDADES_VALIDAS.has(entidadIA)) {
      entidad = (entidadLocal === 'embarcaciones' && entidadIA !== 'embarcaciones')
        ? 'embarcaciones'
        : entidadIA;
    } else {
      entidad = entidadLocal;
    }
    console.log(`[parsearRespuesta] Entidad resuelta: "${entidad}" (IA: "${entidadIA}", local: "${entidadLocal}")`);
  }

  // Extraer el sub-objeto "mapeo" (o el objeto raíz si no tiene clave "mapeo")
  const mapeoRaw = (crudo['mapeo'] && typeof crudo['mapeo'] === 'object')
    ? crudo['mapeo'] as Record<string, unknown>
    : crudo;

  const campos = CAMPOS_POR_ENTIDAD[entidad];
  const mapeo  = sanitizarMapeo(mapeoRaw, columnas, entidad, campos);

  return { entidad, mapeo };
}

// ── Normalización ────────────────────────────────────────────────────────────
function norm(s: string): string {
  return s.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_\-\/]+/g, '_');
}

// ── Fuzzy match contra campos del schema ────────────────────────────────────
function fuzzyMatchCampo(sugerido: string, campos: readonly string[]): string | null {
  const s = norm(sugerido);
  if (s === 'ignorar') return null;

  for (const c of campos) { if (norm(c) === s) return c; }
  for (const c of campos) { if (s.includes(norm(c))) return c; }
  if (s.length >= 4) {
    for (const c of campos) { if (norm(c).includes(s)) return c; }
  }

  const palabrasSugeridas = s.split('_').filter(w => w.length >= 4);
  for (const c of campos) {
    const palabrasCampo = norm(c).split('_');
    if (palabrasSugeridas.some(ps => palabrasCampo.some(pc => pc.includes(ps) || ps.includes(pc)))) {
      return c;
    }
  }
  return null;
}

// ── Diccionario de prioridad absoluta (embarcaciones) ───────────────────────
const DICT_EMBARCACIONES: Record<string, string> = {
  // Identidad
  dni: 'dni', cuit: 'dni', cuil: 'dni', ruc: 'dni',
  documento: 'dni', nro_doc: 'dni', nro_documento: 'dni',
  identificacion: 'dni', identificacion_tributaria: 'dni',
  nro_identificacion: 'dni', cedula: 'dni', pasaporte: 'dni',

  matricula: 'matricula', reginave: 'matricula', sigla: 'matricula',
  nro_registro: 'matricula', nro_matricula: 'matricula',
  registro: 'matricula', registro_pna: 'matricula', reg_pna: 'matricula',
  prefectura: 'matricula',

  titular: 'propietario', propietario: 'propietario', dueno: 'propietario',
  armador: 'propietario', responsable: 'propietario', socio: 'propietario',
  a_nombre_de: 'propietario', a_nombre: 'propietario', owner: 'propietario',

  // Nombre del barco
  nombre_embarcacion: 'nombre_embarcacion', nombre_barco: 'nombre_embarcacion',
  nombre_lancha: 'nombre_embarcacion', nombre_velero: 'nombre_embarcacion',
  nombre_buque: 'nombre_embarcacion', nombre_del_barco: 'nombre_embarcacion',
  nombre_de_la_embarcacion: 'nombre_embarcacion', nombre_de_embarcacion: 'nombre_embarcacion',
  nombre_del_buque: 'nombre_embarcacion', nombre_de_la_lancha: 'nombre_embarcacion',
  embarcacion: 'nombre_embarcacion', vessel: 'nombre_embarcacion',
  unidad: 'nombre_embarcacion', denominacion: 'nombre_embarcacion',
  buque: 'nombre_embarcacion', barco: 'nombre_embarcacion',
  nombre: 'nombre_embarcacion',

  // Tipo / categoría
  categoria: 'categoria', tipo: 'categoria', clase: 'categoria',
  tipo_embarcacion: 'categoria', tipo_de_embarcacion: 'categoria',
  tipo_de_unidad: 'categoria',

  // Dimensiones
  eslora: 'eslora', largo: 'eslora', longitud: 'eslora',
  loa: 'eslora', eslora_total: 'eslora', largo_total: 'eslora',
  manga: 'manga', ancho: 'manga', beam: 'manga', manga_maxima: 'manga',

  // Contacto
  telefono: 'telefono', tel: 'telefono', celular: 'telefono',
  cel: 'telefono', movil: 'telefono', phone: 'telefono',
  contacto_tel: 'telefono', nro_telefono: 'telefono',
  email: 'email', mail: 'email', correo: 'email',
  correo_electronico: 'email', contacto_mail: 'email',

  // Notas
  notas: 'notas', nota: 'notas', observacion: 'notas', observaciones: 'notas',
  comentario: 'notas', comentarios: 'notas', descripcion: 'notas',
  detalle: 'notas', detalles: 'notas', color: 'notas', material: 'notas',
  puntal: 'notas', tonelaje: 'notas', zona: 'notas', zona_navegacion: 'notas',
  marca_motor: 'notas', marca: 'notas', motor: 'notas', seguro: 'notas',
  vencimiento: 'notas', puerto: 'notas', amarre: 'notas',
};

// Diccionario para clientes
const DICT_CLIENTES: Record<string, string> = {
  nombre: 'nombre', nombres: 'nombre', name: 'nombre',
  apellido: 'apellido', apellidos: 'apellido', surname: 'apellido',
  apellido_nombre: 'nombre', nombre_apellido: 'nombre',
  dni: 'dni', documento: 'dni', cuit: 'dni', cuil: 'dni', nro_doc: 'dni',
  telefono: 'telefono', tel: 'telefono', celular: 'telefono', cel: 'telefono', phone: 'telefono',
  email: 'email', mail: 'email', correo: 'email',
  direccion: 'direccion', domicilio: 'direccion', calle: 'direccion', address: 'direccion',
  localidad: 'localidad', ciudad: 'localidad', partido: 'localidad', provincia: 'localidad',
  notas: 'notas', observacion: 'notas', observaciones: 'notas', comentario: 'notas',
};

// Diccionario para proveedores
const DICT_PROVEEDORES: Record<string, string> = {
  nombre_proveedor: 'nombre_proveedor', razon_social: 'nombre_proveedor',
  empresa: 'nombre_proveedor', proveedor: 'nombre_proveedor',
  rubro: 'rubro', actividad: 'rubro', categoria: 'rubro', tipo: 'rubro',
  cuit: 'cuit', cuil: 'cuit', nro_cuit: 'cuit',
  contacto: 'contacto', responsable: 'contacto', atencion: 'contacto',
  telefono: 'telefono', tel: 'telefono', celular: 'telefono', phone: 'telefono',
  email: 'email', mail: 'email', correo: 'email',
  direccion: 'direccion', domicilio: 'direccion', calle: 'direccion',
  notas: 'notas', observacion: 'notas', observaciones: 'notas', comentario: 'notas',
};

const DICT_POR_ENTIDAD: Record<string, Record<string, string>> = {
  embarcaciones: DICT_EMBARCACIONES,
  clientes:      DICT_CLIENTES,
  proveedores:   DICT_PROVEEDORES,
};

// Palabras que bloquean asignación a nombre_embarcacion
const PALABRAS_BLOQUEO_NOMBRE = ['tipo', 'categoria', 'clase', 'uso', 'categ'];
function colContieneBloqueoNombre(colNorm: string): boolean {
  const palabras = colNorm.split('_');
  return PALABRAS_BLOQUEO_NOMBRE.some(w => palabras.includes(w) || colNorm.includes(w));
}

// Prioridad de procesamiento para nombre_embarcacion
const PRIORIDAD_NOMBRE = [
  'nombre_de_la_embarcacion', 'nombre_embarcacion', 'nombre_barco',
  'nombre_buque', 'nombre_del_barco', 'nombre',
];

// ── Sanitizador de mapeo ─────────────────────────────────────────────────────
function sanitizarMapeo(
  crudo: Record<string, unknown>,
  columnas: string[],
  entidad: string,
  campos: readonly string[],
): MapeoResultado {
  const dict           = DICT_POR_ENTIDAD[entidad] ?? DICT_EMBARCACIONES;
  const camposTecnicos = CAMPOS_TECNICOS_POR_ENTIDAD[entidad] ?? new Set<string>();
  const exclusivos     = CAMPOS_EXCLUSIVOS_POR_ENTIDAD[entidad] ?? new Set<string>();
  const esEmbarcacion  = entidad === 'embarcaciones';

  // Para embarcaciones: procesar primero columnas de "nombre" para ganar exclusividad
  const colsOrdenadas = esEmbarcacion
    ? [...columnas].sort((a, b) => {
        const ai = PRIORIDAD_NOMBRE.indexOf(norm(a));
        const bi = PRIORIDAD_NOMBRE.indexOf(norm(b));
        if (ai === -1 && bi === -1) return 0;
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      })
    : [...columnas];

  const resultado: MapeoResultado = {};
  const exclusivosAsignados = new Set<string>();

  for (const col of colsOrdenadas) {
    const colNorm     = norm(col);
    const valorExacto = crudo[col];
    const valorNorm   = Object.entries(crudo).find(([k]) => norm(k) === colNorm)?.[1];
    const sugerido    = String(valorExacto ?? valorNorm ?? 'ignorar');
    const sugNorm     = norm(sugerido);

    let campoFinal: string | null = null;

    // PASO 1: Diccionario sobre valor sugerido por la IA
    if (dict[sugNorm]) {
      campoFinal = dict[sugNorm];
      console.log(`[sanitizar] DICT     "${col}" → IA:"${sugerido}" → "${campoFinal}"`);
    }

    // PASO 2: Diccionario sobre nombre de la columna
    if (!campoFinal && dict[colNorm]) {
      campoFinal = dict[colNorm];
      console.log(`[sanitizar] DICT-COL "${col}" → "${campoFinal}"`);
    }

    // BLOQUEO (solo embarcaciones): tipo/categoría/clase no pueden ser nombre_embarcacion
    if (esEmbarcacion && campoFinal === 'nombre_embarcacion' && colContieneBloqueoNombre(colNorm)) {
      console.log(`[sanitizar] BLOQUEADO "${col}" → redirige de nombre_embarcacion a categoria`);
      campoFinal = 'categoria';
    }

    // PASO 3: Fuzzy match estándar
    if (!campoFinal) {
      campoFinal = fuzzyMatchCampo(sugerido, campos);
    }

    // PASO 4: Último recurso — nunca ignorar campos técnicos
    if (!campoFinal && sugerido !== 'ignorar') {
      const campoTecnico = campos.find(c => camposTecnicos.has(c) && norm(c) === sugNorm);
      campoFinal = campoTecnico ?? 'notas';
      if (!campoTecnico) {
        console.log(`[sanitizar] NOTAS-REDIRECT "${col}" (IA dijo: "${sugerido}")`);
      }
    }

    // EXCLUSIVIDAD: un campo exclusivo solo puede ser reclamado por una columna
    if (campoFinal && exclusivos.has(campoFinal)) {
      if (exclusivosAsignados.has(campoFinal)) {
        console.log(`[sanitizar] EXCLUSIVO "${col}" → "${campoFinal}" ya tomado → notas`);
        campoFinal = 'notas';
      } else {
        exclusivosAsignados.add(campoFinal);
      }
    }

    resultado[col] = campoFinal ?? 'notas';
    console.log(`[sanitizar] FINAL "${col}" → "${resultado[col]}"`);
  }

  // GARANTÍA FINAL (solo embarcaciones): nombre_embarcacion nunca queda vacío
  if (esEmbarcacion && !exclusivosAsignados.has('nombre_embarcacion')) {
    const candidato = colsOrdenadas.find(col => {
      const cn = norm(col);
      return cn.includes('nombre') && !colContieneBloqueoNombre(cn);
    });
    if (candidato) {
      console.log(`[sanitizar] GARANTIA-NOMBRE: forzando "${candidato}" → nombre_embarcacion`);
      resultado[candidato] = 'nombre_embarcacion';
    }
  }

  return resultado;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
