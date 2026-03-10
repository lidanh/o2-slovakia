variable "project" {
  type    = string
  default = "o2-slovakia"
}

variable "ecr_repository_url" {
  type = string
}

variable "ssm_parameter_arns" {
  type = map(string)
}
