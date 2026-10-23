package com.example.snstimeline.dto;

/** L-01・L-02 のレスポンス。likeCount は他の人のいいねも含めた最新の数 */
public record LikeResponse(long likeCount, boolean likedByMe) {
}
