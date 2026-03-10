output "service_url" {
  value = aws_apprunner_service.ws_proxy.service_url
}

output "service_arn" {
  value = aws_apprunner_service.ws_proxy.arn
}

output "custom_domain" {
  value = aws_apprunner_custom_domain_association.ws_proxy.domain_name
}
