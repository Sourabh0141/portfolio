# -----------------------------------------------------------------------------
# Munshi, the portfolio chatbot, on the Cloudflare free plan.
#
#   Worker    the API the portfolio page calls. It proxies questions to DeepInfra.
#   Turnstile the bot check a visitor passes once before chatting.
#
# Terraform owns the resources. Wrangler owns the Worker's code, bindings and secrets
# (`wrangler deploy` from CI), so the DeepInfra key is never written to this state.
# -----------------------------------------------------------------------------

resource "cloudflare_worker" "munshi" {
  account_id = var.cloudflare_account_id
  name       = var.worker_name

  # Served from <name>.<account subdomain>.workers.dev. Preview URLs stay off: every extra
  # hostname is another way to reach the model without going through the portfolio.
  subdomain = {
    enabled          = true
    previews_enabled = false
  }

  # Keep these equal to `observability` in worker/wrangler.jsonc. Wrangler sends its own copy
  # on every deploy, and a difference would flip the setting back and forth between the tools.
  observability = {
    enabled            = true
    head_sampling_rate = 1
    logs = {
      enabled            = true
      invocation_logs    = true
      head_sampling_rate = 1
    }
  }
}

resource "cloudflare_turnstile_widget" "munshi" {
  account_id = var.cloudflare_account_id
  name       = "Munshi (portfolio chatbot)"
  domains    = var.site_hostnames

  # Managed: Cloudflare decides whether a visitor sees a checkbox. The page asks for
  # "interaction-only" appearance, so most visitors see nothing at all.
  mode = "managed"
}
