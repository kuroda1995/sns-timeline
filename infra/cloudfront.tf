# CloudFront(インフラ構成図 2章)。ブラウザの入口を1つにし、パスで振り分ける
#   /api/* → ALB → ECS Fargate(Spring Boot)。キャッシュしない
#   それ以外 → S3(React のビルド結果)
#
# 画面と API が同じURL(同じオリジン)になるため、CORS が要らない。
# 既定のドメイン(xxxx.cloudfront.net)には証明書が付いているので、独自ドメインが無くても HTTPS で通信できる

data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

# Host 以外のヘッダー(Authorization を含む)・クエリ文字列・Cookie をすべて ALB に渡す
data "aws_cloudfront_origin_request_policy" "all_viewer_except_host" {
  name = "Managed-AllViewerExceptHostHeader"
}

# CloudFront だけが S3 のファイルを読めるようにする仕組み(Origin Access Control)
resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${var.project}-frontend"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# SPA のルーティング: /users/hanako のような画面のURLを開いたときに index.html を返す。
# 「403/404 を index.html に置き換える」エラーページの設定はディストリビューション全体に効き、
# API の 404(JSON)まで HTML に置き換わってしまうため、S3 向けの振り分けにだけこの関数を付ける
resource "aws_cloudfront_function" "spa_rewrite" {
  name    = "${var.project}-spa-rewrite"
  runtime = "cloudfront-js-2.0"
  comment = "Rewrite SPA routes to /index.html"
  publish = true
  code    = file("${path.module}/functions/spa-rewrite.js")
}

resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  comment             = var.project
  default_root_object = "index.html"
  # 日本を含む地域だけに配信する(全世界より少し安い)
  price_class     = "PriceClass_200"
  is_ipv6_enabled = true

  origin {
    origin_id                = "frontend"
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  origin {
    origin_id   = "api"
    domain_name = aws_lb.main.dns_name

    custom_origin_config {
      http_port  = 80
      https_port = 443
      # ALB には証明書を付けていない(独自ドメインが無いため)。ブラウザ〜CloudFront の間は HTTPS
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
      # 画像のアップロード(最大 20MB)を考えて、既定の30秒より長くする
      origin_read_timeout = 60
    }

    # ALB は、この値が正しいリクエストだけを Spring Boot に転送する(alb.tf)
    custom_header {
      name  = "X-Origin-Verify"
      value = random_password.origin_verify.result
    }
  }

  # 画面(S3)
  default_cache_behavior {
    target_origin_id       = "frontend"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = data.aws_cloudfront_cache_policy.caching_optimized.id
    compress               = true

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.spa_rewrite.arn
    }
  }

  # API(ALB → ECS Fargate)
  ordered_cache_behavior {
    path_pattern             = "/api/*"
    target_origin_id         = "api"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id
    compress                 = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}
