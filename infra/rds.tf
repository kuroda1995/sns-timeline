# RDS for PostgreSQL 16(プライベートサブネット)。Fargate タスクからだけ接続できる

resource "random_password" "db" {
  length = 32
  # RDS のパスワードに使えない文字(/ @ " 空白)を除く
  override_special = "!#$%^&*()-_=+[]{}<>:?"
}

resource "aws_db_subnet_group" "main" {
  name       = "${var.project}-db-subnet"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_db_instance" "main" {
  identifier     = "${var.project}-db"
  engine         = "postgres"
  engine_version = "16"
  # 一番小さい ARM(Graviton)のインスタンス。t3.micro より少し安い
  instance_class = "db.t4g.micro"

  allocated_storage = 20
  storage_type      = "gp3"
  storage_encrypted = true

  db_name  = "sns_timeline"
  username = "sns_timeline"
  password = random_password.db.result

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false
  multi_az               = false

  # 動作確認が済んだら terraform destroy で消す運用のため、削除を妨げる設定は外す
  # (残したいデータがあるときは、destroy の前に手動でスナップショットを取る)
  skip_final_snapshot     = true
  deletion_protection     = false
  backup_retention_period = 0
  apply_immediately       = true
}
