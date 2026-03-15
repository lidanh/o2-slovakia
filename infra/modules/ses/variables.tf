variable "project" {
  type    = string
  default = "o2-slovakia"
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "domain" {
  description = "Domain to verify with SES (e.g. mail-o2.wonderful-global.ai)"
  type        = string
}

variable "zone_name" {
  description = "Route53 hosted zone name (e.g. wonderful-global.ai)"
  type        = string
}

variable "enable_mail_from" {
  description = "Configure a custom MAIL FROM domain for SPF alignment"
  type        = bool
  default     = true
}

variable "mail_from_subdomain" {
  description = "Subdomain prefix for MAIL FROM (prepended to var.domain)"
  type        = string
  default     = "bounce"
}
