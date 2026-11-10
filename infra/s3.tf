# S3 バケット2つ。どちらも非公開(パブリックアクセスをすべてブロック)
#   - frontend: React のビルド結果。CloudFront だけが読める(OAC、cloudfront.tf)
#   - images:   投稿画像・アイコン画像。Spring Boot(タスクの IAM ロール)だけが読み書きでき、
#               ブラウザは Spring Boot が発行した署名付きURL(1時間だけ有効)で表示する

data "aws_caller_identity" "current" {}

locals {
  # バケット名は世界で一意にする必要があるため、アカウントIDを付ける
  frontend_bucket = "${var.project}-frontend-${data.aws_caller_identity.current.account_id}"
  images_bucket   = "${var.project}-images-${data.aws_caller_identity.current.account_id}"
}

# ===== フロント =====
resource "aws_s3_bucket" "frontend" {
  bucket = local.frontend_bucket
  # terraform destroy のときに、中身が残っていてもバケットごと削除する
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CloudFront(このディストリビューションだけ)にファイルの読み取りを許可する
resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowCloudFrontRead"
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.frontend.arn}/*"
      Condition = {
        StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.main.arn }
      }
    }]
  })

  depends_on = [aws_s3_bucket_public_access_block.frontend]
}

# ===== 画像 =====
resource "aws_s3_bucket" "images" {
  bucket        = local.images_bucket
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "images" {
  bucket = aws_s3_bucket.images.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
