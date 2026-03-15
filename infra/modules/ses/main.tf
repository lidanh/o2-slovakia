data "aws_region" "current" {}

data "aws_route53_zone" "main" {
  name = var.zone_name
}

# --- SES Domain Identity + Verification ---

resource "aws_ses_domain_identity" "main" {
  domain = var.domain
}

resource "aws_route53_record" "ses_verification" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "_amazonses.${var.domain}"
  type    = "TXT"
  ttl     = 600
  records = [aws_ses_domain_identity.main.verification_token]
}

resource "aws_ses_domain_identity_verification" "main" {
  domain     = aws_ses_domain_identity.main.id
  depends_on = [aws_route53_record.ses_verification]
}

# --- DKIM (3 CNAME records) ---

resource "aws_ses_domain_dkim" "main" {
  domain = aws_ses_domain_identity.main.domain
}

resource "aws_route53_record" "dkim" {
  count   = 3
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "${aws_ses_domain_dkim.main.dkim_tokens[count.index]}._domainkey.${var.domain}"
  type    = "CNAME"
  ttl     = 600
  records = ["${aws_ses_domain_dkim.main.dkim_tokens[count.index]}.dkim.amazonses.com"]
}

# --- SPF ---

resource "aws_route53_record" "spf" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = var.domain
  type    = "TXT"
  ttl     = 600
  records = ["v=spf1 include:amazonses.com ~all"]
}

# --- DMARC ---

resource "aws_route53_record" "dmarc" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "_dmarc.${var.domain}"
  type    = "TXT"
  ttl     = 600
  records = ["v=DMARC1; p=quarantine;"]
}

# --- Custom MAIL FROM (optional, improves SPF alignment) ---

resource "aws_ses_domain_mail_from" "main" {
  count            = var.enable_mail_from ? 1 : 0
  domain           = aws_ses_domain_identity.main.domain
  mail_from_domain = "${var.mail_from_subdomain}.${var.domain}"
}

resource "aws_route53_record" "mail_from_mx" {
  count   = var.enable_mail_from ? 1 : 0
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "${var.mail_from_subdomain}.${var.domain}"
  type    = "MX"
  ttl     = 600
  records = ["10 feedback-smtp.${data.aws_region.current.name}.amazonses.com"]
}

resource "aws_route53_record" "mail_from_spf" {
  count   = var.enable_mail_from ? 1 : 0
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "${var.mail_from_subdomain}.${var.domain}"
  type    = "TXT"
  ttl     = 600
  records = ["v=spf1 include:amazonses.com ~all"]
}

# --- IAM User for SMTP credentials ---

resource "aws_iam_user" "smtp" {
  name = "${var.project}-ses-smtp"
  path = "/system/"
}

resource "aws_iam_user_policy" "smtp" {
  name = "ses-send-email"
  user = aws_iam_user.smtp.name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "ses:SendRawEmail"
      Resource = "*"
      Condition = {
        StringLike = { "ses:FromAddress" = "*@${var.domain}" }
      }
    }]
  })
}

resource "aws_iam_access_key" "smtp" {
  user = aws_iam_user.smtp.name
}

# --- Store credentials in SSM ---

resource "aws_ssm_parameter" "smtp_host" {
  name  = "/${var.project}/${var.environment}/SES_SMTP_HOST"
  type  = "String"
  value = "email-smtp.${data.aws_region.current.name}.amazonaws.com"
}

resource "aws_ssm_parameter" "smtp_username" {
  name  = "/${var.project}/${var.environment}/SES_SMTP_USERNAME"
  type  = "SecureString"
  value = aws_iam_access_key.smtp.id
}

resource "aws_ssm_parameter" "smtp_password" {
  name  = "/${var.project}/${var.environment}/SES_SMTP_PASSWORD"
  type  = "SecureString"
  value = aws_iam_access_key.smtp.ses_smtp_password_v4
}
