variable "project" {
  type    = string
  default = "o2-slovakia"
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "parameter_names" {
  type = list(string)
  default = [
    "BROWSER_CALL_JWT_SECRET",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "ALLOWED_ORIGIN",
  ]
}
