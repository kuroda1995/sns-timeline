package com.example.snstimeline;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.snstimeline.config.CorsConfig;
import com.example.snstimeline.config.JwtConfig;
import com.example.snstimeline.config.OpenApiConfig;
import com.example.snstimeline.config.SecurityConfig;
import com.example.snstimeline.service.JwtService;
import com.example.snstimeline.service.PostQueryService;
import org.junit.jupiter.api.Test;
import org.springdoc.core.configuration.SpringDocConfiguration;
import org.springdoc.core.properties.SpringDocConfigProperties;
import org.springdoc.core.properties.SwaggerUiConfigProperties;
import org.springdoc.core.properties.SwaggerUiOAuthProperties;
import org.springdoc.webmvc.core.configuration.SpringDocWebMvcConfiguration;
import org.springdoc.webmvc.ui.SwaggerConfig;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * application.properties の設定のまま(本番と同じ)では、API仕様書・Swagger UI を公開しないことを確認する(設計書 4-4)。
 * ローカルでは application-local.properties で有効にする。
 */
@WebMvcTest(com.example.snstimeline.controller.TimelineController.class)
@ImportAutoConfiguration({SpringDocConfiguration.class, SpringDocConfigProperties.class,
        SpringDocWebMvcConfiguration.class, SwaggerConfig.class, SwaggerUiConfigProperties.class,
        SwaggerUiOAuthProperties.class})
@Import({SecurityConfig.class, CorsConfig.class, JwtConfig.class, JwtService.class, OpenApiConfig.class})
@TestPropertySource(properties = "app.jwt.secret=test-secret-key-that-is-at-least-32-bytes-long")
class OpenApiExposureTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private PostQueryService postQueryService;

    @Test
    void 本番の設定ではAPI仕様書を公開しない() throws Exception {
        mockMvc.perform(get("/v3/api-docs")).andExpect(status().isNotFound());
        mockMvc.perform(get("/v3/api-docs.yaml")).andExpect(status().isNotFound());
    }

    @Test
    void 本番の設定ではSwaggerUIを公開しない() throws Exception {
        mockMvc.perform(get("/swagger-ui.html")).andExpect(status().isNotFound());
        mockMvc.perform(get("/swagger-ui/index.html")).andExpect(status().isNotFound());
    }
}
