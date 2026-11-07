package com.example.snstimeline;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.snstimeline.config.CorsConfig;
import com.example.snstimeline.config.JwtConfig;
import com.example.snstimeline.config.OpenApiConfig;
import com.example.snstimeline.config.SecurityConfig;
import com.example.snstimeline.service.AuthService;
import com.example.snstimeline.service.CommentService;
import com.example.snstimeline.service.FollowService;
import com.example.snstimeline.service.JwtService;
import com.example.snstimeline.service.LikeService;
import com.example.snstimeline.service.PostQueryService;
import com.example.snstimeline.service.PostService;
import com.example.snstimeline.service.UserSearchService;
import com.example.snstimeline.service.UserService;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.springdoc.core.configuration.SpringDocConfiguration;
import org.springdoc.core.configuration.SpringDocSecurityConfiguration;
import org.springdoc.core.configuration.SpringDocSpecPropertiesConfiguration;
import org.springdoc.core.properties.SpringDocConfigProperties;
import org.springdoc.webmvc.core.configuration.SpringDocWebMvcConfiguration;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * API仕様書 docs/api/openapi.yaml を Controller・DTO から生成する(設計書 4-4)。
 * <ul>
 * <li>通常の ./gradlew test: コミット済みの yaml と生成結果を比べ、違えば失敗する(APIを変えたのに仕様書が古いまま、を防ぐ)</li>
 * <li>./gradlew test -PupdateApiDoc: yaml を生成結果で書き換える</li>
 * </ul>
 * 全Controllerを読み込むが、Serviceはモックにするため、DBが無くても実行できる。
 */
@WebMvcTest
@ImportAutoConfiguration({SpringDocConfiguration.class, SpringDocConfigProperties.class,
        SpringDocSpecPropertiesConfiguration.class, SpringDocSecurityConfiguration.class,
        SpringDocWebMvcConfiguration.class})
@Import({SecurityConfig.class, CorsConfig.class, JwtConfig.class, JwtService.class, OpenApiConfig.class})
@TestPropertySource(properties = {
        "app.jwt.secret=test-secret-key-that-is-at-least-32-bytes-long",
        "springdoc.api-docs.enabled=true"})
class OpenApiDocTest {

    /** Gradle はテストを backend/ で実行する */
    private static final Path API_DOC = Path.of("..", "docs", "api", "openapi.yaml");

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AuthService authService;
    @MockitoBean
    private PostService postService;
    @MockitoBean
    private PostQueryService postQueryService;
    @MockitoBean
    private LikeService likeService;
    @MockitoBean
    private CommentService commentService;
    @MockitoBean
    private FollowService followService;
    @MockitoBean
    private UserService userService;
    @MockitoBean
    private UserSearchService userSearchService;

    @Test
    void API仕様書がコミット済みのdocs_api_openapi_yamlと一致する() throws Exception {
        String generated = normalize(mockMvc.perform(get("/v3/api-docs.yaml"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));

        if (Boolean.getBoolean("updateApiDoc")) {
            Files.createDirectories(API_DOC.getParent());
            Files.writeString(API_DOC, generated, StandardCharsets.UTF_8);
            return;
        }

        assertThat(Files.exists(API_DOC))
                .as("%s がありません。./gradlew test -PupdateApiDoc で生成してください", API_DOC)
                .isTrue();
        assertThat(normalize(Files.readString(API_DOC, StandardCharsets.UTF_8)))
                .as("API仕様書が実装と一致しません。./gradlew test -PupdateApiDoc で更新し、差分をコミットしてください")
                .isEqualTo(generated);
    }

    /** Windows で git が改行を CRLF に変えても一致するようにする */
    private static String normalize(String yaml) {
        return yaml.replace("\r\n", "\n");
    }
}
