// Genera docs/Informe-Taller-ToolCalling.docx a partir de lo que hay en el repo:
// código real (src/, pruebas.http) y capturas reales de docs/evidencias/capturas.
// Uso (una vez): npm install   |   Generar: npm run generar
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType,
  BorderStyle, AlignmentType, ImageRun, Footer, PageNumber, TableOfContents, PageBreak, VerticalAlign,
} = require('docx');

const RAIZ = path.resolve(__dirname, '..', '..');
const CAPTURAS = path.join(RAIZ, 'docs', 'evidencias', 'capturas');
const SALIDA = path.join(RAIZ, 'docs', 'Informe-Taller-ToolCalling.docx');

const ESTUDIANTES = ['Julio García Díaz', 'Leiner Pedroza Sabalza', 'Alison Atenció Ramos', 'Daniel Lorduy Leones'];
const CURSO = 'Desarrollo Web Avanzado · 7° semestre';
const FECHA = '18 de noviembre de 2026';
const REPO_URL = process.env.REPO_URL || 'https://github.com/SebastianMontes-Dev/toolcalling-spring-ai-taller';

const FUENTE = 'Times New Roman';
const ANCHO = 9026; // A4 con márgenes de 1"

// ---------- lectura ----------
const leer = (...p) => fs.readFileSync(path.join(...p), 'utf8').replace(/\r/g, '').replace(/^﻿/, '');
const codigo = (rel) => leer(RAIZ, rel).replace(/\n+$/, '').split('\n');

function dimensionesPng(buf) {
  if (buf.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

// ---------- bloques ----------
const t = (text, o = {}) => new TextRun({ text, ...o });
// Párrafo normal justificado. Acepta texto o un arreglo de TextRun (para negritas o cursivas dentro del párrafo).
const p = (contenido, o = {}) =>
  new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 160, line: 312 },
    ...o,
    children: typeof contenido === 'string' ? [t(contenido)] : contenido,
  });
const h1 = (s) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [t(s)] });
const h2 = (s) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [t(s)] });
const centro = (s, o = {}) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [t(s, o)] });
const pregunta = (s) => new Paragraph({ keepNext: true, spacing: { before: 200, after: 80 }, children: [t(s, { bold: true })] });

// Código: caja con borde fino gris; Word junta los párrafos consecutivos en un solo recuadro.
function bloqueCodigo(lineas, titulo) {
  const b = { style: BorderStyle.SINGLE, size: 4, color: '999999', space: 4 };
  const out = [];
  // El tamaño depende de la línea más larga para que ninguna se parta en dos.
  const maxLinea = Math.max(...lineas.map((l) => l.length));
  const tam = maxLinea > 100 ? 14 : maxLinea > 90 ? 15 : 17;
  if (titulo) out.push(new Paragraph({ keepNext: true, spacing: { before: 120, after: 60 }, children: [t(titulo, { italics: true, size: 20 })] }));
  lineas.forEach((l) => {
    out.push(new Paragraph({
      keepLines: true,
      spacing: { before: 0, after: 0, line: 240 },
      indent: { left: 120, right: 120 },
      border: { top: b, bottom: b, left: b, right: b },
      children: [t(l === '' ? ' ' : l, { font: 'Consolas', size: tam })],
    }));
  });
  out.push(new Paragraph({ spacing: { after: 160 }, children: [] }));
  return out;
}

// Tabla simple: bordes negros finos, sin colores.
const bn = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const bordes = { top: bn, bottom: bn, left: bn, right: bn };
function celda(texto, ancho, negrita = false, centrado = false) {
  return new TableCell({
    width: { size: ancho, type: WidthType.DXA },
    borders: bordes,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({ alignment: centrado ? AlignmentType.CENTER : AlignmentType.LEFT, spacing: { after: 0 }, children: [t(texto, { bold: negrita, size: 22 })] })],
  });
}
function tablaSimple(cabeceras, filas, anchos) {
  return new Table({
    width: { size: anchos.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: anchos,
    rows: [
      new TableRow({ tableHeader: true, children: cabeceras.map((c, i) => celda(c, anchos[i], true)) }),
      ...filas.map((f) => new TableRow({ cantSplit: true, children: f.map((c, i) => celda(c, anchos[i], false, i === f.length - 1)) })),
    ],
  });
}

// Recuadro visible cuando falta una captura: nunca se inventa evidencia.
function recuadroFalta(archivo, descripcion) {
  const b = { style: BorderStyle.DASHED, size: 8, color: 'C00000' };
  return new Table({
    width: { size: ANCHO, type: WidthType.DXA },
    columnWidths: [ANCHO],
    rows: [new TableRow({
      children: [new TableCell({
        width: { size: ANCHO, type: WidthType.DXA },
        borders: { top: b, bottom: b, left: b, right: b },
        margins: { top: 240, bottom: 240, left: 200, right: 200 },
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [t(`[Falta la captura: ${archivo}]`, { bold: true, color: 'C00000' })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [t(descripcion, { italics: true, size: 20 })] }),
        ],
      })],
    })],
  });
}

const faltantes = [];
let nFigura = 0;
function captura(base, descripcion) {
  nFigura += 1;
  const pie = new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 240 }, children: [t(`Figura ${nFigura}. ${descripcion}`, { italics: true, size: 20 })] });
  const f = path.join(CAPTURAS, `${base}.png`);
  if (!fs.existsSync(f)) {
    faltantes.push(base);
    return [recuadroFalta(`${base}.png`, descripcion), pie];
  }
  const buf = fs.readFileSync(f);
  const d = dimensionesPng(buf);
  if (!d) throw new Error(`No se pudo leer el tamaño de ${f}`);
  const esc = Math.min(1, 560 / d.w);
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 120, after: 0 },
      children: [new ImageRun({ type: 'png', data: buf, transformation: { width: Math.round(d.w * esc), height: Math.round(d.h * esc) }, altText: { title: descripcion, description: descripcion, name: base } })],
    }),
    pie,
  ];
}

const hijos = [];
const add = (...x) => x.flat().forEach((e) => hijos.push(e));
const cursiva = (s) => t(s, { italics: true });
const mono = (s) => t(s, { font: 'Consolas', size: 21 });

// ---------- Portada ----------
add(
  new Paragraph({ spacing: { before: 2600, after: 0 }, children: [] }),
  centro('Taller práctico', { size: 28 }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 0 }, children: [t('Implementación básica de Tool Calling', { bold: true, size: 40 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 480 }, children: [t('con Spring AI', { bold: true, size: 40 })] }),
  centro(CURSO, { size: 26 }),
  new Paragraph({ spacing: { before: 1200, after: 120 }, alignment: AlignmentType.CENTER, children: [t('Estudiantes', { bold: true, size: 26 })] }),
  ...ESTUDIANTES.map((n) => centro(n, { size: 26 })),
  new Paragraph({ spacing: { before: 1400, after: 0 }, children: [] }),
  centro(FECHA, { size: 24 }),
  new Paragraph({ children: [new PageBreak()] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [t('Contenido', { bold: true, size: 28 })] }),
  new TableOfContents('Contenido', { hyperlink: true, headingStyleRange: '1-2' }),
  new Paragraph({ children: [new PageBreak()] }),
);

// ---------- 1. Introducción ----------
add(
  h1('1. Introducción'),
  p('El objetivo de este taller es entender el mecanismo básico de Tool Calling en Spring AI: cómo un modelo de lenguaje puede pedirle a una aplicación Java que ejecute un método y cómo la aplicación lo ejecuta de verdad. Es un paso previo a temas más grandes, como RAG, memoria conversacional, bases de datos o MCP.'),
  p('La idea central es que el modelo no ejecuta código Java ni tiene acceso general a la aplicación; solo conoce las herramientas que el programador decide exponer. Nosotros definimos qué herramientas existen y el LLM decide cuándo pedir una y con qué argumentos. Después Spring ejecuta el método y le devuelve el resultado al modelo, que redacta la respuesta final.'),
  p('Construimos una pequeña API académica con las dos herramientas de la guía (calcular el promedio de tres notas y decir si un estudiante aprueba, con 3.0 como nota mínima) y le sumamos las dos de las actividades: la nota final ponderada y el estado según la asistencia. Todo se probó con un modelo real de Groq, y las capturas de este informe son de esa ejecución, hecha el 18 de noviembre de 2026. El código completo y las evidencias están en el repositorio: ' + REPO_URL),
);

// ---------- 2. Desarrollo ----------
const herr = codigo('src/main/java/com/ejemplo/toolcalling/tools/HerramientasAcademicas.java');
add(
  h1('2. Desarrollo'),
  h2('2.1 Creación del proyecto'),
  p([t('Creamos un proyecto Maven con Spring Boot, con group '), mono('com.ejemplo'), t(' y artifact '), mono('toolcalling'), t(', y con solo dos dependencias: Spring Web y Spring AI OpenAI. La estructura es la que pide la guía y se ve en la Figura 1: la clase '), mono('ToolCallingApplication'), t(', el paquete '), mono('controller'), t(' con '), mono('ChatController'), t(', el paquete '), mono('tools'), t(' con '), mono('HerramientasAcademicas'), t(', el archivo '), mono('application.properties'), t(' y el archivo '), mono('pruebas.http'), t(' en la raíz.')]),
  ...captura('01-estructura-proyecto', 'Estructura del proyecto abierta en VS Code.'),
  p('Hicimos algunos ajustes respecto a la guía, que ella misma pide adaptar según las versiones y el modelo disponibles. Usamos Java 21 en lugar de Java 25, porque es el JDK que tenemos instalado y es compatible con Spring Boot 3.5.16 y Spring AI 1.1.8. Trabajamos en VS Code, con el Extension Pack for Java y la extensión REST Client, en lugar de IntelliJ IDEA. El modelo que teníamos previsto, llama-3.3-70b-versatile, ya no aparece en la lista de la API de Groq (lo comprobamos consultando el endpoint /models), así que usamos openai/gpt-oss-120b, que sí soporta Tool Calling. Por último, en pruebas.http dejamos una línea en blanco entre las cabeceras y el cuerpo, porque REST Client la necesita para enviar el mensaje.'),

  h2('2.2 Las herramientas'),
  p([t('Las herramientas están en la clase '), mono('HerramientasAcademicas'), t(', marcada con '), mono('@Component'), t(' para que Spring la maneje como bean. Cada método anotado con '), mono('@Tool'), t(' es una capacidad que Spring AI le presenta al modelo: la descripción le explica para qué sirve y cuándo conviene pedirla, y los parámetros del método son los datos que el modelo tiene que sacar del mensaje del usuario. Todos los métodos imprimen una línea que empieza por '), mono('>>> TOOL'), t('. Esa línea es la evidencia de que el método se ejecutó en nuestra aplicación y de que el resultado no se lo inventó el modelo.')]),
  p([mono('calcularPromedio'), t(' y '), mono('estadoAcademico'), t(' son las de la guía. '), mono('calcularNotaFinal'), t(' (Actividad 1) recibe tres notas y tres porcentajes y devuelve la nota ponderada; si los porcentajes no suman 100, lanza una '), mono('IllegalArgumentException'), t(' con un mensaje claro. '), mono('estadoAsistencia'), t(' (Actividad 2) aplica una regla: con 80 % o más de asistencia devuelve '), mono('CUMPLE_ASISTENCIA'), t(', entre 60 % y 80 % devuelve '), mono('EN_RIESGO'), t(' y por debajo de 60 % devuelve '), mono('REPRUEBA_POR_INASISTENCIA'), t('. En estas dos últimas usamos además '), mono('@ToolParam'), t(' para describirle al modelo cada parámetro.')]),
  ...bloqueCodigo(herr, 'HerramientasAcademicas.java'),
  ...captura('02-herramientas-academicas-1', 'HerramientasAcademicas.java: las herramientas de la guía y el comienzo de calcularNotaFinal.'),
  ...captura('03-herramientas-academicas-2', 'HerramientasAcademicas.java: la validación de porcentajes y estadoAsistencia.'),

  h2('2.3 El controlador'),
  p([t('El controlador expone '), mono('POST /api/chat'), t(', recibe el mensaje como texto plano y se lo pasa al '), mono('ChatClient'), t('. La línea que importa es '), mono('.tools(herramientas)'), t(', que registra las herramientas disponibles para esa conversación. Nótese que el controlador nunca llama a '), mono('calcularPromedio()'), t(' ni a las demás: esa decisión se le deja al modelo.')]),
  ...bloqueCodigo(codigo('src/main/java/com/ejemplo/toolcalling/controller/ChatController.java'), 'ChatController.java'),
  ...captura('04-chat-controller', 'ChatController.java en VS Code.'),

  h2('2.4 Configuración del modelo'),
  p([t('La clave de la API no se escribe en el archivo: '), mono('application.properties'), t(' la toma de la variable de entorno '), mono('GROQ_API_KEY'), t(', y el modelo se puede cambiar con '), mono('GROQ_MODEL'), t(' sin tocar el código. Para ejecutar desde VS Code cargamos la variable con un archivo de entorno guardado fuera del repositorio, de modo que la clave nunca queda versionada.')]),
  ...bloqueCodigo(codigo('src/main/resources/application.properties'), 'application.properties'),
  ...captura('05-application-properties', 'application.properties leyendo la clave desde una variable de entorno.'),

  h2('2.5 Archivo de pruebas y ejecución'),
  p([t('El archivo '), mono('pruebas.http'), t(' reúne las cuatro pruebas de la guía y las preguntas de las actividades 3 y 4; su contenido completo está en el Anexo A. Cada petición se lanza con el enlace «Send Request» de REST Client, como se ve en la Figura 6.')]),
  ...captura('06-pruebas-http', 'Archivo pruebas.http con los enlaces Send Request de REST Client.'),
  p('Iniciamos la aplicación desde VS Code con Run and Debug. Arrancó sin errores en 1,56 segundos y escucha en el puerto 8080 (Figura 7). Durante todas las pruebas dejamos visible la consola de depuración, porque es ahí donde se comprueba cuándo se ejecuta una herramienta.'),
  ...captura('07-aplicacion-iniciada', 'Aplicación iniciada: «Tomcat started on port 8080» y «Started ToolCallingApplication in 1.56 seconds».'),

  h2('2.6 Pruebas automatizadas'),
  p('Además de probar contra Groq, dejamos 16 pruebas automatizadas que no necesitan clave. Trece revisan la lógica de cada herramienta, incluidos los límites de 3.0, 80 % y 60 %. Las otras tres comprueban el ciclo completo de Tool Calling usando un servidor local que imita el endpoint de chat de OpenAI: con ellas verificamos que Spring envía las cuatro herramientas al modelo, ejecuta el método Java, devuelve el resultado en un mensaje de rol tool y no ejecuta nada cuando la pregunta es conceptual. Estas pruebas también corren en el CI de GitHub Actions.'),
);

// ---------- 3. Pruebas de la guía ----------
add(
  h1('3. Pruebas de la guía'),
  p('El modelo puede redactar sus respuestas de forma distinta en otra ejecución, pero la herramienta que elige y los argumentos que le envía son los que muestra la consola.'),
  h2('3.1 Prueba 1: cálculo mediante una herramienta'),
  p([t('Enviamos «Calcula el promedio de las notas 4.0, 3.5 y 4.5». El modelo respondió que el promedio es 4.0 y en la consola apareció '), mono('>>> TOOL calcularPromedio ejecutada con: 4.0, 3.5, 4.5'), t(' (Figura 8). Esa línea es la prueba de que el resultado no salió solo de un texto del LLM: la aplicación ejecutó el método Java.')]),
  ...captura('08-prueba1-calcular-promedio', 'Prueba 1: la respuesta a la derecha y la línea de calcularPromedio en la consola.'),
  h2('3.2 Prueba 2: otro promedio'),
  p('Con «Tengo las notas 2.5, 2.8 y 3.2. Calcula mi promedio.» el modelo sacó bien los tres valores del texto y volvió a llamar a calcularPromedio. El método devolvió 2.8333333333333335 y el modelo lo redondeó a 2.83 al redactar la respuesta (Figura 9).'),
  ...captura('09-prueba2-otro-promedio', 'Prueba 2: calcularPromedio con 2.5, 2.8 y 3.2.'),
  h2('3.3 Prueba 3: selección de otra herramienta'),
  p('Con «Un estudiante tiene promedio 2.8. ¿Cuál es su estado académico?» el modelo no calculó nada, porque el promedio ya venía dado: eligió estadoAcademico con 2.8 y la lógica Java devolvió REPROBADO (Figura 10). Aquí se ve la selección entre varias herramientas.'),
  ...captura('10-prueba3-estado-academico', 'Prueba 3: el modelo elige estadoAcademico(2.8) y la respuesta es REPROBADO.'),
  h2('3.4 Prueba 4: una pregunta que no requiere herramienta'),
  p('Con «Explícame qué significa promedio académico.» el modelo respondió directamente, con una explicación larga (2 914 bytes), y la consola no registró ninguna herramienta nueva (Figura 11). Registrar herramientas no significa ejecutarlas siempre: el modelo solo las pide cuando las necesita.'),
  ...captura('11-prueba4-sin-tool', 'Prueba 4: respuesta conceptual sin ninguna línea nueva de herramienta en la consola.'),
);

// ---------- 4. Actividades ----------
add(
  h1('4. Actividades'),
  h2('4.1 Actividad 1: calcularNotaFinal'),
  p('Probamos con las notas 4.0, 3.0 y 5.0 y porcentajes de 30 %, 30 % y 40 %. El modelo llamó a calcularNotaFinal con esos seis valores y respondió 4.1, que coincide con la cuenta hecha a mano (1,2 + 0,9 + 2,0) (Figura 12).'),
  ...captura('12-a3-1-nota-final', 'calcularNotaFinal ejecutada con las notas 4.0, 3.0 y 5.0 y los porcentajes 30, 30 y 40.'),
  h2('4.2 Actividad 2: estadoAsistencia'),
  p('Preguntamos por un estudiante que asistió al 75 % de las clases. La herramienta se ejecutó con 75.0 y devolvió EN_RIESGO (Figura 13).'),
  ...captura('13-a3-2-asistencia', 'estadoAsistencia ejecutada con 75.0 %; respuesta: EN_RIESGO.'),
  h2('4.3 Actividad 3: prueba de selección'),
  p('Con las cuatro herramientas disponibles hicimos cinco preguntas distintas y anotamos, a partir de la consola, qué herramienta eligió el modelo. Las dos primeras ya aparecen en las actividades anteriores: la de la nota definitiva usó calcularNotaFinal y la de la asistencia usó estadoAsistencia.'),
  p('La tercera, «Necesito el promedio simple de 3.2, 4.1 y 2.9», nos sorprendió. Esperábamos calcularPromedio, pero la consola no imprimió nada: el modelo hizo la cuenta por su cuenta y respondió 3.4, que es correcto, sin usar la herramienta (Figura 14). Probablemente le pareció innecesario para tres números tan simples. Repetimos la consulta con una redacción más explícita, «Calcula el promedio de las notas 3.2, 4.1 y 2.9», y esta vez sí ejecutó calcularPromedio(3.2, 4.1, 2.9) (Figura 15). Dejamos los dos intentos tal como ocurrieron, porque muestran que la decisión es del modelo, que depende de cómo se formule la petición y que no es determinista.'),
  ...captura('14-a3-3-sin-tool-intento', 'Tercera pregunta: respuesta correcta, pero la consola no registra ninguna herramienta.'),
  ...captura('19-a3-3b-promedio-explicito', 'La misma consulta con redacción explícita: ahora sí se ejecuta calcularPromedio(3.2, 4.1, 2.9).'),
  p('En la cuarta, «Si mi promedio es 3.4, ¿estoy aprobado o reprobado?», el modelo eligió estadoAcademico con 3.4 y respondió APROBADO (Figura 16). En la quinta, «Mis notas son 2.0, 3.0 y 2.5. Calcula mi promedio y dime si aprobé», encadenó dos herramientas: primero calcularPromedio(2.0, 3.0, 2.5) y después estadoAcademico(2.5), con resultado REPROBADO (Figura 17).'),
  ...captura('15-a3-4-estado-academico', 'Cuarta pregunta: el modelo elige estadoAcademico(3.4) y responde APROBADO.'),
  ...captura('16-a3-5-encadenadas', 'Quinta pregunta: dos herramientas encadenadas, calcularPromedio y estadoAcademico.'),
  p('La Figura 18 muestra la consola completa, con las nueve ejecuciones de herramientas en el orden en que ocurrieron. También dejamos la transcripción en el repositorio, en docs/evidencias/consola/consola-tools.txt.'),
  ...captura('20-consola-completa', 'Consola de depuración con todas las ejecuciones de herramientas de la sesión.'),
  h2('4.4 Actividad 4: preguntas sin herramienta'),
  p('Diseñamos dos preguntas que se responden sin herramientas. La primera, «¿Qué diferencia hay entre una nota definitiva y una nota parcial?», es conceptual: la respuesta es conocimiento general que el modelo ya tiene, no hay números que procesar ni nada de la aplicación que ejecutar, así que ninguna de las cuatro herramientas aplicaba (Figura 19). La segunda, «Dame tres consejos breves para organizar mi tiempo de estudio», es un consejo general que no depende de datos ni de reglas de la aplicación; llamar a una herramienta no habría aportado nada y solo habría sumado un viaje extra al modelo (Figura 20). En ambos casos la consola no registró ninguna línea >>> TOOL nueva.'),
  ...captura('17-a4-1-sin-tool', 'Primera pregunta sin herramienta: nota definitiva frente a nota parcial.'),
  ...captura('18-a4-2-sin-tool', 'Segunda pregunta sin herramienta: consejos para organizar el tiempo de estudio.'),
);

// ---------- 5. Preguntas de análisis ----------
add(
  h1('5. Preguntas de análisis'),
  p('La guía numera estas preguntas del 5 al 11 por un error de formato; aquí las numeramos del 1 al 7, en el mismo orden.'),
  pregunta('1. ¿Cuál es la función de la anotación @Tool?'),
  p('Marca un método Java como una capacidad que Spring AI puede presentarle al modelo. A partir del método y de su descripción, Spring AI arma el nombre, la descripción y el esquema de parámetros que se le envían al LLM y, cuando el modelo pide la herramienta, invoca ese método.'),
  pregunta('2. ¿Por qué es importante escribir una descripción precisa para cada herramienta?'),
  p('Porque es lo único que el modelo sabe de la herramienta. Con esa descripción decide si le sirve, cuándo pedirla y qué valores enviarle; si es vaga o ambigua, puede no usarla, elegir la equivocada o mandar mal los argumentos. Por eso en las herramientas nuevas también describimos cada parámetro con @ToolParam (por ejemplo, que los porcentajes van de 0 a 100). El caso de la tercera pregunta de la Actividad 3 mostró, además, que la forma de pedir las cosas influye en que el modelo use o no la herramienta.'),
  pregunta('3. ¿Quién decide qué herramienta solicitar: el controlador o el LLM?'),
  p('El LLM. El controlador solo registra las herramientas disponibles con .tools(herramientas) y nunca llama directamente a calcularPromedio() ni a estadoAcademico(). En la Prueba 3, por ejemplo, el modelo eligió estadoAcademico y no calcularPromedio.'),
  pregunta('4. ¿Quién ejecuta realmente el método Java?'),
  p('La aplicación Spring, dentro de la JVM. El modelo solo devuelve una solicitud con el nombre de la herramienta y los argumentos; Spring AI la recibe, invoca el método y le devuelve el resultado al modelo para que redacte la respuesta final. La evidencia es el mensaje «>>> TOOL ...» que imprime el propio método en la consola de la aplicación, y además una prueba automatizada con un modelo simulado comprueba el ciclo completo.'),
  pregunta('5. ¿Qué diferencia existe entre exponer una Tool y llamar directamente un método desde el controlador?'),
  p('En la llamada directa el programador elige el método y escribe los argumentos en el código, así que el comportamiento es determinista y no interviene ningún modelo. Al exponer una Tool, en cambio, el LLM interpreta la intención del usuario, elige entre las herramientas y extrae los argumentos del lenguaje natural. Se gana flexibilidad, pero se pierde determinismo (como pasó en la tercera pregunta de la Actividad 3) y se añaden latencia y costo por los viajes extra al modelo.'),
  pregunta('6. ¿Por qué no todas las preguntas deberían provocar una llamada a herramientas?'),
  p('Porque muchas se responden directamente, como la Prueba 4 y las de la Actividad 4, y llamar a una herramienta sería innecesario: agrega una ida y vuelta más al modelo (más latencia y más tokens), ejecuta código sin necesidad y amplía la superficie de riesgo. Registrar herramientas no obliga a usarlas; el modelo decide.'),
  pregunta('7. ¿Qué riesgos existirían si una aplicación expusiera como Tools operaciones sensibles sin controles adicionales?'),
  p('El principal es la ejecución no deseada. El modelo puede equivocarse, inventar argumentos o ser manipulado con una inyección de instrucciones (prompt injection) escondida en el texto del usuario o en datos que lea, y la herramienta se ejecutaría con los permisos de la aplicación. Eso podría significar borrar o modificar datos, hacer pagos o filtrar información privada. Además, el modelo no sabe quién es el usuario ni a qué tiene derecho, así que la autorización no puede delegarse en él. Para reducir el riesgo habría que exponer lo mínimo y preferir herramientas de solo lectura, validar siempre los argumentos en Java, comprobar autenticación y permisos dentro de cada herramienta, pedir confirmación humana en las acciones destructivas y limitar y registrar cada ejecución para poder auditarla.'),
);

// ---------- 6. Criterios de verificación ----------
add(
  h1('6. Criterios de verificación'),
  p('Estos son los criterios de la guía con la evidencia que respalda cada uno.'),
  tablaSimple(['Criterio', 'Evidencia', 'Verificación'], [
    ['Proyecto ejecuta correctamente', 'La aplicación inicia sin errores (Figura 7) y las 16 pruebas automatizadas pasan', 'Sí'],
    ['Tools correctamente declaradas', 'Uso de @Tool y descripciones (Figuras 2 y 3)', 'Sí'],
    ['LLM utiliza calcularPromedio', 'Mensaje de consola de la Prueba 1 (Figura 8)', 'Sí'],
    ['LLM selecciona otra Tool', 'Prueba 3, estadoAcademico (Figura 10)', 'Sí'],
    ['Existe una consulta sin Tool', 'Prueba 4 y Actividad 4, sin ejecución en consola (Figuras 11, 19 y 20)', 'Sí'],
    ['Extensión realizada', 'calcularNotaFinal y estadoAsistencia funcionando (Figuras 12 y 13)', 'Sí'],
  ], [2700, 5026, 1300]),
  new Paragraph({ spacing: { after: 200 }, children: [] }),
);

// ---------- 7. Conclusiones ----------
add(
  h1('7. Conclusiones'),
  p('Con @Tool y .tools(herramientas) fue suficiente para que el modelo eligiera entre cuatro métodos Java, sacara sus argumentos del lenguaje natural y respondiera apoyándose en lo que calculó la aplicación. Lo más importante del taller es el reparto de responsabilidades: nosotros definimos qué se puede hacer y bajo qué reglas (por ejemplo, el mínimo de 3.0) y el modelo solo decide cuándo pedirlo. Por eso las validaciones tienen que estar en el código Java y no en el texto de un prompt.'),
  p('También vimos el límite del mecanismo: el modelo no está obligado a usar las herramientas ni lo hace siempre igual, como pasó en la tercera pregunta de la Actividad 3. Si una operación debe ejecutarse siempre, hay que tenerlo en cuenta al diseñar. El siguiente paso natural es conectar estas herramientas con servicios, repositorios JPA, bases de datos o APIs externas, manteniendo los controles de seguridad de la pregunta 7.'),
);

// ---------- Anexos ----------
add(
  h1('Anexo A. Archivo pruebas.http'),
  ...bloqueCodigo(codigo('pruebas.http')),
  h1('Anexo B. Cómo ejecutar el proyecto'),
  p('La clave se define como variable de entorno y nunca se escribe en el repositorio. Con ella configurada, se ejecuta con el Maven Wrapper:'),
  ...bloqueCodigo([
    '# PowerShell:  $env:GROQ_API_KEY = "<su-clave>"',
    '# Bash:        export GROQ_API_KEY=<su-clave>',
    '',
    './mvnw spring-boot:run',
    '',
    'curl -X POST http://localhost:8080/api/chat -H "Content-Type: text/plain" \\',
    '     -d "Calcula el promedio de las notas 4.0, 3.5 y 4.5"',
    '',
    '# Pruebas automatizadas (no necesitan clave real)',
    './mvnw verify',
  ]),
);

const doc = new Document({
  creator: ESTUDIANTES.join(', '),
  title: 'Taller práctico: Tool Calling con Spring AI',
  styles: {
    default: { document: { run: { font: FUENTE, size: 24 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 28, bold: true, font: FUENTE, color: '000000' }, paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 0, keepNext: true } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 24, bold: true, font: FUENTE, color: '000000' }, paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1, keepNext: true } },
    ],
  },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    footers: {
      default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], size: 20 })] })] }),
    },
    children: hijos,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(SALIDA, buf);
  console.log(`Informe generado: ${SALIDA} (${(buf.length / 1024).toFixed(0)} KB)`);
  if (faltantes.length) console.log(`Capturas pendientes (${faltantes.length}): ${faltantes.join(', ')}`);
});
