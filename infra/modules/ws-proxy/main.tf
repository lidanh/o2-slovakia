data "aws_route53_zone" "main" {
  name = var.domain
}

# --- IAM ---

data "aws_iam_policy_document" "apprunner_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["build.apprunner.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "apprunner_ecr" {
  name               = "${var.project}-apprunner-ecr"
  assume_role_policy = data.aws_iam_policy_document.apprunner_assume.json
}

resource "aws_iam_role_policy_attachment" "apprunner_ecr" {
  role       = aws_iam_role.apprunner_ecr.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
}

data "aws_iam_policy_document" "instance_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["tasks.apprunner.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "instance" {
  name               = "${var.project}-ws-proxy-instance"
  assume_role_policy = data.aws_iam_policy_document.instance_assume.json
}

resource "aws_iam_role_policy" "ssm_read" {
  name = "ssm-read"
  role = aws_iam_role.instance.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ssm:GetParameters", "ssm:GetParameter"]
      Resource = values(var.ssm_parameter_arns)
    }]
  })
}

# --- App Runner ---

resource "aws_apprunner_auto_scaling_configuration_version" "ws_proxy" {
  auto_scaling_configuration_name = "${var.project}-ws-proxy"
  min_size                        = 1
  max_size                        = 4
  max_concurrency                 = 25
}

resource "aws_apprunner_service" "ws_proxy" {
  service_name = "${var.project}-ws-proxy"

  source_configuration {
    authentication_configuration {
      access_role_arn = aws_iam_role.apprunner_ecr.arn
    }

    image_repository {
      image_identifier      = "${var.ecr_repository_url}:latest"
      image_repository_type = "ECR"

      image_configuration {
        port = "8080"

        runtime_environment_secrets = {
          BROWSER_CALL_JWT_SECRET = var.ssm_parameter_arns["BROWSER_CALL_JWT_SECRET"]
          SUPABASE_URL            = var.ssm_parameter_arns["SUPABASE_URL"]
          SUPABASE_SERVICE_ROLE_KEY = var.ssm_parameter_arns["SUPABASE_SERVICE_ROLE_KEY"]
          ALLOWED_ORIGIN          = var.ssm_parameter_arns["ALLOWED_ORIGIN"]
        }
      }
    }

    auto_deployments_enabled = true
  }

  instance_configuration {
    cpu               = "256"
    memory            = "512"
    instance_role_arn = aws_iam_role.instance.arn
  }

  auto_scaling_configuration_arn = aws_apprunner_auto_scaling_configuration_version.ws_proxy.arn

  health_check_configuration {
    protocol            = "HTTP"
    path                = "/health"
    interval            = 10
    timeout             = 5
    healthy_threshold   = 1
    unhealthy_threshold = 5
  }
}

resource "aws_apprunner_custom_domain_association" "ws_proxy" {
  domain_name          = "ws.o2.${var.domain}"
  service_arn          = aws_apprunner_service.ws_proxy.arn
  enable_www_subdomain = false
}

resource "aws_route53_record" "ws_proxy" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "ws.o2.${var.domain}"
  type    = "CNAME"
  ttl     = 300
  records = [aws_apprunner_custom_domain_association.ws_proxy.dns_target]
}

resource "aws_route53_record" "ws_proxy_validation" {
  for_each = {
    for r in aws_apprunner_custom_domain_association.ws_proxy.certificate_validation_records :
    r.name => r
  }

  zone_id = data.aws_route53_zone.main.zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 300
  records = [each.value.value]
}
