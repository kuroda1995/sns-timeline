package com.example.snstimeline.support;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.context.annotation.Import;

/**
 * Repository のテスト(設計書 7)。JPA まわりだけを読み込み、Testcontainers の PostgreSQL に対してSQLを実際に実行する。
 * テストごとにトランザクションをロールバックするため、テスト同士でデータは混ざらない。
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@DataJpaTest
@Import(TestcontainersConfiguration.class)
public @interface RepositoryTest {
}
