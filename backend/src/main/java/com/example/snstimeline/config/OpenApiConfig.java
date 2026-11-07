package com.example.snstimeline.config;

import com.example.snstimeline.dto.ErrorResponse;
import io.swagger.v3.core.converter.AnnotatedType;
import io.swagger.v3.core.converter.ModelConverters;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.Operation;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import io.swagger.v3.oas.models.tags.Tag;
import java.util.ArrayList;
import java.util.List;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * API仕様書(OpenAPI)の共通設定(設計書 4-4)。
 * 各APIの説明・エラーは Controller の @Operation・@ApiResponse に書き、全APIに共通するものだけをここで付ける。
 */
@Configuration
public class OpenApiConfig {

    static final String BEARER_AUTH = "bearerAuth";

    private static final String ERROR_SCHEMA_REF = "#/components/schemas/ErrorResponse";

    @Bean
    public OpenAPI openApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("SNS Timeline API")
                        .version("v1")
                        .description("""
                                タイムライン型SNSアプリのAPI。各APIの summary の先頭は設計書 4-2 のAPI ID。
                                新規登録・ログイン以外は、A-01・A-02 で受け取ったJWTを `Authorization: Bearer <token>` で送る。"""))
                .servers(List.of(new Server().url("http://localhost:8080").description("ローカル")))
                .components(new Components().addSecuritySchemes(BEARER_AUTH, new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("JWT")))
                // 全APIでJWTが必要。不要なAPIは Controller で @SecurityRequirements を付けて外す
                .addSecurityItem(new SecurityRequirement().addList(BEARER_AUTH))
                // 設計書 4-2 の並び順。Swagger UI はこの順にグループを表示する
                .tags(List.of(
                        tag(ApiTags.AUTH, "認証機能(AUTH)"),
                        tag(ApiTags.TIMELINE, "タイムライン機能(TL)"),
                        tag(ApiTags.POST, "投稿機能(PST)・画像投稿機能(IMG)"),
                        tag(ApiTags.LIKE, "いいね機能(LIKE)"),
                        tag(ApiTags.COMMENT, "コメント機能(CMT)"),
                        tag(ApiTags.USER_SEARCH, "ユーザー検索機能(SRCH)"),
                        tag(ApiTags.PROFILE, "プロフィール機能(USER)"),
                        tag(ApiTags.FOLLOW, "フォロー機能(FLW)")));
    }

    /**
     * 全APIに共通する仕様を付ける。
     * <ul>
     * <li>エラー(4xx・5xx)のレスポンスの形を ErrorResponse にそろえる(設計書 4-1)</li>
     * <li>JWTが必要なAPIに 401 を付ける</li>
     * <li>レスポンスの項目はすべて必ず返すため required にする(フロントエンドの型生成で省略可能にならないように)</li>
     * </ul>
     */
    @Bean
    public OpenApiCustomizer commonResponsesCustomizer() {
        return openApi -> {
            Components components = openApi.getComponents();
            ModelConverters.getInstance(true)
                    .readAll(new AnnotatedType(ErrorResponse.class))
                    .forEach(components::addSchemas);

            if (openApi.getPaths() != null) {
                openApi.getPaths().values().forEach(path -> path.readOperations().forEach(operation -> {
                    if (requiresAuth(operation)) {
                        operation.getResponses().addApiResponse("401",
                                new ApiResponse().description("ログインしていない(JWTが無い・期限切れ・改ざんされている)"));
                    }
                    operation.getResponses().forEach((code, response) -> {
                        if (code.startsWith("4") || code.startsWith("5")) {
                            response.setContent(new Content().addMediaType(
                                    org.springframework.http.MediaType.APPLICATION_JSON_VALUE,
                                    new MediaType().schema(new Schema<>().$ref(ERROR_SCHEMA_REF))));
                        }
                    });
                }));
            }

            // リクエストの項目は入力チェックの @NotBlank などから自動で required になるため、レスポンスだけ対象にする
            components.getSchemas().forEach((name, schema) -> {
                if (!name.endsWith("Request") && schema.getProperties() != null) {
                    schema.setRequired(new ArrayList<>(schema.getProperties().keySet()));
                }
            });
        };
    }

    /** operation.security が null なら全体の設定(JWT必須)を引き継ぐ。空のリストなら @SecurityRequirements で外したAPI */
    private static boolean requiresAuth(Operation operation) {
        return operation.getSecurity() == null || !operation.getSecurity().isEmpty();
    }

    private static Tag tag(String name, String description) {
        return new Tag().name(name).description(description);
    }
}
