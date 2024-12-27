# API Routes Documentation

## Authentication Routes

`/api/auth`

- `POST /login` - Login user
  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```

## User Routes

`/api/users`

- `POST /register` - Register new user
  ```json
  {
    "firstName": "John",
    "lastName": "Doe",
    "username": "johndoe",
    "email": "john@example.com",
    "password": "password123"
  }
  ```
- `GET /profile` - Get user profile (requires auth)
- `PATCH /profile` - Update user profile (requires auth)

## Artist Routes

`/api/artists`

- `GET /` - Get all artists
  - Returns list of artists with track counts
- `GET /:id` - Get specific artist
  - Returns artist details and their tracks
- `GET /:id/tracks` - Get all tracks for an artist

## Distributor Routes

`/api/distributor`

- `POST /upload` - Upload new track (requires distributor key)

  ```http
  Headers:
  X-Distributor-Key: your-distributor-key
  Content-Type: multipart/form-data

  Body:
  track: [MP3 File]
  distributorName: Distributor Name
  ```

  - Creates artist if not exists
  - Extracts metadata from MP3
  - Links track to artist

## Track Routes

`/api/tracks`

- `GET /` - Get all tracks
- `GET /:id` - Get specific track
- `GET /search` - Search tracks
  - Query params:
    - `q`: Search term
    - `genre`: Filter by genre
    - `artist`: Filter by artist

## Response Formats

### Artist Object

```json
{
  "id": "artist_id",
  "name": "Artist Name",
  "bio": "Artist biography",
  "genres": ["Genre1", "Genre2"],
  "socialLinks": {
    "spotify": "url",
    "instagram": "url",
    "twitter": "url",
    "website": "url"
  },
  "monthlyListeners": 0,
  "totalPlays": 0,
  "subscriberCount": 0,
  "featured": false,
  "trackCount": 0
}
```

### Track Object

```json
{
  "id": "track_id",
  "title": "Track Title",
  "artist": {
    "id": "artist_id",
    "name": "Artist Name"
  },
  "distributor": {
    "name": "Distributor Name",
    "uploadDate": "2024-03-20T00:00:00.000Z"
  },
  "album": "Album Name",
  "duration": 180,
  "genre": "Genre",
  "fileUrl": "/music/tracks/filename.mp3",
  "coverArt": "/music/covers/filename.jpg",
  "isExclusive": false,
  "allowDownload": true,
  "plays": 0
}
```

### Error Responses

```json
{
  "message": "Error message here"
}
```

## Authentication

Most routes require authentication via Bearer token:

```http
Headers:
Authorization: Bearer your-jwt-token
```

## Rate Limiting

- Standard users: 100 requests per minute
- Distributors: 1000 requests per minute

## File Upload Limits

- Maximum file size: 50MB
- Supported formats: MP3
- Cover art: JPG/PNG up to 2MB
