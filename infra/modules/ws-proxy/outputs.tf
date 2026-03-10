output "alb_dns_name" {
  value = aws_lb.ws_proxy.dns_name
}

output "custom_domain" {
  value = "ws.o2.${var.domain}"
}
