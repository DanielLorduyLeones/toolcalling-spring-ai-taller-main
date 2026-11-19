package com.ejemplo.toolcalling.controller;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Prueba el ciclo completo de Tool Calling sin consumir la API real: un servidor HTTP local
 * imita el endpoint /v1/chat/completions de un proveedor compatible con OpenAI y responde lo
 * que respondería un LLM (primero pide una herramienta, luego redacta la respuesta final).
 * Así se demuestra que es Spring quien ejecuta el método Java y que le devuelve el resultado al modelo.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ExtendWith(OutputCaptureExtension.class)
class ChatControllerToolCallingTest {

    private static final Deque<String> RESPUESTAS = new ArrayDeque<>();
    private static final List<String> PETICIONES = new ArrayList<>();
    private static final HttpServer LLM_FALSO = iniciarLlmFalso();

    @Autowired
    MockMvc mockMvc;

    private static HttpServer iniciarLlmFalso() {
        try {
            HttpServer servidor = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            servidor.createContext("/v1/chat/completions", intercambio -> {
                String cuerpo = new String(intercambio.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
                String respuesta;
                synchronized (RESPUESTAS) {
                    PETICIONES.add(cuerpo);
                    respuesta = RESPUESTAS.poll();
                }
                byte[] bytes = respuesta.getBytes(StandardCharsets.UTF_8);
                intercambio.getResponseHeaders().add("Content-Type", "application/json");
                intercambio.sendResponseHeaders(200, bytes.length);
                intercambio.getResponseBody().write(bytes);
                intercambio.close();
            });
            servidor.start();
            return servidor;
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    @DynamicPropertySource
    static void propiedades(DynamicPropertyRegistry registro) {
        registro.add("spring.ai.openai.base-url", () -> "http://127.0.0.1:" + LLM_FALSO.getAddress().getPort());
        registro.add("spring.ai.openai.api-key", () -> "clave-ficticia");
    }

    @AfterAll
    static void detener() {
        LLM_FALSO.stop(0);
    }

    @BeforeEach
    void limpiar() {
        RESPUESTAS.clear();
        PETICIONES.clear();
    }

    private static String pideHerramienta(String nombre, String argumentosJson) {
        return """
                {"id":"chatcmpl-1","object":"chat.completion","created":1,"model":"modelo-falso",
                 "choices":[{"index":0,"finish_reason":"tool_calls","message":{"role":"assistant","content":null,
                 "tool_calls":[{"id":"call_1","type":"function","function":{"name":"%s","arguments":%s}}]}}],
                 "usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}
                """.formatted(nombre, com.fasterxml.jackson.databind.node.TextNode.valueOf(argumentosJson));
    }

    private static String respuestaFinal(String texto) {
        return """
                {"id":"chatcmpl-2","object":"chat.completion","created":2,"model":"modelo-falso",
                 "choices":[{"index":0,"finish_reason":"stop","message":{"role":"assistant","content":"%s"}}],
                 "usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}
                """.formatted(texto);
    }

    @Test
    void cuandoElModeloPideUnaHerramientaSpringEjecutaElMetodoJava(CapturedOutput salida) throws Exception {
        RESPUESTAS.add(pideHerramienta("calcularPromedio", "{\"nota1\":4.0,\"nota2\":3.5,\"nota3\":4.5}"));
        RESPUESTAS.add(respuestaFinal("El promedio es 4.0"));

        mockMvc.perform(post("/api/chat")
                        .contentType(MediaType.TEXT_PLAIN)
                        .content("Calcula el promedio de las notas 4.0, 3.5 y 4.5"))
                .andExpect(status().isOk())
                .andExpect(content().string("El promedio es 4.0"));

        // 1) El método Java se ejecutó de verdad en la aplicación.
        assertThat(salida.getOut()).contains(">>> TOOL calcularPromedio ejecutada con: 4.0, 3.5, 4.5");
        // 2) Hubo dos viajes al modelo: la petición con las herramientas y la que devuelve el resultado.
        assertThat(PETICIONES).hasSize(2);
        assertThat(PETICIONES.get(0))
                .contains("calcularPromedio", "estadoAcademico", "calcularNotaFinal", "estadoAsistencia");
        assertThat(PETICIONES.get(1)).contains("\"role\":\"tool\"").contains("4.0");
    }

    @Test
    void elModeloPuedeElegirOtraHerramienta(CapturedOutput salida) throws Exception {
        RESPUESTAS.add(pideHerramienta("estadoAcademico", "{\"promedio\":2.8}"));
        RESPUESTAS.add(respuestaFinal("El estudiante está REPROBADO"));

        mockMvc.perform(post("/api/chat")
                        .contentType(MediaType.TEXT_PLAIN)
                        .content("Un estudiante tiene promedio 2.8. ¿Cuál es su estado académico?"))
                .andExpect(status().isOk())
                .andExpect(content().string("El estudiante está REPROBADO"));

        assertThat(salida.getOut()).contains(">>> TOOL estadoAcademico ejecutada con promedio: 2.8");
        assertThat(salida.getOut()).doesNotContain(">>> TOOL calcularPromedio");
        assertThat(PETICIONES.get(1)).contains("REPROBADO");
    }

    @Test
    void unaPreguntaConceptualNoEjecutaNingunaHerramienta(CapturedOutput salida) throws Exception {
        RESPUESTAS.add(respuestaFinal("El promedio académico resume el rendimiento de un estudiante."));

        mockMvc.perform(post("/api/chat")
                        .contentType(MediaType.TEXT_PLAIN)
                        .content("Explícame qué significa promedio académico."))
                .andExpect(status().isOk());

        // Las herramientas estaban registradas, pero el modelo no las pidió: un solo viaje y sin mensajes TOOL.
        assertThat(PETICIONES).hasSize(1);
        assertThat(salida.getOut()).doesNotContain(">>> TOOL");
    }
}
