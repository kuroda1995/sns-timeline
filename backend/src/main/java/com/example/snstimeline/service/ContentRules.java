package com.example.snstimeline.service;

import com.example.snstimeline.exception.ApiException;
import org.springframework.http.HttpStatus;

/** 投稿・コメントの本文の入力チェック(投稿機能 処理のルール No.1、コメント機能 SC-05)。どちらも同じルール */
final class ContentRules {

    static final int MAX_LENGTH = 140;

    private ContentRules() {
    }

    /**
     * 前後の空白・改行を取り除き、1〜140文字か確認する。
     * 絵文字も1文字と数えるため、文字数はコードポイント単位で数える。
     * multipart/form-data で送るとブラウザが改行を \r\n に変えるため、画面と同じく改行1つを1文字と数えられるよう \n にそろえる。
     */
    static String normalize(String content) {
        String normalized = content == null ? "" : content.replace("\r\n", "\n").replace('\r', '\n').strip();
        if (normalized.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "本文を入力してください", "content");
        }
        if (normalized.codePointCount(0, normalized.length()) > MAX_LENGTH) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "140文字以内で入力してください", "content");
        }
        return normalized;
    }
}
