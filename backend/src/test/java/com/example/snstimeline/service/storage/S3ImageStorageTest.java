package com.example.snstimeline.service.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.exception.SdkClientException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

class S3ImageStorageTest {

    private S3Client s3;
    private S3Presigner presigner;
    private S3ImageStorage storage;

    @BeforeEach
    void setUp() {
        s3 = mock(S3Client.class);
        // 署名付きURLはサーバーの中で計算するだけなので、テスト用の資格情報で本物の Presigner を使う(AWS には接続しない)
        presigner = S3Presigner.builder()
                .region(Region.AP_NORTHEAST_1)
                .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create("test-key", "test-secret")))
                .build();
        storage = new S3ImageStorage(s3, presigner, "images-bucket", Duration.ofHours(1));
    }

    @AfterEach
    void tearDown() {
        presigner.close();
    }

    @Test
    void save_UUIDのキーとContentTypeを付けてバケットに保存し保存キーを返す() {
        String key = storage.save(new byte[] {1, 2, 3}, "posts/2026/10", "png");

        assertThat(key).matches("posts/2026/10/[0-9a-f-]{36}\\.png");
        ArgumentCaptor<PutObjectRequest> request = ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(s3).putObject(request.capture(), any(RequestBody.class));
        assertThat(request.getValue().bucket()).isEqualTo("images-bucket");
        assertThat(request.getValue().key()).isEqualTo(key);
        assertThat(request.getValue().contentType()).isEqualTo("image/png");
    }

    @Test
    void save_同じ中身でも別のキーにする() {
        String key1 = storage.save(new byte[] {1}, "avatars", "jpg");
        String key2 = storage.save(new byte[] {1}, "avatars", "jpg");

        assertThat(key2).isNotEqualTo(key1);
    }

    @Test
    void delete_バケットから削除する_失敗しても例外にしない() {
        when(s3.deleteObject(any(DeleteObjectRequest.class))).thenThrow(SdkClientException.create("接続できない"));

        storage.delete("avatars/a.jpg");

        ArgumentCaptor<DeleteObjectRequest> request = ArgumentCaptor.forClass(DeleteObjectRequest.class);
        verify(s3).deleteObject(request.capture());
        assertThat(request.getValue().bucket()).isEqualTo("images-bucket");
        assertThat(request.getValue().key()).isEqualTo("avatars/a.jpg");
    }

    @Test
    void toUrl_有効期限1時間の署名付きURLを返す_nullならnull() {
        String url = storage.toUrl("posts/2026/10/a.png");

        assertThat(url).startsWith("https://images-bucket.s3.ap-northeast-1.amazonaws.com/posts/2026/10/a.png?")
                .contains("X-Amz-Expires=3600")
                .contains("X-Amz-Signature=");
        assertThat(storage.toUrl(null)).isNull();
    }

    @Test
    void contentType_拡張子から決める() {
        assertThat(S3ImageStorage.contentType("jpg")).isEqualTo("image/jpeg");
        assertThat(S3ImageStorage.contentType("png")).isEqualTo("image/png");
        assertThat(S3ImageStorage.contentType("gif")).isEqualTo("image/gif");
        assertThat(S3ImageStorage.contentType("webp")).isEqualTo("image/webp");
        assertThat(S3ImageStorage.contentType("exe")).isEqualTo("application/octet-stream");
    }
}
