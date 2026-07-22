# ThinkCloud IPAM — PRD

## Problem
Replace ThinkCloud's manual Excel-based static IP tracking with a single source of truth for ~50 employees + IT admins, deployed on the internal network.

## Users
- **User** — request/claim/release static IPs, view own allocations.
- **Admin** — everything a User can do + address/user/network administration, imports, exports, audit.
- **Super Admin** — Admin + promote/demote Admins. Seeded: `admin@thinkcloud.in`.

## Networks
- Network A: 10.1.0.0/22 (exclude 10.1.3.0/24 DHCP)
- Network B: 192.168.100.0/24
- Network C: 172.16.0.0/22

## Status Model (6)
Free 🟢 · In Use 🔵 · DHCP ⚪ · Stale DNS 🟡 · Conflict 🔴 · Reserved ⚫

## Core Flows (implemented Feb 2026)
- JWT email/password auth + super-admin seed
- Network configuration + per-address status tracking
- Request-IP flow (pick network / any) with live ping+DNS verification + 10-min soft hold + finalize with device/purpose/MAC
- My IPs (list + release)
- Admin: all-addresses table, filters, CSV export, force-release, reserve, override, conflicts queue, long-held view, user management (promote/demote/deactivate), Excel import, audit log, subnet map
- Background sweep (APScheduler) every 15 minutes
- Simulated mode for preview (IPAM_SIMULATED=true)
- In-app notifications

## Architecture
- Backend: FastAPI + Motor + APScheduler + bcrypt + PyJWT
- Frontend: React 19 + shadcn/ui + Tailwind (IBM Plex Sans/Mono, Swiss/technical aesthetic)
- DB: MongoDB
- Deployment target: single self-hosted server on internal network

## Backlog (post-MVP)
- P1: SMTP email notifications (SendGrid/Resend hookup)
- ✅ P1: Docker deployment bundle with self-signed HTTPS — shipped at `/app/deploy/` (Feb 2026)
- P2: VLAN / physical-location fields per address
- P2: Scheduled nightly CSV backup export
- P2: Google OAuth alternative login
