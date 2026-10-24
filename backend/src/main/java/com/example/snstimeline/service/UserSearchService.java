package com.example.snstimeline.service;

import com.example.snstimeline.dto.UserListResponse;
import com.example.snstimeline.dto.UserSearchResponse;
import com.example.snstimeline.entity.User;
import com.example.snstimeline.exception.ApiException;
import com.example.snstimeline.repository.UserRepository;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** ユーザー検索・新しく参加したユーザー(ユーザー検索機能 SRCH-01・04) */
@Service
public class UserSearchService {

    static final int PAGE_SIZE = 20;
    static final int MAX_KEYWORD_LENGTH = 50;

    private final UserRepository userRepository;
    private final FollowService followService;

    public UserSearchService(UserRepository userRepository, FollowService followService) {
        this.userRepository = userRepository;
        this.followService = followService;
    }

    /** 整えたキーワード。usernameOnly は先頭に @ が付いていたか(ユーザー名だけを検索する) */
    record Keyword(String text, boolean usernameOnly) {
    }

    /** U-01 ユーザー検索。page は0始まり、1ページ20件 */
    @Transactional(readOnly = true)
    public UserSearchResponse search(Long me, String q, int page) {
        Keyword keyword = normalizeKeyword(q);
        if (page < 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "リクエストの形式が正しくありません");
        }
        String pattern = "%" + escapeLike(keyword.text()) + "%";
        // 1件多く取得して、次のページがあるかを判定する
        List<User> users = userRepository.search(pattern, keyword.text(), !keyword.usernameOnly(),
                PAGE_SIZE + 1, page * PAGE_SIZE);
        boolean hasNext = users.size() > PAGE_SIZE;
        List<User> items = hasNext ? users.subList(0, PAGE_SIZE) : users;
        return new UserSearchResponse(followService.toSummaries(items, me), page, hasNext);
    }

    /** U-02 新しく参加したユーザー(検索する前の検索画面に表示する) */
    @Transactional(readOnly = true)
    public UserListResponse newUsers(Long me) {
        return new UserListResponse(followService.toSummaries(userRepository.findTop20ByIdNotOrderByCreatedAtDesc(me), me));
    }

    /**
     * 前後の空白を取り除き、先頭の @ を判定する(5-1)。@ を取り除いた後のキーワードが1〜50文字でなければ400。
     * 画面でも同じように整えてから送るが、APIを直接呼ばれた場合に備えてサーバーでも確認する。
     */
    static Keyword normalizeKeyword(String q) {
        String text = q == null ? "" : q.strip();
        boolean usernameOnly = text.startsWith("@");
        if (usernameOnly) {
            text = text.substring(1).strip();
        }
        if (text.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "検索するキーワードを入力してください", "q");
        }
        if (text.codePointCount(0, text.length()) > MAX_KEYWORD_LENGTH) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "50文字以内で入力してください", "q");
        }
        return new Keyword(text, usernameOnly);
    }

    /**
     * LIKE/ILIKE で特別な意味を持つ \ % _ の前に \ を付ける(6-1)。
     * ユーザー名には _ が使えるため、エスケープしないと taro_ で taro1 もヒットしてしまう。
     */
    static String escapeLike(String s) {
        return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
