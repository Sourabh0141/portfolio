terraform {
  # 1.11 is the first release where `use_lockfile` replaces DynamoDB locking for S3 backends.
  required_version = ">= 1.11.0"

  required_providers {
    cloudflare = {
      source = "cloudflare/cloudflare"
      # 5.9 introduced `cloudflare_worker`, which manages a Worker without owning its code.
      version = "~> 5.9"
    }
  }

  # Remote state in R2 through its S3-compatible API. The bucket is created by hand, once,
  # and is not managed here: Terraform cannot store state in a bucket it has yet to create.
  #
  # Nothing account-specific is committed. CI supplies the rest at init time:
  #
  #   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY   an R2 API token scoped to the state bucket
  #   terraform init \
  #     -backend-config="bucket=$TF_STATE_BUCKET" \
  #     -backend-config="endpoints={s3=\"https://$CLOUDFLARE_ACCOUNT_ID.r2.cloudflarestorage.com\"}"
  backend "s3" {
    key    = "munshi/production/terraform.tfstate"
    region = "auto"

    # A lock object beside the state file, so two applies cannot overlap.
    use_lockfile = true

    # R2 is not AWS: it has no STS, no instance metadata and no account ID to look up.
    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_s3_checksum            = true
    use_path_style              = true
  }
}

# Reads the API token from CLOUDFLARE_API_TOKEN, so it never appears in a plan or a variable.
provider "cloudflare" {}
