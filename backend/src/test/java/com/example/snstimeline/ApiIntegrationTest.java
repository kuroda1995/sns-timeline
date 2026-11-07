package com.example.snstimeline;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.snstimeline.support.TestcontainersConfiguration;
import com.jayway.jsonpath.JsonPath;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/**
 * API結合テスト(設計書 7)。アプリ全体を起動し、Controller → Service → Repository → PostgreSQL まで
 * 何もモックにせず、実際のHTTPリクエストと同じ流れでデータをやり取りできるかを確かめる。
 * DB は Testcontainers の使い捨ての PostgreSQL、画像の保存先は一時ディレクトリを使う。
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ApiIntegrationTest {

    /** 1x1 の PNG(ImageValidator は先頭のバイトで形式を判定する) */
    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0};

    private static final Path UPLOAD_DIR = createTempDir();

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("app.jwt.secret", () -> "integration-test-secret-key-at-least-32-bytes");
        registry.add("app.storage.local-dir", UPLOAD_DIR::toString);
    }

    private static Path createTempDir() {
        try {
            return Files.createTempDirectory("sns-timeline-test-uploads");
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    /** テスト同士でデータが混ざらないよう、毎回すべてのテーブルを空にする */
    @BeforeEach
    void cleanDatabase() {
        jdbcTemplate.execute("truncate table likes, comments, post_images, follows, posts, users restart identity cascade");
    }

    // ===== テスト用の操作 =====

    private static String body(ResultActions result) throws Exception {
        return result.andReturn().getResponse().getContentAsString();
    }

    /** 新規登録して、JWT(Authorization ヘッダーの値)を返す */
    private String signup(String username) throws Exception {
        String json = """
                {"username":"%s","displayName":"%sさん","email":"%s@example.com","password":"password123"}
                """.formatted(username, username, username);
        String response = body(mockMvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isCreated()));
        return "Bearer " + JsonPath.read(response, "$.token");
    }

    private long createPost(String token, String content) throws Exception {
        String response = body(mockMvc.perform(multipart("/api/posts").param("content", content)
                        .header("Authorization", token))
                .andExpect(status().isCreated()));
        return ((Number) JsonPath.read(response, "$.id")).longValue();
    }

    private ResultActions timeline(String token) throws Exception {
        return mockMvc.perform(get("/api/timeline").header("Authorization", token)).andExpect(status().isOk());
    }

    // ===== 認証 =====

    @Test
    void 新規登録_ログイン_ログイン中のユーザー情報の取得ができる() throws Exception {
        signup("hanako");

        String response = body(mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        // メールアドレスは前後の空白を除き、小文字にそろえて照合する
                        .content("{\"email\":\" HANAKO@example.com \",\"password\":\"password123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.username").value("hanako")));
        String token = "Bearer " + JsonPath.read(response, "$.token");

        mockMvc.perform(get("/api/auth/me").header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("hanako"))
                .andExpect(jsonPath("$.displayName").value("hanakoさん"));
    }

    @Test
    void パスワードが違えばログインできない() throws Exception {
        signup("hanako");

        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"hanako@example.com\",\"password\":\"wrong-password1\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 大文字小文字だけが違うユーザー名では登録できない() throws Exception {
        signup("Taro");

        mockMvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON).content("""
                        {"username":"taro","displayName":"太郎","email":"other@example.com","password":"password123"}
                        """))
                .andExpect(status().isConflict());
    }

    // ===== 投稿・タイムライン・フォロー =====

    @Test
    void フォローした人の投稿だけがタイムラインに表示され_解除すると表示されなくなる() throws Exception {
        String hanako = signup("hanako");
        String taro = signup("taro");
        String jiro = signup("jiro");
        long taroPost = createPost(taro, "太郎の投稿");
        createPost(jiro, "次郎の投稿");
        long ownPost = createPost(hanako, "花子の投稿");

        // フォロー前は自分の投稿だけ
        timeline(hanako).andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].id").value(ownPost))
                .andExpect(jsonPath("$.items[0].isMine").value(true));

        mockMvc.perform(post("/api/users/taro/follow").header("Authorization", hanako))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.followedByMe").value(true))
                .andExpect(jsonPath("$.followerCount").value(1));

        timeline(hanako).andExpect(jsonPath("$.items[*].id").value(contains(
                (int) ownPost, (int) taroPost)));

        mockMvc.perform(delete("/api/users/taro/follow").header("Authorization", hanako))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.followedByMe").value(false))
                .andExpect(jsonPath("$.followerCount").value(0));

        timeline(hanako).andExpect(jsonPath("$.items.length()").value(1));
    }

    @Test
    void フォロー中とフォロワーの一覧とプロフィールの人数が一致する() throws Exception {
        String hanako = signup("hanako");
        String taro = signup("taro");
        signup("jiro");
        mockMvc.perform(post("/api/users/taro/follow").header("Authorization", hanako)).andExpect(status().isOk());
        mockMvc.perform(post("/api/users/jiro/follow").header("Authorization", hanako)).andExpect(status().isOk());
        mockMvc.perform(post("/api/users/hanako/follow").header("Authorization", taro)).andExpect(status().isOk());

        mockMvc.perform(get("/api/users/hanako").header("Authorization", taro))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.followingCount").value(2))
                .andExpect(jsonPath("$.followerCount").value(1))
                .andExpect(jsonPath("$.followedByMe").value(true))
                .andExpect(jsonPath("$.isMe").value(false));
        mockMvc.perform(get("/api/users/hanako/following").header("Authorization", hanako))
                .andExpect(jsonPath("$.items[*].username").value(contains("jiro", "taro")));
        mockMvc.perform(get("/api/users/hanako/followers").header("Authorization", hanako))
                .andExpect(jsonPath("$.items[*].username").value(contains("taro")));
    }

    @Test
    void 自分の投稿は編集_削除でき_他人の投稿は403() throws Exception {
        String hanako = signup("hanako");
        String taro = signup("taro");
        long postId = createPost(hanako, "編集前");

        mockMvc.perform(put("/api/posts/" + postId).header("Authorization", taro)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"乗っ取り\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/posts/" + postId).header("Authorization", taro))
                .andExpect(status().isForbidden());

        mockMvc.perform(put("/api/posts/" + postId).header("Authorization", hanako)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"編集後\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").value("編集後"))
                .andExpect(jsonPath("$.edited").value(true));
        mockMvc.perform(get("/api/posts/" + postId).header("Authorization", taro))
                .andExpect(jsonPath("$.content").value("編集後"));

        mockMvc.perform(delete("/api/posts/" + postId).header("Authorization", hanako))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/posts/" + postId).header("Authorization", hanako))
                .andExpect(status().isNotFound());
        timeline(hanako).andExpect(jsonPath("$.items").isEmpty());
    }

    @Test
    void 本文が141文字の投稿は400で保存されない() throws Exception {
        String hanako = signup("hanako");

        mockMvc.perform(multipart("/api/posts").param("content", "あ".repeat(141)).header("Authorization", hanako))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("content"));
        timeline(hanako).andExpect(jsonPath("$.items").isEmpty());
    }

    @Test
    void 新着投稿の確認で_表示中より新しい投稿だけが返る() throws Exception {
        String hanako = signup("hanako");
        long seen = createPost(hanako, "表示済み");
        long newPost = createPost(hanako, "新着");

        mockMvc.perform(get("/api/timeline/new").param("since", String.valueOf(seen)).header("Authorization", hanako))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].id").value(newPost))
                .andExpect(jsonPath("$.hasMore").value(false));
    }

    // ===== いいね・コメント =====

    @Test
    void いいねは2回しても1件で_取り消すと0件になる() throws Exception {
        String hanako = signup("hanako");
        String taro = signup("taro");
        long postId = createPost(taro, "いいねされる投稿");

        for (int i = 0; i < 2; i++) {
            mockMvc.perform(post("/api/posts/" + postId + "/likes").header("Authorization", hanako))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.likeCount").value(1))
                    .andExpect(jsonPath("$.likedByMe").value(true));
        }
        mockMvc.perform(get("/api/posts/" + postId).header("Authorization", hanako))
                .andExpect(jsonPath("$.likeCount").value(1))
                .andExpect(jsonPath("$.likedByMe").value(true));
        // いいねしていない人から見ると likedByMe は false
        mockMvc.perform(get("/api/posts/" + postId).header("Authorization", taro))
                .andExpect(jsonPath("$.likedByMe").value(false));

        mockMvc.perform(delete("/api/posts/" + postId + "/likes").header("Authorization", hanako))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.likeCount").value(0))
                .andExpect(jsonPath("$.likedByMe").value(false));
    }

    @Test
    void コメントを投稿_一覧表示でき_削除は本人だけ() throws Exception {
        String hanako = signup("hanako");
        String taro = signup("taro");
        long postId = createPost(taro, "コメントされる投稿");

        String created = body(mockMvc.perform(post("/api/posts/" + postId + "/comments").header("Authorization", hanako)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\" よろしく \"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.comment.content").value("よろしく"))
                .andExpect(jsonPath("$.commentCount").value(1)));
        long commentId = ((Number) JsonPath.read(created, "$.comment.id")).longValue();

        mockMvc.perform(get("/api/posts/" + postId + "/comments").header("Authorization", taro))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].author.username").value("hanako"))
                .andExpect(jsonPath("$.items[0].isMine").value(false));
        timeline(taro).andExpect(jsonPath("$.items[0].commentCount").value(1));

        mockMvc.perform(delete("/api/comments/" + commentId).header("Authorization", taro))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/comments/" + commentId).header("Authorization", hanako))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/posts/" + postId + "/comments").header("Authorization", taro))
                .andExpect(jsonPath("$.items").isEmpty());
    }

    // ===== 画像・ユーザー検索 =====

    @Test
    void 画像付きで投稿すると_保存した画像をURLから取得できる() throws Exception {
        String hanako = signup("hanako");

        String response = body(mockMvc.perform(multipart("/api/posts")
                        .file(new MockMultipartFile("images", "a.png", "image/png", PNG))
                        .header("Authorization", hanako))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.content").value(""))
                .andExpect(jsonPath("$.images.length()").value(1))
                .andExpect(jsonPath("$.images[0].sortOrder").value(1)));
        String url = JsonPath.read(response, "$.images[0].url");
        String path = url.substring(url.indexOf("/uploads/"));

        try (var files = Files.walk(UPLOAD_DIR)) {
            assertThat(files.filter(Files::isRegularFile)).isNotEmpty();
        }
        // 画像は JWT 無しでも取得できる
        mockMvc.perform(get(path)).andExpect(status().isOk()).andExpect(content().bytes(PNG));
    }

    @Test
    void ユーザー検索で_部分一致した人を完全一致の人を先頭にして返す() throws Exception {
        String hanako = signup("hanako");
        signup("taro");
        signup("taro_y");
        signup("jiro");

        mockMvc.perform(get("/api/users/search").param("q", "taro").header("Authorization", hanako))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].username").value(contains("taro", "taro_y")));
    }

    @Test
    void JWTが無ければAPIは401() throws Exception {
        mockMvc.perform(get("/api/timeline")).andExpect(status().isUnauthorized());
        mockMvc.perform(multipart("/api/posts").param("content", "a")).andExpect(status().isUnauthorized());
    }
}
