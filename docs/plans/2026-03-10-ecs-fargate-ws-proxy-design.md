# ECS Fargate WS Proxy Migration

Migrate the WebSocket proxy from AWS App Runner to ECS Fargate + ALB. App Runner does not support WebSocket connections (Envoy proxy returns 403 on upgrade requests).

## Architecture

```
Client (wss://ws.o2.wonderful-global.ai/ws)
  → Route53 CNAME → ALB (HTTPS:443, ACM cert)
    → ECS Fargate (1-4 tasks, port 8080)
      → Upstream Wonderful WS API
```

## Resources

### Networking
- Default VPC + subnets (data sources)
- Security group: ALB — ingress 443 from 0.0.0.0/0
- Security group: ECS — ingress 8080 from ALB SG only

### Load Balancer
- Internet-facing ALB in default VPC subnets
- Target group: IP type, health check GET /health:8080
- Listener: HTTPS:443 with ACM cert, forward to target group

### TLS / DNS
- ACM certificate for ws.o2.wonderful-global.ai
- Route53 record for DNS validation
- aws_acm_certificate_validation to wait for cert
- Route53 CNAME: ws.o2.wonderful-global.ai → ALB DNS

### ECS
- ECS cluster: o2-slovakia-ws-proxy
- Task definition: Fargate, 256 CPU / 512 MiB, ECR image, SSM secrets, CloudWatch logs
- ECS service: desired count 1, ALB target group attachment
- Auto-scaling: 1-4 tasks on CPU 70%

### IAM
- Execution role: ECR pull + SSM GetParameter + CloudWatch Logs
- Task role: minimal (no extra permissions needed)

### Logging
- CloudWatch log group: /ecs/o2-slovakia-ws-proxy

## Secrets (reuse existing SSM)
- BROWSER_CALL_JWT_SECRET
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- ALLOWED_ORIGIN

## CI Change
- Add `aws ecs update-service --force-new-deployment` after ECR push

## Outputs
- alb_dns_name
- custom_domain (ws.o2.wonderful-global.ai)
