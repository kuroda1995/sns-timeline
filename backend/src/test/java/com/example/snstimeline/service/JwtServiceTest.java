package com.example.snstimeline.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.snstimeline.config.JwtConfig;
import com.example.snstimeline.config.JwtProperties;
import com.example.snstimeline.entity.User;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.test.util.ReflectionTestUtils;

class JwtServiceTest {

    private static final String SECRET = "test-secret-key-that-is-at-least-32-bytes-long";

    private JwtDecoder decoder;
    private User user;

    @BeforeEach
    void setUp() {
        decoder = new JwtConfig(new JwtProperties(SECRET, null)).jwtDecoder();
        user = new User("hanako", "hanako@example.com", "hash", "花子");
        ReflectionTestUtils.setField(user, "id", 42L);
    }

    private static JwtService jwtService(String secret) {
        JwtProperties properties = new JwtProperties(secret, null);
        return new JwtService(new JwtConfig(properties).jwtEncoder(), properties);
    }

    @Test
    void issue_subにユーザーIDを入れ_有効期限は既定で24時間() {
        Jwt jwt = decoder.decode(jwtService(SECRET).issue(user));

        assertThat(jwt.getSubject()).isEqualTo("42");
        assertThat(jwt.getClaimAsString("iss")).isEqualTo("sns-timeline");
        assertThat(Duration.between(jwt.getIssuedAt(), jwt.getExpiresAt())).isEqualTo(Duration.ofHours(24));
        assertThat(jwt.getHeaders()).containsEntry("alg", "HS256");
    }

    @Test
    void 有効期限が切れたJWTは検証で拒否される() {
        // 25時間前に発行した(1時間前に期限が切れた)JWT。NimbusJwtDecoder は既定で60秒の猶予を見るため、それより前にする
        Instant issuedAt = Instant.now().minus(Duration.ofHours(25));
        JwtClaimsSet claims = JwtClaimsSet.builder().issuer("sns-timeline").subject("42")
                .issuedAt(issuedAt).expiresAt(issuedAt.plus(Duration.ofHours(24))).build();
        String expired = new JwtConfig(new JwtProperties(SECRET, null)).jwtEncoder()
                .encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
                .getTokenValue();

        assertThatThrownBy(() -> decoder.decode(expired)).isInstanceOf(JwtException.class)
                .hasMessageContaining("expired");
    }

    @Test
    void 別の秘密キーで署名したJWTは検証で拒否される() {
        String forged = jwtService("another-secret-key-that-is-at-least-32-bytes").issue(user);

        assertThatThrownBy(() -> decoder.decode(forged)).isInstanceOf(JwtException.class);
    }

    @Test
    void 秘密キーが32バイト未満なら起動時にエラー() {
        assertThatThrownBy(() -> new JwtProperties("short", null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("32バイト以上");
        assertThatThrownBy(() -> new JwtProperties(null, null)).isInstanceOf(IllegalStateException.class);
    }
}
