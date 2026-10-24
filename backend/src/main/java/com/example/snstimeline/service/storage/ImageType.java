package com.example.snstimeline.service.storage;

import java.util.Arrays;
import java.util.Optional;

/**
 * 受け付ける画像の形式。形式はファイルの先頭のバイト列(マジックナンバー)で判定する(画像投稿機能 処理のルール No.1)。
 * 拡張子だけを .jpg に変えた別のファイル(HTMLなど)を受け付けないため。
 */
public enum ImageType {

    JPEG("jpg"),
    PNG("png"),
    GIF("gif"),
    WEBP("webp");

    private final String extension;

    ImageType(String extension) {
        this.extension = extension;
    }

    public String extension() {
        return extension;
    }

    /** ファイルの先頭のバイト列から形式を判定する。どれにも当てはまらなければ空 */
    public static Optional<ImageType> detect(byte[] b) {
        return Arrays.stream(values()).filter(type -> type.matches(b)).findFirst();
    }

    private boolean matches(byte[] b) {
        return switch (this) {
            // FF D8 FF
            case JPEG -> startsWith(b, 0, 0xFF, 0xD8, 0xFF);
            // 89 50 4E 47 0D 0A 1A 0A(\x89PNG\r\n\x1a\n)
            case PNG -> startsWith(b, 0, 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A);
            // "GIF87a" または "GIF89a"
            case GIF -> startsWith(b, 0, 'G', 'I', 'F', '8') && (startsWith(b, 4, '7', 'a') || startsWith(b, 4, '9', 'a'));
            // "RIFF" + ファイルサイズ(4バイト) + "WEBP"
            case WEBP -> startsWith(b, 0, 'R', 'I', 'F', 'F') && startsWith(b, 8, 'W', 'E', 'B', 'P');
        };
    }

    private static boolean startsWith(byte[] b, int offset, int... expected) {
        if (b.length < offset + expected.length) {
            return false;
        }
        for (int i = 0; i < expected.length; i++) {
            if ((b[offset + i] & 0xFF) != expected[i]) {
                return false;
            }
        }
        return true;
    }
}
