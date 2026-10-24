import { useSearchParams } from 'react-router'
import { NewUsers } from '../components/NewUsers.jsx'
import { UserSearchForm } from '../components/UserSearchForm.jsx'
import { UserSearchResults } from '../components/UserSearchResults.jsx'
import { normalizeKeyword } from '../utils/searchUtils.js'

/**
 * SC-09 ユーザー検索(/search、検索後は /search?q=taro)。
 * 検索するとURLの q を変えるので、結果からプロフィールを開いてブラウザの「戻る」を押すと同じ結果に戻れる。
 * /search?q=taro を直接開いた場合も検索する。q が無ければ「新しく参加したユーザー」を表示する。
 */
export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const q = normalizeKeyword(searchParams.get('q') ?? '').query
  const hasQuery = normalizeKeyword(q).text !== ''

  const handleSearch = (query) => {
    window.scrollTo(0, 0)
    setSearchParams({ q: query })
  }

  return (
    <>
      <header className="page-header">
        <h1>ユーザー検索</h1>
      </header>
      {/*
        「戻る」で q が変わったときに、入力欄もそのキーワードに合わせ直す。
        兄弟要素の key は重ならないようにする(同じ key だと React が区別できず、古い要素が残ってしまう)
      */}
      <UserSearchForm key={`form:${q}`} initialQuery={q} onSearch={handleSearch} />
      {hasQuery ? <UserSearchResults key={`results:${q}`} q={q} /> : <NewUsers />}
    </>
  )
}
