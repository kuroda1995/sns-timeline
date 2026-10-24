package com.example.snstimeline.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.snstimeline.service.storage.ImageStorage;
import com.example.snstimeline.dto.UserListResponse;
import com.example.snstimeline.dto.UserSearchResponse;
import com.example.snstimeline.entity.User;
import com.example.snstimeline.exception.ApiException;
import com.example.snstimeline.repository.FollowRepository;
import com.example.snstimeline.repository.UserRepository;
import com.example.snstimeline.service.UserSearchService.Keyword;
import java.util.List;
import java.util.stream.LongStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;

class UserSearchServiceTest {

    private static final long ME = 2L;

    private UserRepository userRepository;
    private FollowRepository followRepository;
    private UserSearchService userSearchService;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        followRepository = mock(FollowRepository.class);
        userSearchService = new UserSearchService(userRepository, new FollowService(followRepository, userRepository, mock(ImageStorage.class)));
    }

    private static User user(long id, String username) {
        User user = new User(username, username + "@example.com", "hash", username);
        ReflectionTestUtils.setField(user, "id", id);
        return user;
    }

    private static void assertBadKeyword(String q, String message) {
        assertThatThrownBy(() -> UserSearchService.normalizeKeyword(q))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(e.getField()).isEqualTo("q");
                    assertThat(e.getMessage()).isEqualTo(message);
                });
    }

    @Test
    void normalizeKeyword_前後の空白を取り除き先頭の_at_があればユーザー名だけを検索する() {
        assertThat(UserSearchService.normalizeKeyword("  taro ")).isEqualTo(new Keyword("taro", false));
        assertThat(UserSearchService.normalizeKeyword(" @taro ")).isEqualTo(new Keyword("taro", true));
        // @ が途中にあるときは、そのまま文字として検索する
        assertThat(UserSearchService.normalizeKeyword("ta@ro")).isEqualTo(new Keyword("ta@ro", false));
    }

    @Test
    void normalizeKeyword_空や_at_だけや50文字を超えると400() {
        assertBadKeyword(null, "検索するキーワードを入力してください");
        assertBadKeyword(" 　", "検索するキーワードを入力してください");
        assertBadKeyword("@", "検索するキーワードを入力してください");
        UserSearchService.normalizeKeyword("😀".repeat(50));
        assertBadKeyword("あ".repeat(51), "50文字以内で入力してください");
    }

    @Test
    void escapeLike_バックスラッシュ_パーセント_アンダースコアをエスケープする() {
        assertThat(UserSearchService.escapeLike("taro_")).isEqualTo("taro\\_");
        assertThat(UserSearchService.escapeLike("%")).isEqualTo("\\%");
        assertThat(UserSearchService.escapeLike("a\\b")).isEqualTo("a\\\\b");
        assertThat(UserSearchService.escapeLike("太郎")).isEqualTo("太郎");
    }

    @Test
    void search_エスケープしたパターンとキーワードを渡し_at_付きなら表示名を対象にしない() {
        userSearchService.search(ME, "taro_", 0);
        verify(userRepository).search("%taro\\_%", "taro_", true, 21, 0);

        userSearchService.search(ME, "@taro", 2);
        verify(userRepository).search("%taro%", "taro", false, 21, 40);
    }

    @Test
    void search_21件取れたら20件だけ返しhasNextをtrueにする_followedByMeはまとめて判定() {
        List<User> users = LongStream.rangeClosed(1, 21).mapToObj(i -> user(100 + i, "taro" + i)).toList();
        when(userRepository.search(anyString(), anyString(), anyBoolean(), anyInt(), anyInt())).thenReturn(users);
        when(followRepository.findFollowedIds(ME, users.subList(0, 20).stream().map(User::getId).toList()))
                .thenReturn(List.of(101L));

        UserSearchResponse response = userSearchService.search(ME, "taro", 0);

        assertThat(response.items()).hasSize(20);
        assertThat(response.hasNext()).isTrue();
        assertThat(response.page()).isZero();
        assertThat(response.items().getFirst().followedByMe()).isTrue();
        assertThat(response.items().get(1).followedByMe()).isFalse();
    }

    @Test
    void search_自分も結果に含めisMeをtrueにする() {
        when(userRepository.search(anyString(), anyString(), anyBoolean(), anyInt(), anyInt()))
                .thenReturn(List.of(user(ME, "hanako")));

        UserSearchResponse response = userSearchService.search(ME, "hana", 0);

        assertThat(response.items().getFirst().isMe()).isTrue();
        assertThat(response.hasNext()).isFalse();
    }

    @Test
    void search_キーワードが不正なら検索しない_ページがマイナスなら400() {
        assertThatThrownBy(() -> userSearchService.search(ME, "  ", 0)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> userSearchService.search(ME, "taro", -1))
                .isInstanceOfSatisfying(ApiException.class,
                        e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
        verify(userRepository, never()).search(anyString(), anyString(), anyBoolean(), anyInt(), anyInt());
    }

    @Test
    void newUsers_自分を除いた新しい順の20人を返す() {
        when(userRepository.findTop20ByIdNotOrderByCreatedAtDesc(ME)).thenReturn(List.of(user(9L, "new1"), user(8L, "new2")));

        UserListResponse response = userSearchService.newUsers(ME);

        assertThat(response.items()).extracting("username").containsExactly("new1", "new2");
    }
}
