package com.example.snstimeline.dto;

import java.util.List;

/** ページング付きの一覧(設計書 4-3)。hasNext が false のとき nextCursor は null */
public record PageResponse<T>(List<T> items, Long nextCursor, boolean hasNext) {
}
