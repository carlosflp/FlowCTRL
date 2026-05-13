# User Access Model Update

## User entity update

The `User` entity now includes:

- `role`

Supported values:

- `admin`
- `manager`
- `analyst`
- `viewer`

## Migration strategy

The change was introduced in a dedicated Alembic migration after the initial schema.

For existing rows:

- the new `role` column is created with a temporary default of `viewer`
- any existing `is_superuser = true` user is promoted to `admin`

## Bootstrap behavior

The platform creates or normalizes a default admin user during backend startup bootstrap, based on:

- `APP_ADMIN_EMAIL`
- `APP_ADMIN_PASSWORD`
- `APP_ADMIN_NAME`
