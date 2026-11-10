# ALB(インフラ構成図 3章)。CloudFront の /api/* を Fargate タスクに振り分ける
#
# Fargate タスクは起動し直すたびに IP アドレスが変わるため、CloudFront から直接つなげない。ALB を入口にして、
# ALB がタスクの IP を自動で追いかける(ターゲットタイプ ip)。
#
# CloudFront を通らずに ALB に直接アクセスされないよう、2重に守る
#   1. セキュリティグループ: CloudFront の IP アドレスからだけ受け付ける(security.tf)
#   2. リスナールール: CloudFront が付ける秘密のヘッダー(X-Origin-Verify)が正しいときだけ転送する。
#      1 だけだと、他人が作った CloudFront からも通ってしまうため

resource "random_password" "origin_verify" {
  length  = 32
  special = false
}

resource "aws_lb" "main" {
  name               = "${var.project}-alb"
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id
  # 画像のアップロード(最大 20MB)に時間がかかっても切れないようにする
  idle_timeout = 60
}

resource "aws_lb_target_group" "api" {
  name        = "${var.project}-api"
  port        = 8080
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"
  # タスクを入れ替えるときに、古いタスクへの通信が終わるのを待つ時間(既定の300秒は長すぎる)
  deregistration_delay = 30

  health_check {
    path                = "/api/health"
    matcher             = "200"
    interval            = 30
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  # 秘密のヘッダーが無いリクエスト(CloudFront を通っていない)は 403 にする
  default_action {
    type = "fixed-response"

    fixed_response {
      content_type = "text/plain"
      message_body = "Forbidden"
      status_code  = "403"
    }
  }
}

resource "aws_lb_listener_rule" "from_cloudfront" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 1

  condition {
    http_header {
      http_header_name = "X-Origin-Verify"
      values           = [random_password.origin_verify.result]
    }
  }

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}
