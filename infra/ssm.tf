# 秘密情報を SSM Parameter Store(SecureString、標準パラメータは無料)に置く。
# ECS がタスクの起動時に読み取り、環境変数としてコンテナに渡す(ecs.tf の secrets)。
# タスク定義やイメージには値そのものを入れない

resource "random_password" "jwt" {
  # HS256 の署名キーは32バイト以上
  length  = 64
  special = false
}

resource "aws_ssm_parameter" "db_password" {
  name  = "/${var.project}/db-password"
  type  = "SecureString"
  value = random_password.db.result
}

resource "aws_ssm_parameter" "jwt_secret" {
  name  = "/${var.project}/jwt-secret"
  type  = "SecureString"
  value = random_password.jwt.result
}
