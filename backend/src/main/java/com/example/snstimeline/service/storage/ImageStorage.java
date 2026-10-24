package com.example.snstimeline.service.storage;

/**
 * 画像ファイルの保存先(設計書 5章)。DBには保存キーだけを記録し、URLは画面に返すときに組み立てる。
 * フェーズ1はローカルのフォルダ(LocalImageStorage)、フェーズ2で S3 に保存する実装を追加して切り替える。
 */
public interface ImageStorage {

    /**
     * 画像を保存し、保存キー(例: posts/2026/10/550e8400-....jpg)を返す。
     * ファイル名はアップロード時の名前を使わず UUID で付け直す(上書き・不正なファイル名を防ぐため)。
     * @param directory 保存先のフォルダ(例: posts/2026/10、avatars)
     * @param extension 拡張子(ImageType#extension)
     */
    String save(byte[] content, String directory, String extension);

    /** 保存キーの画像を削除する。無ければ何もしない */
    void delete(String key);

    /** 保存キーから、画面で表示するためのURLを組み立てる。key が null なら null */
    String toUrl(String key);
}
