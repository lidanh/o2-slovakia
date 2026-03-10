include "root" {
  path = find_in_parent_folders()
}

locals {
  env = read_terragrunt_config(find_in_parent_folders("env.hcl"))
}

terraform {
  source = "../../../modules/ws-proxy"
}

dependency "ecr" {
  config_path = "../ecr"
}

dependency "ssm" {
  config_path = "../ssm"
}

inputs = {
  ecr_repository_url = dependency.ecr.outputs.repository_url
  ssm_parameter_arns = dependency.ssm.outputs.parameter_arns
}
