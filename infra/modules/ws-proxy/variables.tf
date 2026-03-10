variable "project" {
  type    = string
  default = "o2-slovakia"
}

variable "domain" {
  type = string
}

variable "ecr_repository_url" {
  type = string
}

variable "ssm_parameter_arns" {
  type = map(string)
}
