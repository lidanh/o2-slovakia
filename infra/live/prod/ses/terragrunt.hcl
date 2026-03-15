include "root" {
  path = find_in_parent_folders()
}

terraform {
  source = "../../../modules/ses"
}

inputs = {
  domain    = "mail.wonderful-global.ai"
  zone_name = "wonderful-global.ai"
}
