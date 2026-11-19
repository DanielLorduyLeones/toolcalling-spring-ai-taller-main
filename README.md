# Taller de Tool Calling con Spring AI

Taller práctico de **Desarrollo Web Avanzado**: una API REST en Spring Boot que expone métodos Java como *herramientas* (`@Tool`) para un LLM. El programador define qué herramientas existen; el modelo decide cuándo pedir una y con qué argumentos; la aplicación es la que ejecuta el método.

```
Usuario → ChatController → ChatClient → LLM
                                         ├─ responde directamente
                                         └─ pide una Tool → Spring ejecuta el método Java → resultado → LLM → respuesta final
```

**Informe con todas las evidencias:** [`docs/Informe-Taller-ToolCalling.pdf`](docs/Informe-Taller-ToolCalling.pdf) (también en [`.docx`](docs/Informe-Taller-ToolCalling.docx)).

## Herramientas

| Herramienta | Entrada | Resultado | Origen |
|---|---|---|---|
| `calcularPromedio` | `nota1`, `nota2`, `nota3` | Promedio numérico | Guía |
| `estadoAcademico` | `promedio` | `APROBADO` / `REPROBADO` (mínimo 3.0) | Guía |
| `calcularNotaFinal` | 3 notas y 3 porcentajes | Nota definitiva ponderada (los porcentajes deben sumar 100) | Actividad 1 |
| `estadoAsistencia` | `porcentajeAsistencia` | `CUMPLE_ASISTENCIA` (≥ 80), `EN_RIESGO` (≥ 60), `REPRUEBA_POR_INASISTENCIA` | Actividad 2 |

Cada herramienta imprime `>>> TOOL <nombre> ejecutada con: ...` en la consola: esa línea demuestra que el método Java se ejecutó en la aplicación y no que el modelo "inventó" el resultado.

## Requisitos

- JDK 21 (el wrapper de Maven viene incluido)
- Una API key de [Groq](https://console.groq.com/keys) (u otro proveedor compatible con OpenAI y con soporte de Tool Calling)

Stack: Java 21 · Spring Boot 3.5.16 · Spring AI 1.1.8 (`spring-ai-starter-model-openai`) · Maven.

## Ejecutar

La clave **nunca** se escribe en el repositorio: se lee de la variable de entorno `GROQ_API_KEY`.

```bash
# Bash
export GROQ_API_KEY=<su-clave>
./mvnw spring-boot:run
```

```powershell
# PowerShell
$env:GROQ_API_KEY = "<su-clave>"
./mvnw spring-boot:run
```

La aplicación escucha en `http://localhost:8080`. El modelo por defecto es `openai/gpt-oss-120b`; se puede cambiar con la variable `GROQ_MODEL`.

```bash
curl -X POST http://localhost:8080/api/chat -H "Content-Type: text/plain" \
     -d "Calcula el promedio de las notas 4.0, 3.5 y 4.5"
```

[`pruebas.http`](pruebas.http) contiene las cuatro pruebas de la guía y las preguntas de las actividades 3 y 4 (se ejecutan con la extensión *REST Client* de VS Code o con el cliente HTTP de IntelliJ). Mantenga visible la consola para ver qué herramienta se ejecuta.

## Pruebas automatizadas

```bash
./mvnw verify      # no necesita clave real
```

16 pruebas: la lógica de cada herramienta (13) y el ciclo completo de Tool Calling contra un servidor local que imita el endpoint de chat de OpenAI (3). Así se comprueba, sin consumir la API, que Spring envía las herramientas al modelo, ejecuta el método Java, devuelve el resultado al modelo y no ejecuta nada ante una pregunta conceptual.

## Resultados de la ejecución real

Ejecución del 18/11/2026 contra Groq (`openai/gpt-oss-120b`); las capturas están en [`docs/evidencias/capturas`](docs/evidencias/capturas) y el registro de consola en [`docs/evidencias/consola/consola-tools.txt`](docs/evidencias/consola/consola-tools.txt).

| Petición | Herramienta ejecutada | Respuesta |
|---|---|---|
| Prueba 1: promedio de 4.0, 3.5 y 4.5 | `calcularPromedio(4.0, 3.5, 4.5)` | 4.0 |
| Prueba 2: promedio de 2.5, 2.8 y 3.2 | `calcularPromedio(2.5, 2.8, 3.2)` | 2.83 |
| Prueba 3: promedio 2.8, ¿estado? | `estadoAcademico(2.8)` | REPROBADO |
| Prueba 4: ¿qué es el promedio académico? | *ninguna* | explicación conceptual |
| A3-1: nota definitiva ponderada | `calcularNotaFinal(4.0, 3.0, 5.0, 30, 30, 40)` | 4.1 |
| A3-2: asistencia del 75 % | `estadoAsistencia(75.0)` | EN_RIESGO |
| A3-3: "Necesito el promedio simple de…" | *ninguna* (el modelo calculó por sí mismo) | 3.4 |
| A3-3b: "Calcula el promedio de las notas…" | `calcularPromedio(3.2, 4.1, 2.9)` | 3.4 |
| A3-4: promedio 3.4, ¿aprobado? | `estadoAcademico(3.4)` | APROBADO |
| A3-5: promedio y estado en una sola pregunta | `calcularPromedio` → `estadoAcademico` | 2.5 y REPROBADO |
| A4-1 y A4-2: preguntas sin herramienta | *ninguna* | respuesta directa |

> **A3-3 es un resultado real, no un error:** registrar herramientas no obliga al modelo a usarlas. Con una redacción explícita (A3-3b) sí la usó. Se conservan ambos intentos.

## Estructura

```
toolcalling
├── src/main/java/com/ejemplo/toolcalling
│   ├── ToolCallingApplication.java
│   ├── controller/ChatController.java
│   └── tools/HerramientasAcademicas.java
├── src/main/resources/application.properties
├── src/test/java/...            # pruebas de las herramientas y del ciclo Tool Calling
├── pruebas.http
├── docs/                        # informe (docx/pdf), capturas y scripts para regenerarlo
└── .github/workflows/ci.yml
```

## Seguridad

Si una aplicación expusiera como Tools operaciones sensibles (borrar, pagar, leer datos privados) sin controles, un error del modelo o una inyección de instrucciones podría ejecutarlas. Aquí solo se exponen cálculos puros sin efectos secundarios. Ver la pregunta 7 del informe.
