resource "aws_ecr_repository" "ws_proxy" {
  name                 = "${var.project}/ws-proxy"
  image_tag_mutability = "MUTABLE"
  force_delete         = false

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "ws_proxy" {
  repository = aws_ecr_repository.ws_proxy.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 10 tagged images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = { type = "expire" }
    }]
  })
}
