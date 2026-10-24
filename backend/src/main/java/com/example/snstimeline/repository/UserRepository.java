package com.example.snstimeline.repository;

import com.example.snstimeline.entity.User;
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
}
