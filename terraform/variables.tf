variable "cloudflare_account_id" {
  description = "Cloudflare account that owns the Worker and the Turnstile widget."
  type        = string

  validation {
    condition     = can(regex("^[0-9a-f]{32}$", var.cloudflare_account_id))
    error_message = "cloudflare_account_id must be the 32-character hex account ID."
  }
}

variable "worker_name" {
  description = "Name of the Worker. Must equal `name` in worker/wrangler.jsonc, which deploys the code."
  type        = string
  default     = "munshi"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{0,62}$", var.worker_name))
    error_message = "worker_name must be lowercase letters, digits and hyphens."
  }
}

variable "site_hostnames" {
  description = "Hostnames allowed to show the Turnstile widget. Must include the portfolio's hostname."
  type        = list(string)
  default     = ["sourabh.pages.dev"]

  validation {
    condition     = length(var.site_hostnames) > 0 && alltrue([for h in var.site_hostnames : can(regex("^[a-z0-9.-]+$", h))])
    error_message = "site_hostnames must be bare hostnames, without a scheme or path."
  }
}
