package com.example.snstimeline.dto;

/** F-01・F-02 のレスポンス。followerCount は相手の最新のフォロワー数 */
public record FollowResponse(boolean followedByMe, long followerCount) {
}
