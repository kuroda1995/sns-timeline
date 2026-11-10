# Spring Boot(API)のコンテナイメージ。ECS Fargate で動かす(インフラ構成図 3章)
# ビルド: docker build -t sns-timeline-backend backend/
#
# 1段目でアプリをビルドし、2段目には実行に必要な JRE と jar だけを入れる(イメージを小さくし、ビルド用の道具を本番に持ち込まない)

# ===== 1段目: ビルド =====
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
# 依存ライブラリのダウンロードを先に済ませ、ソースだけを変えたときは Docker のキャッシュを使えるようにする
COPY gradlew settings.gradle build.gradle ./
COPY gradle gradle
RUN chmod +x gradlew && ./gradlew dependencies --no-daemon -q > /dev/null
COPY config config
COPY src src
# テストと静的解析は CI(GitHub Actions)で実行済みなので、ここでは jar を作るだけにする
RUN ./gradlew bootJar --no-daemon -q

# ===== 2段目: 実行 =====
FROM eclipse-temurin:21-jre
WORKDIR /app
# root で動かさない(コンテナが乗っ取られたときの被害を小さくする)
RUN useradd --system --uid 10001 app
COPY --from=build /app/build/libs/*.jar app.jar
USER app
EXPOSE 8080
# コンテナに割り当てたメモリ(タスク定義の memory)の75%をヒープに使う
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
