package com.example.snstimeline.service.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.snstimeline.exception.ApiException;
import com.example.snstimeline.service.storage.ImageValidator.ValidatedImage;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;

class ImageValidatorTest {

    private final ImageValidator validator = new ImageValidator();

    private static byte[] bytes(int... values) {
        byte[] b = new byte[values.length];
        for (int i = 0; i < values.length; i++) {
            b[i] = (byte) values[i];
        }
        return b;
    }

    private static MockMultipartFile file(String name, String contentType, byte[] content) {
        return new MockMultipartFile("images", name, contentType, content);
    }

    @Test
    void 先頭のバイト列でjpg_png_gif_webpを判定する() {
        assertThat(validator.validate(file("a.jpg", "image/jpeg", bytes(0xFF, 0xD8, 0xFF, 0xE0, 0, 0)), "images").type())
                .isEqualTo(ImageType.JPEG);
        assertThat(validator.validate(file("a.png", "image/png", bytes(0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A)), "images").type())
                .isEqualTo(ImageType.PNG);
        assertThat(validator.validate(file("a.gif", "image/gif", "GIF89a....".getBytes(StandardCharsets.US_ASCII)), "images").type())
                .isEqualTo(ImageType.GIF);
        assertThat(validator.validate(file("a.webp", "image/webp", "RIFF\0\0\0\0WEBPVP8 ".getBytes(StandardCharsets.US_ASCII)), "images").type())
                .isEqualTo(ImageType.WEBP);
    }

    @Test
    void 拡張子やContentTypeではなく中身で判定する() {
        // 中身は PNG だが、名前は .jpg・Content-Type は image/jpeg
        ValidatedImage image = validator.validate(
                file("photo.jpg", "image/jpeg", bytes(0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A)), "images");

        assertThat(image.type()).isEqualTo(ImageType.PNG);
        assertThat(image.type().extension()).isEqualTo("png");
    }

    @Test
    void 拡張子だけjpgに変えたHTMLや空のファイルは400() {
        byte[] html = "<html><script>alert(1)</script></html>".getBytes(StandardCharsets.UTF_8);

        assertThatThrownBy(() -> validator.validate(file("evil.jpg", "image/jpeg", html), "images"))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(e.getField()).isEqualTo("images");
                    assertThat(e.getMessage()).isEqualTo(ImageValidator.TYPE_MESSAGE);
                });
        assertThatThrownBy(() -> validator.validate(file("empty.png", "image/png", new byte[0]), "avatar"))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getField()).isEqualTo("avatar"));
        // GIF の判定は "GIF8" の後が 7a か 9a のときだけ
        assertThatThrownBy(() -> validator.validate(file("a.gif", "image/gif", "GIF8xx".getBytes(StandardCharsets.US_ASCII)), "images"))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void サイズは5MBちょうどまで受け付け_超えると413() {
        byte[] jpegHeader = bytes(0xFF, 0xD8, 0xFF);
        byte[] fiveMb = new byte[(int) ImageValidator.MAX_SIZE];
        System.arraycopy(jpegHeader, 0, fiveMb, 0, jpegHeader.length);
        byte[] over = new byte[(int) ImageValidator.MAX_SIZE + 1];
        System.arraycopy(jpegHeader, 0, over, 0, jpegHeader.length);

        assertThat(validator.validate(file("ok.jpg", "image/jpeg", fiveMb), "images").type()).isEqualTo(ImageType.JPEG);
        assertThatThrownBy(() -> validator.validate(file("big.jpg", "image/jpeg", over), "images"))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.PAYLOAD_TOO_LARGE);
                    assertThat(e.getMessage()).isEqualTo(ImageValidator.SIZE_MESSAGE);
                });
    }
}
