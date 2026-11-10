# Terraform と AWS プロバイダーの宣言(インフラ構成図 6章)
terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "6.70.0"
    }
    # DBのパスワード・JWT署名キー・CloudFront と ALB の間の確認用ヘッダーの値を、ランダムに作る
    random = {
      source  = "hashicorp/random"
      version = "3.9.1"
    }
  }
}

provider "aws" {
  region = var.region

  # すべてのリソースに付けるタグ。コンソールや請求で、このアプリのリソースを見分けられるようにする
  default_tags {
    tags = {
      Project   = var.project
      ManagedBy = "terraform"
    }
  }
}
