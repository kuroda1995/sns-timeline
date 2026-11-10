// CloudFront Function(viewer-request)。S3 向けのリクエストにだけ付ける(cloudfront.tf)
// ビルド結果のファイル(/assets/*・/favicon.svg・/index.html)はそのまま返し、
// それ以外(/users/hanako・/posts/1 などの画面のURL)は index.html に書き換えて、React Router に画面を選ばせる。
// ユーザー名に「.」が入っても誤ってファイルとみなさないよう、拡張子ではなくパスで判定する
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  if (uri.startsWith('/assets/') || uri === '/favicon.svg' || uri === '/index.html') {
    return request;
  }
  request.uri = '/index.html';
  return request;
}
