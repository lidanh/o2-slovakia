output "domain_identity_arn" {
  value = aws_ses_domain_identity.main.arn
}

output "smtp_host" {
  value = "email-smtp.${data.aws_region.current.name}.amazonaws.com"
}

output "smtp_username" {
  value     = aws_iam_access_key.smtp.id
  sensitive = true
}

output "smtp_password" {
  value     = aws_iam_access_key.smtp.ses_smtp_password_v4
  sensitive = true
}
