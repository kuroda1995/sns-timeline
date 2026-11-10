package com.example.snstimeline.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

/**
 * S3 に接続する部品(app.storage.type=s3 のときだけ作る)。
 * リージョンと権限は、ECS が渡す環境変数(AWS_REGION)とタスクの IAM ロールから AWS SDK が自動で読み取る。
 * アクセスキーは設定ファイルにも環境変数にも置かない。
 */
@Configuration
@ConditionalOnProperty(name = "app.storage.type", havingValue = "s3")
public class S3Config {

    @Bean
    public S3Client s3Client() {
        return S3Client.create();
    }

    @Bean
    public S3Presigner s3Presigner() {
        return S3Presigner.create();
    }
}
