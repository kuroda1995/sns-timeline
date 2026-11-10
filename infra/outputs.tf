# terraform apply の後に表示する値(scripts/deploy.sh もここから読み取る)

output "app_url" {
  description = "アプリのURL(ブラウザで開く)"
  value       = "https://${aws_cloudfront_distribution.main.domain_name}"
}

output "cloudfront_distribution_id" {
  description = "キャッシュを削除するときに使う(scripts/deploy.sh)"
  value       = aws_cloudfront_distribution.main.id
}

output "frontend_bucket" {
  description = "React のビルド結果をアップロードするバケット"
  value       = aws_s3_bucket.frontend.bucket
}

output "ecr_repository_url" {
  description = "バックエンドのイメージを push する先"
  value       = aws_ecr_repository.backend.repository_url
}

output "ecs_cluster" {
  value = aws_ecs_cluster.main.name
}

output "ecs_service" {
  value = aws_ecs_service.backend.name
}

output "log_group" {
  description = "Spring Boot のログ(CloudWatch Logs)"
  value       = aws_cloudwatch_log_group.app.name
}
