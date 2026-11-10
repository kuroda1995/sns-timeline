# ログと予算アラート(インフラ構成図 9章)

# Spring Boot のログ(JSON)の保存先。初期設定の「無期限」だと料金が増え続けるため30日にする
resource "aws_cloudwatch_log_group" "app" {
  name              = local.log_group
  retention_in_days = 30
}

# 使った金額が予算の 50%・80%・100% を超えたらメールで通知する。
# terraform.tfvars に budget_alert_email を書いたときだけ作る
resource "aws_budgets_budget" "monthly" {
  count = var.budget_alert_email == "" ? 0 : 1

  name         = "${var.project}-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.budget_limit_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  dynamic "notification" {
    for_each = [50, 80, 100]

    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value
      threshold_type             = "PERCENTAGE"
      notification_type          = "ACTUAL"
      subscriber_email_addresses = [var.budget_alert_email]
    }
  }
}
