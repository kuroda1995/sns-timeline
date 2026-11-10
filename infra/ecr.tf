# ECR: バックエンドのコンテナイメージの置き場(scripts/deploy.sh が push し、ECS が取得する)

resource "aws_ecr_repository" "backend" {
  name                 = "${var.project}-backend"
  image_tag_mutability = "MUTABLE"
  # terraform destroy のときに、イメージが残っていてもリポジトリごと削除する
  force_delete = true

  image_scanning_configuration {
    scan_on_push = true
  }
}

# 古いイメージを自動で消す(ECR は保存容量で課金されるため、最新の5つだけ残す)
resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 5 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 5
      }
      action = { type = "expire" }
    }]
  })
}
