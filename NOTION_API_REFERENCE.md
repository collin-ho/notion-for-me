# Notion API Reference (Current as of Oct 2025)

**Source:** https://developers.notion.com/reference/intro

## Key Information

### Base Configuration
- **Base URL:** `https://api.notion.com`
- **Protocol:** HTTPS required for all requests
- **Authentication:** Integration token (Bearer token)
- **API Style:** RESTful (GET, POST, PATCH, DELETE)
- **Encoding:** JSON request/response bodies

### JSON Conventions
- Top-level resources have `"object"` property (e.g., "database", "user", "page")
- Resources addressable by UUIDv4 `"id"` property (dashes can be omitted in requests)
- Property names use `snake_case` (NOT camelCase or kebab-case)
- Temporal values in ISO 8601 format:
  - Datetimes: `2020-08-12T02:12:33.231Z`
  - Dates: `2020-08-12`
- **IMPORTANT:** API does NOT support empty strings - use `null` instead of `""`

---

## Available Endpoints

### Authentication
- `POST` Create a token
- `POST` Introspect token
- `POST` Revoke token
- `POST` Refresh a token

### Blocks
- `PATCH` Append block children
- `GET` Retrieve a block
- `GET` Retrieve block children
- `PATCH` Update a block
- `DELETE` Delete a block

### Pages
- `POST` Create a page
- `GET` Retrieve a page
- `GET` Retrieve a page property item
- `PATCH` Update page (including trash a page)

### Databases (Current)
- `POST` Create a database
- `PATCH` Update a database
- `GET` Retrieve a database

### Data Sources (NEW)
- `POST` Create a data source
- `PATCH` Update a data source (update data source properties)
- `GET` Retrieve a data source
- `POST` Query a data source (with filter & sort)
- `GET` List data source templates

### Databases (DEPRECATED - but may still work)
- `POST` Create a database
- `POST` Query a database (with filter & sort)
- `GET` Retrieve a database
- `PATCH` Update a database (update database properties)
- `GET` List databases (deprecated)

### Comments
- `POST` Create comment
- `GET` Retrieve a comment
- `GET` List comments

### File Uploads
- `POST` Create a file upload
- `POST` Send a file upload
- `POST` Complete a file upload
- `GET` Retrieve a file upload
- `GET` List file uploads

### Search
- `POST` Search by title (with optimizations and limitations)

### Users
- `GET` List all users
- `GET` Retrieve a user
- `GET` Retrieve your token's bot user

---

## Pagination

### Supported Endpoints
Endpoints that support cursor-based pagination:

| Method | Endpoint |
|--------|----------|
| `GET` | List all users |
| `GET` | Retrieve block children |
| `GET` | Retrieve a comment |
| `GET` | Retrieve a page property item |
| `POST` | Query a database |
| `POST` | Search |

### Pagination Response Format
```json
{
  "object": "list",
  "type": "page" | "block" | "comment" | "database" | "page_or_database" | "property_item" | "user",
  "results": [...],
  "has_more": true,
  "next_cursor": "33e19cb9-751f-4993-b74d-234d67d0d534",
  "{type}": {}
}
```

### Pagination Parameters
- **GET requests:** Parameters in query string
- **POST requests:** Parameters in request body

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `page_size` | number | 100 | 100 | Number of items to include |
| `start_cursor` | string | undefined | - | Opaque cursor value from previous response |

### Pagination Flow
1. Send initial request
2. Check `has_more` in response
3. If `true`, extract `next_cursor`
4. Send follow-up request with `start_cursor` set to `next_cursor` value

---

## Important Notes for Our Implementation

### ⚠️ Major Updates to Be Aware Of

1. **Data Sources vs Databases:**
   - There's a NEW "Data Sources" API alongside traditional Databases
   - May represent new Notion features or a migration path
   - We need to check which one the workspace uses

2. **Deprecated Endpoints:**
   - "List databases" is deprecated
   - Some database query endpoints marked deprecated
   - Use Search API instead for discovery

3. **No Empty Strings:**
   - Must use `null` not `""` for unsetting values
   - Critical for property updates

4. **UUID Formatting:**
   - API accepts IDs with or without dashes
   - Can copy directly from URLs

### For Our Exploration Script

**Discovery Strategy:**
```
1. Use Search API (POST /v1/search) with filters:
   - filter: { property: "object", value: "database" }
   - filter: { property: "object", value: "page" }

2. For each database:
   - GET /v1/databases/{id} for schema
   - POST /v1/databases/{id}/query for entries (with pagination)
   
3. For pages with block content:
   - GET /v1/blocks/{id}/children (recursive, paginated)

4. Handle pagination on all queries:
   - Set page_size: 100 (max)
   - Loop while has_more === true
```

**Rate Limiting:**
- Default: ~3 requests/second average
- Use exponential backoff on 429 responses
- Add jitter to prevent thundering herd

**Property Types to Watch For:**
- `title` - page/database title
- `rich_text` - formatted text content
- `select` / `multi_select` - options (we'll need these for migration)
- `relation` - links between databases (critical for structure)
- `date` - temporal data
- `checkbox` - boolean flags
- `created_time` / `last_edited_time` - metadata
- `created_by` / `last_edited_by` - user references

---

## Integration Setup Checklist

1. Create integration at https://www.notion.so/my-integrations
2. Copy "Internal Integration Token"
3. In workspace, share pages/databases with integration:
   - Click "..." menu on page/database
   - "Add connections" → Select integration
4. Store token as `NOTION_TOKEN` in .env (never commit)
5. Integration permissions needed:
   - Read content
   - Update content (for future push phase)
   - Insert content (for creating in new workspace)

---

## SDK vs Direct API

**Official Notion JS SDK (@notionhq/client):**
- Handles pagination automatically (iterator pattern)
- Type-safe (TypeScript)
- Auto-retry on rate limits
- Recommended for production use

**Direct REST API:**
- More control
- Easier debugging
- Good for understanding flow

**Our Choice:** Use SDK - it handles edge cases and rate limiting.


