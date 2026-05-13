# Authentication and Authorization Stage

## What was added

This stage introduced the first real access-control layer for the platform:

- JWT access tokens
- password hashing
- role-based authorization
- environment-driven admin bootstrap
- frontend login and guarded routes

## Backend flow

1. The backend runs migrations.
2. The bootstrap step ensures that a default admin exists.
3. The user authenticates through `POST /api/v1/auth/login`.
4. The backend returns a bearer token and the authenticated user payload.
5. Protected endpoints validate the token and enforce roles.

## Role model

- `admin`
- `manager`
- `analyst`
- `viewer`

The current authorization matrix is intentionally simple:

- readers: all authenticated roles
- writers: `admin`, `manager`, `analyst`
- deleters: `admin`, `manager`

## Frontend flow

1. The login page submits credentials to the API.
2. The access token is stored locally for this initial stage.
3. The frontend loads `/auth/me` to restore the session.
4. Private routes render only after session initialization.

This is a pragmatic first step. A later stage can move the session model to refresh tokens and http-only cookies.
