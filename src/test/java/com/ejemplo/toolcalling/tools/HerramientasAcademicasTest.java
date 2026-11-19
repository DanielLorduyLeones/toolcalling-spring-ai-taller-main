package com.ejemplo.toolcalling.tools;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Prueba la lógica Java pura de cada herramienta, sin LLM de por medio. */
class HerramientasAcademicasTest {

    private final HerramientasAcademicas herramientas = new HerramientasAcademicas();

    @Test
    void calcularPromedioDevuelveElPromedioDeLasTresNotas() {
        assertThat(herramientas.calcularPromedio(4.0, 3.5, 4.5)).isEqualTo(4.0);
        assertThat(herramientas.calcularPromedio(2.5, 2.8, 3.2)).isEqualTo(2.8333333333333335);
    }

    @ParameterizedTest
    @CsvSource({"2.8,REPROBADO", "2.99,REPROBADO", "3.0,APROBADO", "4.5,APROBADO"})
    void estadoAcademicoUsaTresComoNotaMinima(double promedio, String esperado) {
        assertThat(herramientas.estadoAcademico(promedio)).isEqualTo(esperado);
    }

    @Test
    void calcularNotaFinalAplicaLosPorcentajes() {
        // 4.0*30% + 3.0*30% + 5.0*40% = 1.2 + 0.9 + 2.0 = 4.1
        assertThat(herramientas.calcularNotaFinal(4.0, 3.0, 5.0, 30, 30, 40))
                .isCloseTo(4.1, org.assertj.core.data.Offset.offset(1e-9));
    }

    @Test
    void calcularNotaFinalRechazaPorcentajesQueNoSuman100() {
        assertThatThrownBy(() -> herramientas.calcularNotaFinal(4.0, 3.0, 5.0, 30, 30, 30))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("deben sumar 100");
    }

    @ParameterizedTest
    @CsvSource({
            "100,CUMPLE_ASISTENCIA",
            "80,CUMPLE_ASISTENCIA",
            "79.9,EN_RIESGO",
            "60,EN_RIESGO",
            "59.9,REPRUEBA_POR_INASISTENCIA",
            "0,REPRUEBA_POR_INASISTENCIA"})
    void estadoAsistenciaAplicaLaReglaDeUmbrales(double asistencia, String esperado) {
        assertThat(herramientas.estadoAsistencia(asistencia)).isEqualTo(esperado);
    }
}
