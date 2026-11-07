import { useLocation } from 'react-router'

/** 移動先の画面の代わりに、今のURLを表示する(リンク・画面遷移の確認用) */
export function LocationDisplay() {
  const location = useLocation()
  return <p data-testid="location">{location.pathname}</p>
}
