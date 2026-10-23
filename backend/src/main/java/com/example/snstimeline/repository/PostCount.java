package com.example.snstimeline.repository;

/** 投稿IDごとの件数(いいね数・コメント数をまとめて集計した結果の1行) */
public interface PostCount {

    Long getPostId();

    long getCount();
}
