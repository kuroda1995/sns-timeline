package com.example.snstimeline.repository;

import com.example.snstimeline.entity.User;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, Long> {

    /** email は小文字で保存しているため、呼び出し側で小文字に変換した値を渡す */
    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    /** schema.sql の LOWER(username) インデックスと同じ条件で、大文字小文字を区別せずに重複を調べる */
    @Query("select count(u) > 0 from User u where lower(u.username) = lower(:username)")
    boolean existsByUsernameIgnoreCase(@Param("username") String username);

    /** プロフィールのURL(/users/Taro と /users/taro)は同じユーザーを指すため、大文字小文字を区別せずに探す */
    @Query("select u from User u where lower(u.username) = lower(:username)")
    Optional<User> findByUsernameIgnoreCase(@Param("username") String username);

    /**
     * U-01 ユーザー検索(設計書 3-3)。ユーザー名(と表示名)の部分一致で、大文字小文字を区別しない(ILIKE)。
     * ユーザー名がキーワードと完全一致する人を先頭に、それ以外は登録が新しい順。
     * pattern は呼び出し側で \ % _ をエスケープし、前後に % を付けたもの。
     * キーワードはSQLの文字列につなげず、必ずパラメータで渡す(SQLインジェクション対策)。
     */
    @Query(value = """
            select * from users u
            where u.username ilike :pattern escape '\\'
               or (:includeDisplayName and u.display_name ilike :pattern escape '\\')
            order by (lower(u.username) = lower(:keyword)) desc, u.id desc
            limit :limit offset :offset
            """, nativeQuery = true)
    List<User> search(@Param("pattern") String pattern, @Param("keyword") String keyword,
            @Param("includeDisplayName") boolean includeDisplayName,
            @Param("limit") int limit, @Param("offset") int offset);

    /** U-02 新しく参加したユーザー。登録が新しい順に20人(自分は除く) */
    List<User> findTop20ByIdNotOrderByCreatedAtDesc(Long me);
}
