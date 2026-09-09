# Widgets API — Integration Guide

Base URL: `https://api.widgets.example/v2`

## Authentication

Send an API key in the `Authorization: Bearer <key>` header. Keys are scoped to
a single project and can be rotated from the dashboard.

## Rate limits

- 600 requests per minute per key.
- Bursts up to 100 requests per second are allowed.
- A `429` response includes a `Retry-After` header in seconds.

## Pagination

List endpoints return 50 items per page. Use the `cursor` query parameter with
the `next_cursor` value from the previous response.

## Webhooks

Register a webhook URL to receive `widget.created`, `widget.updated`, and
`widget.deleted` events. Payloads are signed with HMAC-SHA256; verify the
`X-Signature` header against your signing secret.
