# Ping IGA Slack App (Run on Slack)

This repository contains a Run on Slack application that brings PingOne Advanced Identity Cloud (AIC) Identity Governance (IGA) workflows into Slack. Users can search the catalog, submit access requests for themselves or teammates, and review request statuses directly from the Slack App Home.

## Features

- `/iga` slash command and global/message shortcuts launch a catalog search and access request modal.
- Requesters can choose whether the access is for themselves or another teammate, provide justification, and submit the request to Ping IGA.
- Submissions call the Ping IGA requests API and return a confirmation DM with the resulting Request ID.
- The Slack App Home shows the requester’s recent requests and refreshes statuses on open.
- Direct messages notify requesters (and recipients when applicable) when a request is submitted or when a status change is detected.
- A Slack datastore tracks recent requests so that app home rendering and status refreshes remain auditable.

## Project structure

```
.
├── deno.jsonc                # Deno configuration and Slack SDK import aliases
├── manifest.ts               # Run on Slack manifest definition
├── src/
│   ├── clients/
│   │   └── ping_iga.ts       # Minimal Ping IGA API client (search, request, status)
│   ├── datastores/
│   │   └── requests.ts       # Slack datastore schema for request tracking
│   ├── functions/
│   │   ├── open_request_modal.ts   # Modal orchestration and submission handler
│   │   └── render_app_home.ts      # App Home renderer and status refresher
│   ├── utils/
│   │   └── views.ts          # Block Kit view builders
│   └── workflows/
│       ├── catalog_request.ts     # Workflow invoked by slash command/shortcuts
│       └── render_app_home.ts     # Workflow invoked by `app_home_opened`
└── triggers/                 # (Optional) space for custom triggers when deploying
```

## Secrets

Store the following secrets in Slack’s Secrets Manager before deploying:

| Secret name | Description |
| ----------- | ----------- |
| `PING_IGA_BASE_URL` | Base URL for Ping IGA API calls (e.g., `https://your-tenant.pingone.com/iga/api`). |
| `PING_IGA_CLIENT_ID` | OAuth client ID used for the Ping IGA API integration. |
| `PING_IGA_CLIENT_SECRET` | OAuth client secret. |
| `PING_IGA_TOKEN_URL` | (Optional) Explicit token endpoint. Defaults to `<baseUrl>/as/token`. |
| `PING_IGA_SEARCH_PATH` | (Optional) Override for the catalog search resource path. Defaults to `/v1/catalog-items`. |
| `PING_IGA_REQUEST_PATH` | (Optional) Override for the create request endpoint. Defaults to `/v1/requests`. |
| `PING_IGA_REQUEST_STATUS_PATH` | (Optional) Override for the status endpoint template. Defaults to `/v1/requests/{id}`. |

If the required secrets are not present the app falls back to a demo mode with mocked catalog results and synthetic request IDs so that the Slack experience can still be exercised end-to-end.

## Local development

Slack’s Run on Slack runtime executes in Slack’s infrastructure. You can iterate locally by editing the TypeScript files and using the Slack CLI to run `slack deploy` when ready. Helpful commands:

```bash
# Authenticate once per machine
slack login

# Validate the manifest
slack manifest validate --manifest ./manifest.ts

# Deploy to your workspace
slack deploy

# After deployment, create triggers for the slash command and shortcuts if needed
# (replace with your generated trigger definition file)
slack trigger create --trigger-def ./triggers/<trigger>.json
```

During development you can set `PING_IGA_*` secrets in the Slack CLI via `slack secret`. The `PingIgaClient` automatically fetches and caches access tokens, and gracefully handles API errors.

## Testing the experience

1. Use `/iga` (optionally with a search term) to open the catalog request modal.
2. Search for an item, choose whether the access is for you or another teammate, optionally add a justification, and submit.
3. Confirm that the DM summarizing the submission contains the Ping IGA Request ID.
4. Open the App Home tab to review recently submitted requests. When the underlying Ping IGA status changes, reopening the App Home triggers a refresh and a notification.

## Analytics (future work)

This MVP lays the groundwork for capturing metrics (search volume, request counts, status times, etc.). These can be implemented by emitting Slack Analytics events or storing anonymized counters alongside the datastore entries.

## License

Copyright © Ping Identity.
