locals {
  env = read_terragrunt_config(find_in_parent_folders("env.hcl"))
}

remote_state {
  backend = "s3"
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite"
  }
  config = {
    bucket         = "o2-slovakia-terraform-state"
    key            = "${path_relative_to_include()}/terraform.tfstate"
    region         = local.env.locals.region
    encrypt        = true
    dynamodb_table = "o2-slovakia-terraform-locks"
    profile        = local.env.locals.profile
  }
}

generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite"
  contents  = <<-EOF
    provider "aws" {
      region  = "${local.env.locals.region}"
      profile = "${local.env.locals.profile}"

      default_tags {
        tags = {
          Project   = "${local.env.locals.project}"
          ManagedBy = "terraform"
        }
      }
    }
  EOF
}
