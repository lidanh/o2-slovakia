resource "aws_ssm_parameter" "secrets" {
  for_each = toset(var.parameter_names)

  name  = "/${var.project}/${var.environment}/${each.value}"
  type  = "SecureString"
  value = "PLACEHOLDER"

  lifecycle {
    ignore_changes = [value]
  }
}
