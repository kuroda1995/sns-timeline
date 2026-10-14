package com.example.snstimeline.dto;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class SignupRequestTest {

    private static Validator validator;

    @BeforeAll
    static void setUpValidator() {
        validator = Validation.buildDefaultValidatorFactory().getValidator();
    }

    private static Set<String> invalidFields(SignupRequest request) {
        return validator.validate(request).stream()
                .map(ConstraintViolation::getPropertyPath)
                .map(Object::toString)
                .collect(Collectors.toSet());
    }

    @Test
    void メールアドレスは前後の空白を除き小文字にする() {
        SignupRequest request = new SignupRequest("hanako", "花子", "  Hanako@Example.COM ", "password123");

        assertThat(request.email()).isEqualTo("hanako@example.com");
        assertThat(invalidFields(request)).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"ab", "abcdefghijklmnop", "hana-ko", "はなこ", "hana ko"})
    void 不正なユーザー名はエラー(String username) {
        assertThat(invalidFields(new SignupRequest(username, "花子", "a@example.com", "password123")))
                .containsExactly("username");
    }

    @ParameterizedTest
    @ValueSource(strings = {"short1", "password", "12345678", "パスワード1234abcd", "pass word123"})
    void 不正なパスワードはエラー(String password) {
        assertThat(invalidFields(new SignupRequest("hanako", "花子", "a@example.com", password)))
                .containsExactly("password");
    }

    @Test
    void パスワードは72文字まで() {
        String max = "a1" + "x".repeat(70);
        assertThat(invalidFields(new SignupRequest("hanako", "花子", "a@example.com", max))).isEmpty();
        assertThat(invalidFields(new SignupRequest("hanako", "花子", "a@example.com", max + "x")))
                .containsExactly("password");
    }

    @Test
    void toStringにパスワードを含めない() {
        assertThat(new SignupRequest("hanako", "花子", "a@example.com", "password123").toString())
                .doesNotContain("password123");
    }
}
