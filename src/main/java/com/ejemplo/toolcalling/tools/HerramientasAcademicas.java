package com.ejemplo.toolcalling.tools;

import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

@Component
public class HerramientasAcademicas {

    // ---------------------------------------------------------------
    // Herramientas del taller (Paso 2 de la guía)
    // ---------------------------------------------------------------

    @Tool(description = "Calcula el promedio de tres notas académicas")
    public double calcularPromedio(
            double nota1,
            double nota2,
            double nota3) {

        System.out.println(
                ">>> TOOL calcularPromedio ejecutada con: "
                        + nota1 + ", " + nota2 + ", " + nota3);

        return (nota1 + nota2 + nota3) / 3.0;
    }

    @Tool(description =
            "Determina si un estudiante está aprobado o reprobado según su promedio")
    public String estadoAcademico(double promedio) {

        System.out.println(
                ">>> TOOL estadoAcademico ejecutada con promedio: "
                        + promedio);

        return promedio >= 3.0 ? "APROBADO" : "REPROBADO";
    }

    // ---------------------------------------------------------------
    // Actividad 1: nota definitiva ponderada
    // ---------------------------------------------------------------

    @Tool(description =
            "Calcula la nota definitiva ponderada a partir de tres notas y sus respectivos "
                    + "porcentajes. Los porcentajes se expresan de 0 a 100 y deben sumar 100")
    public double calcularNotaFinal(
            @ToolParam(description = "Primera nota") double nota1,
            @ToolParam(description = "Segunda nota") double nota2,
            @ToolParam(description = "Tercera nota") double nota3,
            @ToolParam(description = "Porcentaje de la primera nota (0 a 100)") double porcentaje1,
            @ToolParam(description = "Porcentaje de la segunda nota (0 a 100)") double porcentaje2,
            @ToolParam(description = "Porcentaje de la tercera nota (0 a 100)") double porcentaje3) {

        System.out.println(
                ">>> TOOL calcularNotaFinal ejecutada con notas: "
                        + nota1 + ", " + nota2 + ", " + nota3
                        + " y porcentajes: "
                        + porcentaje1 + ", " + porcentaje2 + ", " + porcentaje3);

        double suma = porcentaje1 + porcentaje2 + porcentaje3;
        if (Math.abs(suma - 100.0) > 0.001) {
            throw new IllegalArgumentException(
                    "Los porcentajes deben sumar 100, pero suman " + suma);
        }

        return (nota1 * porcentaje1 + nota2 * porcentaje2 + nota3 * porcentaje3) / 100.0;
    }

    // ---------------------------------------------------------------
    // Actividad 2: estado según la asistencia
    // Regla: 80 % o más cumple; entre 60 % y 80 % queda en riesgo;
    //        por debajo de 60 % pierde la asignatura por inasistencia.
    // ---------------------------------------------------------------

    @Tool(description =
            "Determina el estado académico de un estudiante según su porcentaje de asistencia "
                    + "(de 0 a 100). Devuelve CUMPLE_ASISTENCIA, EN_RIESGO o REPRUEBA_POR_INASISTENCIA")
    public String estadoAsistencia(
            @ToolParam(description = "Porcentaje de asistencia, de 0 a 100") double porcentajeAsistencia) {

        System.out.println(
                ">>> TOOL estadoAsistencia ejecutada con asistencia: "
                        + porcentajeAsistencia + "%");

        if (porcentajeAsistencia >= 80.0) {
            return "CUMPLE_ASISTENCIA";
        }
        if (porcentajeAsistencia >= 60.0) {
            return "EN_RIESGO";
        }
        return "REPRUEBA_POR_INASISTENCIA";
    }
}
