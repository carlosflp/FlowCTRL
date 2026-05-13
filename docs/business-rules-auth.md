# Access Control Rules

## Authentication

- all portfolio, asset and operation endpoints now require authentication
- unauthenticated requests receive `401`
- invalid or expired tokens receive `401`
- inactive users receive `403`

## Authorization

### Read access

Allowed roles:

- `admin`
- `manager`
- `analyst`
- `viewer`

### Write access

Allowed roles:

- `admin`
- `manager`
- `analyst`

### Delete access

Allowed roles:

- `admin`
- `manager`

## Admin bootstrap

The platform must always be able to recover a valid local admin in development and local Docker environments. For that reason, the bootstrap step:

- creates the admin if it does not exist
- normalizes the role to `admin`
- ensures the user is active
- ensures the user is a superuser
