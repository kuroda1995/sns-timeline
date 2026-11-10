# ECS Fargate で Spring Boot を動かす(インフラ構成図 3章)
#
# IAM ロールは2つに分ける
#   - タスク実行ロール: ECS がタスクを起動するときに使う(ECR からイメージを取得・ログを送る・SSM の秘密情報を読む)
#   - タスクロール:     アプリ(Spring Boot)が使う(S3 の画像の読み書きだけ)

locals {
  log_group = "/${var.project}/app"
}

resource "aws_ecs_cluster" "main" {
  name = var.project
}

# ===== タスク実行ロール =====
data "aws_iam_policy_document" "ecs_tasks_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "task_execution" {
  name               = "${var.project}-task-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

# ECR からのイメージの取得と、CloudWatch Logs への送信(AWS が用意しているポリシー)
resource "aws_iam_role_policy_attachment" "task_execution" {
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# このアプリの秘密情報(SSM のパラメータ2つ)だけを読めるようにする
resource "aws_iam_role_policy" "task_execution_ssm" {
  name = "read-app-secrets"
  role = aws_iam_role.task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ssm:GetParameters"]
      Resource = [aws_ssm_parameter.db_password.arn, aws_ssm_parameter.jwt_secret.arn]
    }]
  })
}

# ===== タスクロール =====
resource "aws_iam_role" "task" {
  name               = "${var.project}-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

# 画像バケットの読み書き・削除だけを許可する(最小権限の原則)
resource "aws_iam_role_policy" "task_s3" {
  name = "images-bucket"
  role = aws_iam_role.task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"]
      Resource = "${aws_s3_bucket.images.arn}/*"
    }]
  })
}

# ===== タスク定義 =====
resource "aws_ecs_task_definition" "backend" {
  family                   = "${var.project}-backend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    # Windows・Intel Mac でビルドしたイメージをそのまま動かせるよう x86_64 にする
    cpu_architecture = "X86_64"
  }

  container_definitions = jsonencode([{
    name      = "backend"
    image     = "${aws_ecr_repository.backend.repository_url}:${var.image_tag}"
    essential = true

    portMappings = [{ containerPort = 8080, protocol = "tcp" }]

    environment = [
      { name = "SPRING_PROFILES_ACTIVE", value = "aws" },
      { name = "SPRING_DATASOURCE_URL", value = "jdbc:postgresql://${aws_db_instance.main.endpoint}/${aws_db_instance.main.db_name}" },
      { name = "SPRING_DATASOURCE_USERNAME", value = aws_db_instance.main.username },
      { name = "IMAGE_BUCKET", value = aws_s3_bucket.images.bucket },
      { name = "CORS_ALLOWED_ORIGINS", value = "https://${aws_cloudfront_distribution.main.domain_name}" },
    ]

    # SSM Parameter Store から読み取って環境変数にする(タスク定義には値が入らない)
    secrets = [
      { name = "SPRING_DATASOURCE_PASSWORD", valueFrom = aws_ssm_parameter.db_password.arn },
      { name = "JWT_SECRET", valueFrom = aws_ssm_parameter.jwt_secret.arn },
    ]

    # コンテナの標準出力(JSON のログ)を CloudWatch Logs に送る(設計書 8-5)
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.app.name
        awslogs-region        = var.region
        awslogs-stream-prefix = "backend"
      }
    }
  }])
}

# ===== サービス(タスクを1つ動かし続ける) =====
resource "aws_ecs_service" "backend" {
  name            = "backend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = aws_subnet.public[*].id
    security_groups = [aws_security_group.app.id]
    # ECR・CloudWatch Logs・SSM に接続するため(NAT Gateway を使わない代わり。network.tf 参照)
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "backend"
    container_port   = 8080
  }

  # Spring Boot の起動(DB への接続・テーブルの作成を含む)が終わる前に、ヘルスチェック失敗で止められないようにする
  health_check_grace_period_seconds = 180

  # 新しいタスクが起動しなければ、前のタスク定義に自動で戻す
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  depends_on = [aws_lb_listener_rule.from_cloudfront, aws_iam_role_policy_attachment.task_execution]
}
