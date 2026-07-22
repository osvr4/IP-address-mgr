# Test Credentials — ThinkCloud IPAM

## Super Admin (seeded on startup)
- Email: `admin@thinkcloud.in`
- Password: `ChangeMe@123`
- Role: `super_admin`

## How to create test users
Register through the UI at `/register` OR call `POST /api/auth/register` with any email/password.

## Auth Endpoints
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- GET  /api/auth/me
- POST /api/auth/refresh

## Notes
- All API routes are prefixed with `/api`.
- Auth uses HTTP-only cookies + Bearer header fallback.
- Preview environment: `IPAM_SIMULATED=true` — ping/DNS return deterministic simulated data.
