---
title: API reference
description: Example endpoints, request parameters, and responses for your API.
---

# API reference

This page demonstrates a common API reference format. Replace the paths, fields, and examples with your own API.

## List projects

Returns projects available to the authenticated workspace.

```http
GET /v1/projects
Authorization: Bearer $NORTHSTAR_TOKEN
```

### Query parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `limit` | integer | Number of projects to return. Defaults to `20`. |
| `cursor` | string | Pagination cursor from the previous response. |

### Response

```json
{
  "data": [
    {
      "id": "prj_123",
      "name": "Website refresh",
      "status": "active"
    }
  ],
  "nextCursor": null
}
```

### Errors

| Status | Meaning | Next step |
| --- | --- | --- |
| `401` | The token is missing or invalid. | Check that the token is present and current. |
| `429` | The request limit was reached. | Retry after a short delay. |

::SCallout{type="note" title="Example API"}
This is placeholder content. Replace the endpoint, authentication scheme, and response fields with your service's actual API.
::
