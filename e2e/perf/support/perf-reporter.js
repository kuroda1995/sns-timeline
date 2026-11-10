// ブラウザ性能テストの結果をまとめて出力する Playwright のレポーター。
//   perf/results/browser-perf.json … 全部の値(変更の前後を比べるとき用)
//   perf/results/browser-perf.md   … 表(GitHub Actions ではジョブのサマリーにも出す)
// 各テストが metrics.add() で記録した値(テスト結果の添付ファイル perf-metrics)を集める。
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fmt } from './format.js'

const resultsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../perf/results')

export default class PerfReporter {
  /** @type {Map<string, { conditions: string, enforceBudgets: boolean, results: any[] }>} */
  byProject = new Map()

  onBegin(config) {
    for (const project of config.projects) {
      this.byProject.set(project.name, {
        conditions: describeConditions(project.use),
        enforceBudgets: project.use.enforceBudgets ?? true,
        results: [],
      })
    }
  }

  onTestEnd(test, result) {
    const project = test.parent.project()?.name
    const entry = this.byProject.get(project)
    for (const attachment of result.attachments) {
      if (attachment.name !== 'perf-metrics' || !attachment.body) continue
      const { results } = JSON.parse(attachment.body.toString())
      entry.results.push(...results.map((r) => ({ ...r, test: test.title })))
    }
  }

  onEnd(result) {
    const projects = [...this.byProject.entries()].filter(([, p]) => p.results.length > 0)
    if (projects.length === 0) return

    const commit = process.env.GITHUB_SHA?.slice(0, 7) ?? ''
    const lines = ['## ブラウザ性能テストの結果', '']
    lines.push(
      `計測: 各${process.env.PERF_ITERATIONS ?? 5}回の中央値(最初の1回は除く)${commit ? ` / commit: ${commit}` : ''} / 結果: ${result.status}`,
      '',
    )
    for (const [name, project] of projects) {
      lines.push(`### ${name}(${project.conditions})`, '')
      lines.push(project.enforceBudgets ? '基準を外れるとテストが失敗する。' : '参考値(基準を外れてもテストは失敗しない)。', '')
      lines.push('| 計測項目 | 中央値 | 最小 | 最大 | 基準 | 判定 |', '|---|---|---|---|---|---|')
      for (const r of project.results) {
        const judged = r.budget === undefined ? '' : r.median <= r.budget ? '✅' : project.enforceBudgets ? '❌' : '⚠️'
        lines.push(
          `| ${r.label} | ${fmt(r.median, r.unit)} | ${fmt(r.min, r.unit)} | ${fmt(r.max, r.unit)} | ${r.budget === undefined ? '' : `≦ ${fmt(r.budget, r.unit)}`} | ${judged} |`,
        )
      }
      lines.push('')
    }
    const markdown = lines.join('\n')

    mkdirSync(resultsDir, { recursive: true })
    writeFileSync(path.join(resultsDir, 'browser-perf.md'), markdown)
    writeFileSync(
      path.join(resultsDir, 'browser-perf.json'),
      JSON.stringify(
        {
          date: new Date().toISOString(),
          commit: process.env.GITHUB_SHA ?? null,
          iterations: Number(process.env.PERF_ITERATIONS ?? 5),
          projects: Object.fromEntries(projects),
        },
        null,
        2,
      ),
    )
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`)
    console.log(`\n${markdown}\n結果: ${path.join(resultsDir, 'browser-perf.md')}`)
  }

  printsToStdio() {
    return false
  }
}

function describeConditions(use) {
  const size = use.viewport ? `${use.viewport.width}×${use.viewport.height}` : ''
  const t = use.throttle
  if (!t) return `画面 ${size}・回線とCPUの制限なし`
  return `画面 ${size}・遅延${t.latencyMs}ms・下り${(t.downloadKbps / 1024).toFixed(1)}Mbps・CPU 1/${t.cpuSlowdown}`
}
