# toolcalling-spring-ai-taller

Taller académico (Desarrollo Web Avanzado): API REST con Spring AI que expone métodos Java como herramientas (`@Tool`) a un LLM de Groq. Entregables: código funcional + informe con evidencias.

## Regla principal: el código sigue la guía

`HerramientasAcademicas` y `ChatController` reproducen el código de la guía (`Taller_ToolCalling_2026.pdf`), más las herramientas de las actividades 1 y 2. No "mejorar" el controlador ni mover la lógica a servicios: el objetivo es ver el mecanismo `@Tool` + `.tools(herramientas)` de forma simple. Cada herramienta imprime `>>> TOOL ...` a propósito: es la evidencia de la ejecución.

## Stack y comandos

Java 21, Spring Boot 3.5.16, Spring AI 1.1.8 (`spring-ai-starter-model-openai`), Maven Wrapper.

```bash
export GROQ_API_KEY=<clave>      # nunca en archivos del repo
./mvnw spring-boot:run           # :8080
./mvnw verify                    # 16 pruebas, sin clave real
```

Trampas conocidas:
- `llama-3.3-70b-versatile` ya no existe en Groq; el modelo por defecto es `openai/gpt-oss-120b` (variable `GROQ_MODEL` para cambiarlo). Antes de cambiarlo, consultar `GET https://api.groq.com/openai/v1/models`.
- El modelo no es determinista y no está obligado a usar las herramientas (caso A3-3 del informe).
- Las pruebas de `ChatControllerToolCallingTest` usan un servidor HTTP local que imita `/v1/chat/completions`; no llaman a Groq. En CI `GROQ_API_KEY` es un valor ficticio.
- En VS Code el lanzamiento con `envFile` y el terminal integrado **imprime el comando con todas las variables expandidas**: usar `"console": "internalConsole"` y un `envFile` mínimo (solo `GROQ_API_KEY`) fuera del repo antes de tomar capturas.

## Documentación e informe

`docs/Informe-Taller-ToolCalling.docx|pdf` se **genera**, no se edita a mano: `docs/informe/generar-informe.js` (`npm install && npm run generar`, luego `docs/informe/actualizar-indice.ps1` para el índice y el PDF; requiere Word). Lee el código real y `docs/evidencias/capturas/*.png`.

Las capturas son de una ejecución real (VS Code + REST Client, `docs/scripts/capturar-pantalla.ps1`). No fabricarlas ni editarlas; si se regraban, repetir la secuencia completa y actualizar la tabla de resultados del README y de la sección 8 del generador.

## Convenciones

Commits Conventional Commits en español, directo a `main`, sin `Co-Authored-By` de IA.
