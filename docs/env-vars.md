# Environment variables

Configuration is read exclusively from environment variables. Defaults below are the application defaults. The deployed values are set per environment in the product's gitops-app repo (`services.yaml` → `env`, `replicas`, `resources`).

## Core

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port the server listens on. |
| `NODE_ENV` | `production` (in the image) | Node environment. |

## Observability

| Variable | Default | Description |
|---|---|---|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | _(unset — tracing disabled)_ | OTLP endpoint; when set, `instrumentation.ts` enables OpenTelemetry tracing. |
| `OTEL_SERVICE_NAME` | `todo-web` | Service name reported in traces. |

## Upstream services

| Variable | Default | Description |
|---|---|---|
| `TODO_API_URL` | _(unset — every todo-api call is reported as unavailable)_ | Base URL of todo-api, read at call time on the server only (never `NEXT_PUBLIC_`). Deployed value `http://todo-api`, set in the gitops repo. Requests time out after 5 s. |

## Public (browser-exposed)

Variables prefixed `NEXT_PUBLIC_` are inlined into the client bundle at build time. Never put secrets in them.
