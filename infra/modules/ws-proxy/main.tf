# --- Data sources ---

data "aws_region" "current" {}

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
  filter {
    name   = "default-for-az"
    values = ["true"]
  }
}

data "aws_route53_zone" "main" {
  name = var.domain
}

# --- ACM Certificate ---

resource "aws_acm_certificate" "ws_proxy" {
  domain_name       = "ws-o2.${var.domain}"
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.ws_proxy.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      type   = dvo.resource_record_type
      record = dvo.resource_record_value
    }
  }

  zone_id = data.aws_route53_zone.main.zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 300
  records = [each.value.record]
}

resource "aws_acm_certificate_validation" "ws_proxy" {
  certificate_arn         = aws_acm_certificate.ws_proxy.arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation : r.fqdn]
}

# --- Security Groups ---

resource "aws_security_group" "alb" {
  name        = "${var.project}-ws-proxy-alb"
  description = "ALB for ws-proxy"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "ecs" {
  name        = "${var.project}-ws-proxy-ecs"
  description = "ECS tasks for ws-proxy"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# --- ALB ---

resource "aws_lb" "ws_proxy" {
  name               = "${var.project}-ws-proxy"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = data.aws_subnets.default.ids
}

resource "aws_lb_target_group" "ws_proxy" {
  name        = "${var.project}-ws-proxy"
  port        = 8080
  protocol    = "HTTP"
  vpc_id      = data.aws_vpc.default.id
  target_type = "ip"

  health_check {
    path                = "/health"
    port                = "8080"
    protocol            = "HTTP"
    healthy_threshold   = 2
    unhealthy_threshold = 5
    timeout             = 5
    interval            = 10
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.ws_proxy.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.ws_proxy.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.ws_proxy.arn
  }
}

# --- Route53 ---

resource "aws_route53_record" "ws_proxy" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "ws-o2.${var.domain}"
  type    = "A"

  alias {
    name                   = aws_lb.ws_proxy.dns_name
    zone_id                = aws_lb.ws_proxy.zone_id
    evaluate_target_health = true
  }
}

# --- IAM ---

data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "execution" {
  name               = "${var.project}-ws-proxy-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy_attachment" "execution_ecr" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "execution_ssm" {
  name = "ssm-read"
  role = aws_iam_role.execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ssm:GetParameters", "ssm:GetParameter"]
      Resource = values(var.ssm_parameter_arns)
    }]
  })
}

resource "aws_iam_role" "task" {
  name               = "${var.project}-ws-proxy-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

# --- CloudWatch ---

resource "aws_cloudwatch_log_group" "ws_proxy" {
  name              = "/ecs/${var.project}-ws-proxy"
  retention_in_days = 30
}

# --- ECS ---

resource "aws_ecs_cluster" "ws_proxy" {
  name = "${var.project}-ws-proxy"
}

resource "aws_ecs_task_definition" "ws_proxy" {
  family                   = "${var.project}-ws-proxy"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([{
    name      = "ws-proxy"
    image     = "${var.ecr_repository_url}:latest"
    essential = true

    portMappings = [{
      containerPort = 8080
      protocol      = "tcp"
    }]

    secrets = [
      { name = "BROWSER_CALL_JWT_SECRET", valueFrom = var.ssm_parameter_arns["BROWSER_CALL_JWT_SECRET"] },
      { name = "SUPABASE_URL", valueFrom = var.ssm_parameter_arns["SUPABASE_URL"] },
      { name = "SUPABASE_SERVICE_ROLE_KEY", valueFrom = var.ssm_parameter_arns["SUPABASE_SERVICE_ROLE_KEY"] },
      { name = "ALLOWED_ORIGIN", valueFrom = var.ssm_parameter_arns["ALLOWED_ORIGIN"] },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.ws_proxy.name
        "awslogs-region"        = data.aws_region.current.name
        "awslogs-stream-prefix" = "ws-proxy"
      }
    }
  }])
}

resource "aws_ecs_service" "ws_proxy" {
  name            = "${var.project}-ws-proxy"
  cluster         = aws_ecs_cluster.ws_proxy.id
  task_definition = aws_ecs_task_definition.ws_proxy.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = data.aws_subnets.default.ids
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.ws_proxy.arn
    container_name   = "ws-proxy"
    container_port   = 8080
  }

  depends_on = [aws_lb_listener.https]
}

# --- Auto Scaling ---

resource "aws_appautoscaling_target" "ws_proxy" {
  max_capacity       = 4
  min_capacity       = 1
  resource_id        = "service/${aws_ecs_cluster.ws_proxy.name}/${aws_ecs_service.ws_proxy.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "ws_proxy_cpu" {
  name               = "${var.project}-ws-proxy-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ws_proxy.resource_id
  scalable_dimension = aws_appautoscaling_target.ws_proxy.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ws_proxy.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value = 70.0
  }
}
