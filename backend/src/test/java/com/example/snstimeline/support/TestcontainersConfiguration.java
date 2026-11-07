package com.example.snstimeline.support;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * テスト用の PostgreSQL を Docker で起動する(設計書 7)。
 * テストのたびに空のDBを作り、終わったら捨てるため、開発用・本番用のDBには一切書き込まない。
 * H2 では schema.sql の関数インデックス(LOWER(username))や ON CONFLICT・ILIKE を本番と同じように扱えないため、
 * 本番と同じ PostgreSQL 16 を使う。接続先は @ServiceConnection が自動で設定する。
 */
@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

    @Bean
    @ServiceConnection
    PostgreSQLContainer postgres() {
        return new PostgreSQLContainer("postgres:16");
    }
}
