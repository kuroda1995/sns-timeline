package com.example.snstimeline.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.snstimeline.entity.User;
import com.example.snstimeline.support.RepositoryTest;
import com.example.snstimeline.support.TestData;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.stream.IntStream;
import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;

@RepositoryTest
class UserRepositoryTest {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TestEntityManager em;

    private TestData data;

    @BeforeEach
    void setUp() {
        data = new TestData(em);
    }

    private static List<String> usernames(List<User> users) {
        return users.stream().map(User::getUsername).toList();
    }

    /** UserSearchService と同じく、呼び出し側でエスケープして前後に % を付けたパターンで検索する */
    private List<User> search(String pattern, String keyword, boolean includeDisplayName) {
        return userRepository.search(pattern, keyword, includeDisplayName, 20, 0);
    }

    @Test
    void ユーザー名は大文字小文字を区別せずに一意() {
        // schema.sql の uq_users_username_lower(設計書 2-1)
        data.user("Taro");

        assertThatThrownBy(() -> em.persistAndFlush(new User("taro", "other@example.com", "hash", "太郎")))
                .isInstanceOf(ConstraintViolationException.class)
                .hasMessageContaining("uq_users_username_lower");
    }

    @Test
    void メールアドレスは大文字小文字を区別せずに一意() {
        em.persistAndFlush(new User("taro", "taro@example.com", "hash", "太郎"));

        assertThatThrownBy(() -> em.persistAndFlush(new User("jiro", "TARO@example.com", "hash", "次郎")))
                .isInstanceOf(ConstraintViolationException.class)
                .hasMessageContaining("uq_users_email_lower");
    }

    @Test
    void findByEmail_existsByEmail_保存したメールアドレスで探す() {
        data.user("hanako");

        assertThat(userRepository.findByEmail("hanako@example.com")).isPresent();
        assertThat(userRepository.existsByEmail("hanako@example.com")).isTrue();
        assertThat(userRepository.existsByEmail("nobody@example.com")).isFalse();
    }

    @Test
    void existsByUsernameIgnoreCase_findByUsernameIgnoreCase_大文字小文字を区別しない() {
        User taro = data.user("Taro");

        assertThat(userRepository.existsByUsernameIgnoreCase("TARO")).isTrue();
        assertThat(userRepository.existsByUsernameIgnoreCase("jiro")).isFalse();
        assertThat(userRepository.findByUsernameIgnoreCase("taro")).get().extracting(User::getId)
                .isEqualTo(taro.getId());
        assertThat(userRepository.findByUsernameIgnoreCase("jiro")).isEmpty();
    }

    @Test
    void search_ユーザー名の部分一致で大文字小文字を区別しない() {
        data.user("TaroYamada");
        data.user("jiro");
        data.user("mytaro");

        assertThat(usernames(search("%taro%", "taro", true))).containsExactlyInAnyOrder("TaroYamada", "mytaro");
    }

    @Test
    void search_完全一致の人を先頭に_それ以外は登録が新しい順() {
        data.user("taro1");
        data.user("taro");
        data.user("taro2");

        assertThat(usernames(search("%taro%", "taro", true))).containsExactly("taro", "taro2", "taro1");
    }

    @Test
    void search_includeDisplayNameがtrueのときだけ表示名も検索する() {
        data.user("yamada", "Taroの部屋");
        data.user("taro", "太郎");

        assertThat(usernames(search("%taro%", "taro", true))).containsExactly("taro", "yamada");
        // @ 付きのキーワード(ユーザー名だけを検索する、5-1)
        assertThat(usernames(search("%taro%", "taro", false))).containsExactly("taro");
    }

    @Test
    void search_エスケープしたアンダースコアは文字そのものとして扱う() {
        data.user("taro_x");
        data.user("taro1");

        // taro_ をエスケープしたパターン。エスケープしないと _ が任意の1文字になり taro1 もヒットする
        assertThat(usernames(search("%taro\\_%", "taro_", true))).containsExactly("taro_x");
        assertThat(usernames(search("%taro_%", "taro_", true))).containsExactlyInAnyOrder("taro_x", "taro1");
    }

    @Test
    void search_limitとoffsetでページングする() {
        IntStream.rangeClosed(1, 5).forEach(i -> data.user("user" + i));

        assertThat(usernames(userRepository.search("%user%", "user", true, 2, 0))).containsExactly("user5", "user4");
        assertThat(usernames(userRepository.search("%user%", "user", true, 2, 4))).containsExactly("user1");
    }

    @Test
    void findTop20ByIdNotOrderByCreatedAtDesc_自分を除いて登録が新しい順に20人() {
        User me = data.user("me");
        Instant base = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        data.setUserCreatedAt(me, base.plusSeconds(100));
        List<User> others = IntStream.rangeClosed(1, 21).mapToObj(i -> data.user("user" + i)).toList();
        // 登録順と created_at の順をわざと逆にする(user1 が一番新しい)
        for (int i = 0; i < others.size(); i++) {
            data.setUserCreatedAt(others.get(i), base.minusSeconds(i));
        }
        data.clear();

        List<User> users = userRepository.findTop20ByIdNotOrderByCreatedAtDesc(me.getId());

        assertThat(users).hasSize(20);
        assertThat(users.get(0).getUsername()).isEqualTo("user1");
        assertThat(users.get(19).getUsername()).isEqualTo("user20");
        assertThat(usernames(users)).doesNotContain("me", "user21");
    }
}
