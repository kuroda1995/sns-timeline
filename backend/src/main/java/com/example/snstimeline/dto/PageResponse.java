package com.example.snstimeline.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/** ページング付きの一覧(設計書 4-3)。hasNext が false のとき nextCursor は null */
public record PageResponse<T>(
        List<T> items,
        @Schema(types = {"integer", "null"}, format = "int64",
                description = "次のページを取得するときに cursor に渡す値。hasNext が false なら null") Long nextCursor,
        boolean hasNext) {
}
