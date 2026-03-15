# ECS Fargate WS Proxy Migration

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace AWS App Runner with ECS Fargate + ALB so the WebSocket proxy can handle `wss://` upgrade requests (App Runner's Envoy blocks them with 403).

**Architecture:** ECS Fargate runs the same Docker container behind an ALB with an ACM certificate on `ws.o2.wonderful-global.ai`. Route53 CNAME points the custom domain to the ALB. Same ECR image + SSM secrets.

**Tech Stack:** Terraform, Terragrunt, AWS ECS Fargate, ALB, ACM, Route53

---

### Task 1: Rewrite ws-proxy Terraform module — main.tf

**Files:**
- Rewrite: `infra/modules/ws-proxy/main.tf` (replace entire contents)

**Step 1: Replace main.tf with ECS Fargate + ALB resources**

Write the complete new `infra/modules/ws-proxy/main.tf`:

```hcl
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
  domain_name       = "ws.o2.${var.domain}"
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
  name    = "ws.o2.${var.domain}"
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
```

**Step 2: Commit**

```bash
git add infra/modules/ws-proxy/main.tf
git commit -m "[infra] feat: replace App Runner with ECS Fargate + ALB for WS proxy"
```

---

### Task 2: Update variables.tf and outputs.tf

**Files:**
- Modify: `infra/modules/ws-proxy/variables.tf`
- Modify: `infra/modules/ws-proxy/outputs.tf`

**Step 1: Update variables.tf** — add back `domain` variable

```hcl
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
```

**Step 2: Update outputs.tf**

```hcl
output "alb_dns_name" {
  value = aws_lb.ws_proxy.dns_name
}

output "custom_domain" {
  value = "ws.o2.${var.domain}"
}
```

**Step 3: Commit**

```bash
git add infra/modules/ws-proxy/variables.tf infra/modules/ws-proxy/outputs.tf
git commit -m "[infra] feat: update ws-proxy variables and outputs for ECS"
```

---

### Task 3: Update terragrunt live config

**Files:**
- Modify: `infra/live/prod/ws-proxy/terragrunt.hcl`

**Step 1: Add domain back to inputs**

```hcl
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
  domain             = local.env.locals.domain
  ecr_repository_url = dependency.ecr.outputs.repository_url
  ssm_parameter_arns = dependency.ssm.outputs.parameter_arns
}
```

**Step 2: Commit**

```bash
git add infra/live/prod/ws-proxy/terragrunt.hcl
git commit -m "[infra] feat: add domain input to ws-proxy terragrunt config"
```

---

### Task 4: Update CI pipeline for ECS redeployment

**Files:**
- Modify: `.github/workflows/deploy-ws-proxy.yml`

**Step 1: Add ECS force-redeploy step after ECR push**

```yaml
name: Deploy WS Proxy

on:
  push:
    branches: [master]
    paths:
      - "apps/ws-proxy/**"

env:
  AWS_REGION: eu-central-1

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - id: ecr-login
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push Docker image
        env:
          REGISTRY: ${{ steps.ecr-login.outputs.registry }}
          REPOSITORY: o2-slovakia/ws-proxy
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $REGISTRY/$REPOSITORY:$IMAGE_TAG -t $REGISTRY/$REPOSITORY:latest apps/ws-proxy
          docker push $REGISTRY/$REPOSITORY:$IMAGE_TAG
          docker push $REGISTRY/$REPOSITORY:latest

      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster o2-slovakia-ws-proxy \
            --service o2-slovakia-ws-proxy \
            --force-new-deployment \
            --region $AWS_REGION
```

**Step 2: Commit**

```bash
git add .github/workflows/deploy-ws-proxy.yml
git commit -m "[infra] feat: add ECS force-redeploy step to CI pipeline"
```

---

### Task 5: Deploy — destroy App Runner, apply ECS

**Step 1: Run terragrunt plan to preview changes**

```bash
cd infra/live/prod/ws-proxy
terragrunt plan
```

Expected: Terraform will show destroy of App Runner resources and creation of ECS/ALB/ACM resources.

**Step 2: Apply the changes**

```bash
terragrunt apply
```

Expected: ACM certificate creation, DNS validation, ALB + ECS cluster + service created. This may take 5-10 minutes for cert validation.

**Step 3: Verify health check**

```bash
# Get the ALB DNS name from terraform output
terragrunt output alb_dns_name

# Test health endpoint via custom domain (after DNS propagates)
curl -s https://ws.o2.wonderful-global.ai/health
```

Expected: `OK`

**Step 4: Test WebSocket upgrade**

```bash
node -e "
const https = require('https');
const crypto = require('crypto');
const req = https.request({
  hostname: 'ws.o2.wonderful-global.ai',
  port: 443,
  path: '/ws?token=test&agent_id=test',
  method: 'GET',
  headers: {
    'Connection': 'Upgrade',
    'Upgrade': 'websocket',
    'Sec-WebSocket-Version': '13',
    'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'),
    'Origin': 'https://o2.wonderful-global.ai',
  }
}, (res) => {
  console.log('STATUS:', res.statusCode);
});
req.on('upgrade', () => console.log('UPGRADE SUCCESS'));
req.on('error', (e) => console.log('ERROR:', e.message));
req.end();
setTimeout(() => process.exit(0), 10000);
"
```

Expected: Status 401 (unauthorized — JWT is fake) instead of 403 (Envoy blocking). This confirms WebSocket upgrade is reaching the Go app.

**Step 5: Update Vercel env var**

Set `NEXT_PUBLIC_WS_PROXY_URL=wss://ws.o2.wonderful-global.ai/ws` in Vercel and redeploy.

**Step 6: Test end-to-end from browser**

Navigate to the call page and verify the WebSocket connection establishes successfully.
