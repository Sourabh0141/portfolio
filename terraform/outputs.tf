output "worker_name" {
  description = "Name Wrangler deploys to."
  value       = cloudflare_worker.munshi.name
}

output "worker_url" {
  description = "Public URL of the Worker on workers.dev. The site is built with this as its chat API."
  value       = cloudflare_worker.munshi.subdomain.url
}

output "turnstile_site_key" {
  description = "Public Turnstile key. Embedded in the page."
  value       = cloudflare_turnstile_widget.munshi.sitekey
}

# Cloudflare generates this secret, so it is unavoidably recorded in state. CI reads it from
# here and uploads it to the Worker; it is never copied into GitHub or typed by a person.
output "turnstile_secret_key" {
  description = "Turnstile secret the Worker uses to verify a challenge."
  value       = cloudflare_turnstile_widget.munshi.secret
  sensitive   = true
}
