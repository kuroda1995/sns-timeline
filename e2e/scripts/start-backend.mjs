// Playwright の webServer から呼び、テスト用のバックエンドを起動する(e2e/README.md)。
//   node scripts/start-backend.mjs <プロファイル>   例: local,e2e / e2e / local,perf
//
// gradlew bootRun ではなく、bootJar で jar を作ってから java -jar で起動する。
// bootRun はアプリを Gradle デーモンの子プロセスとして起動するため、テストが終わって Playwright が
// このプロセスを止めても、アプリ(ポート8080)だけが残ってしまうことがある。java -jar ならこのスクリプトの
// 子プロセスになり、Playwright がプロセスごと確実に止められる。
import { spawn, spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backend')
const profiles = process.argv[2] ?? 'local,e2e'
const isWindows = process.platform === 'win32'

// Windows の .bat は shell(cmd.exe)を通さないと起動できない。
// cmd.exe はフォルダ名の全角スペースなどで相対パスを見つけられないことがあるため、絶対パスを "" で囲んで渡す
// (shell を使うときは、引数を配列で渡さずに1つのコマンド文字列にする。Node の DEP0190)
const build = isWindows
  ? spawnSync(`"${path.join(backendDir, 'gradlew.bat')}" bootJar --quiet`, { cwd: backendDir, stdio: 'inherit', shell: true })
  : spawnSync('./gradlew', ['bootJar', '--quiet'], { cwd: backendDir, stdio: 'inherit' })
if (build.status !== 0) {
  console.error('バックエンドのビルド(gradlew bootJar)に失敗しました')
  process.exit(build.status ?? 1)
}

// build/libs/ には実行できない -plain.jar も作られるので除く
const libsDir = path.join(backendDir, 'build', 'libs')
const jar = readdirSync(libsDir).find((f) => f.endsWith('.jar') && !f.endsWith('-plain.jar'))
if (!jar) {
  console.error(`${libsDir} に実行できる jar がありません`)
  process.exit(1)
}

const java = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', 'java') : 'java'
console.log(`バックエンドを起動します(プロファイル: ${profiles})`)
const app = spawn(java, ['-jar', path.join(libsDir, jar), `--spring.profiles.active=${profiles}`], {
  // application.properties の app.storage.local-dir(相対パス)が backend/ からになるようにする
  cwd: backendDir,
  stdio: 'inherit',
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => app.kill(signal))
}
app.on('exit', (code) => process.exit(code ?? 1))
