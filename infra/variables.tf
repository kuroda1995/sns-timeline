# 入力値。環境ごとに変えたい値は terraform.tfvars(.gitignore 済み)で上書きする
# 秘密情報(DBのパスワード・JWT署名キー)は random_password で作るので、ここには持たない

variable "project" {
  description = "リソース名の先頭に付ける名前"
  type        = string
  default     = "sns-timeline"
}

variable "region" {
  description = "AWS のリージョン"
  type        = string
  default     = "ap-northeast-1"
}

variable "image_tag" {
  description = "ECS で動かすバックエンドのイメージのタグ(scripts/deploy.sh が git のコミットIDを渡す)"
  type        = string
  default     = "latest"
}

variable "task_cpu" {
  description = "Fargate タスクの CPU(1024 = 1 vCPU)。Spring Boot は 256 だと起動が遅いため 512 にする"
  type        = number
  default     = 512
}

variable "task_memory" {
  description = "Fargate タスクのメモリ(MiB)"
  type        = number
  default     = 1024
}

variable "budget_alert_email" {
  description = "予算アラートの通知先メールアドレス。空なら予算アラートを作らない"
  type        = string
  default     = ""
}

variable "budget_limit_usd" {
  description = "1か月の予算(USD)。この金額の 50%・80%・100% を超えたらメールで通知する"
  type        = number
  default     = 20
}
