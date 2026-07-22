"""ThinkCloud IPAM — FastAPI backend."""
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent / ".env")

import os
import io
import csv
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any

import bcrypt
import jwt
import ipaddress
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import openpyxl

from ipam_core import (
    DEFAULT_NETWORKS,
    enumerate_addresses,
    is_in_dhcp_range,
    verify_address,
    is_simulated,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s - %(message)s")
logger = logging.getLogger("ipam")

# ---------- DB ----------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# ---------- App ----------
app = FastAPI(title="ThinkCloud IPAM")
api = APIRouter(prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # using Bearer header, not cookies (works across preview domain)
    allow_methods=["*"],
    allow_headers=["*"],
)

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"
ACCESS_TTL_MIN = 240  # 4h session
HOLD_MINUTES = int(os.environ.get("IPAM_HOLD_MINUTES", "10"))
LONG_HELD_DAYS = int(os.environ.get("IPAM_LONG_HELD_DAYS", "90"))
SWEEP_MIN = int(os.environ.get("IPAM_SWEEP_INTERVAL_MIN", "15"))


# ---------- Utils ----------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def now_dt() -> datetime:
    return datetime.now(timezone.utc)


def hash_pw(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def verify_pw(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode(), h.encode())
    except Exception:
        return False


def make_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": now_dt() + timedelta(minutes=ACCESS_TTL_MIN),
        "iat": now_dt(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else request.cookies.get("access_token")
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    if not user or not user.get("active", True):
        raise HTTPException(401, "User not found or deactivated")
    user["id"] = str(user["_id"])
    del user["_id"]
    user.pop("password_hash", None)
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] not in ("admin", "super_admin"):
        raise HTTPException(403, "Admin required")
    return user


async def require_super_admin(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] != "super_admin":
        raise HTTPException(403, "Super-admin required")
    return user


# ---------- Models ----------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class NetworkIn(BaseModel):
    name: str
    cidr: str
    excluded_ranges: List[str] = []
    notes: str = ""


class RequestIpIn(BaseModel):
    network_id: Optional[str] = None  # None means "any"


class FinalizeIn(BaseModel):
    address: str
    device_name: str = Field(min_length=1)
    purpose: str = Field(min_length=1)
    device_type: Optional[str] = None
    mac_address: Optional[str] = None


class OverrideIn(BaseModel):
    status: str
    note: Optional[str] = None


# ---------- Audit ----------
async def audit(action: str, actor: dict, ip_address: Optional[str] = None, note: str = "", extra: Optional[dict] = None):
    doc = {
        "action": action,
        "actor_id": actor["id"],
        "actor_email": actor["email"],
        "ip_address": ip_address,
        "note": note,
        "extra": extra or {},
        "timestamp": now_iso(),
    }
    await db.audit_log.insert_one(doc)


async def notify(user_id: str, title: str, body: str, kind: str = "info"):
    await db.notifications.insert_one({
        "user_id": user_id,
        "title": title,
        "body": body,
        "kind": kind,
        "read": False,
        "created_at": now_iso(),
    })


# ---------- Auth Routes ----------
@api.post("/auth/register")
async def register(body: RegisterIn):
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(400, "Email already registered")
    doc = {
        "email": body.email.lower(),
        "name": body.name,
        "password_hash": hash_pw(body.password),
        "role": "user",
        "active": True,
        "created_at": now_iso(),
    }
    res = await db.users.insert_one(doc)
    uid = str(res.inserted_id)
    token = make_token(uid, doc["email"], doc["role"])
    return {"token": token, "user": {"id": uid, "email": doc["email"], "name": doc["name"], "role": doc["role"]}}


@api.post("/auth/login")
async def login(body: LoginIn):
    u = await db.users.find_one({"email": body.email.lower()})
    if not u or not verify_pw(body.password, u["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    if not u.get("active", True):
        raise HTTPException(403, "Account deactivated")
    uid = str(u["_id"])
    token = make_token(uid, u["email"], u["role"])
    return {"token": token, "user": {"id": uid, "email": u["email"], "name": u["name"], "role": u["role"]}}


@api.post("/auth/logout")
async def logout(user: dict = Depends(get_current_user)):
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# ---------- Networks Routes ----------
def _serialize_net(n: dict) -> dict:
    return {
        "id": str(n["_id"]),
        "name": n["name"],
        "cidr": n["cidr"],
        "excluded_ranges": n.get("excluded_ranges", []),
        "notes": n.get("notes", ""),
    }


@api.get("/networks")
async def list_networks(user: dict = Depends(get_current_user)):
    nets = await db.networks.find({}).to_list(100)
    result = []
    for n in nets:
        n_data = _serialize_net(n)
        counts = await _network_counts(n)
        n_data["counts"] = counts
        result.append(n_data)
    return result


async def _network_counts(net: dict) -> Dict[str, int]:
    net_id = str(net["_id"])
    # Total addresses in CIDR minus excluded
    all_addrs = enumerate_addresses(net["cidr"])
    dhcp_count = sum(1 for a in all_addrs if is_in_dhcp_range(a, net.get("excluded_ranges", [])))
    total_eligible = len(all_addrs) - dhcp_count
    # From ip_records
    in_use = await db.ip_records.count_documents({"network_id": net_id, "status": "in_use"})
    reserved = await db.ip_records.count_documents({"network_id": net_id, "status": "reserved"})
    conflict = await db.ip_records.count_documents({"network_id": net_id, "status": "conflict"})
    stale = await db.ip_records.count_documents({"network_id": net_id, "status": "stale_dns"})
    used_or_blocked = in_use + reserved + conflict
    free = max(0, total_eligible - used_or_blocked)
    return {
        "total_eligible": total_eligible,
        "dhcp": dhcp_count,
        "in_use": in_use,
        "reserved": reserved,
        "conflict": conflict,
        "stale_dns": stale,
        "free": free,
        "total": len(all_addrs),
    }


@api.post("/networks")
async def create_network(body: NetworkIn, user: dict = Depends(require_admin)):
    # Validate CIDR
    try:
        ipaddress.ip_network(body.cidr, strict=False)
    except ValueError:
        raise HTTPException(400, "Invalid CIDR")
    doc = body.model_dump()
    doc["created_at"] = now_iso()
    res = await db.networks.insert_one(doc)
    await audit("network.create", user, note=f"Created network {body.name} ({body.cidr})")
    n = await db.networks.find_one({"_id": res.inserted_id})
    return _serialize_net(n)


@api.put("/networks/{nid}")
async def update_network(nid: str, body: NetworkIn, user: dict = Depends(require_admin)):
    try:
        ipaddress.ip_network(body.cidr, strict=False)
    except ValueError:
        raise HTTPException(400, "Invalid CIDR")
    await db.networks.update_one({"_id": ObjectId(nid)}, {"$set": body.model_dump()})
    await audit("network.update", user, note=f"Updated network {body.name}")
    n = await db.networks.find_one({"_id": ObjectId(nid)})
    return _serialize_net(n)


# ---------- IP Records ----------
def _serialize_ip(r: dict) -> dict:
    return {
        "id": str(r["_id"]),
        "address": r["address"],
        "network_id": r["network_id"],
        "network_name": r.get("network_name", ""),
        "status": r["status"],
        "owner_user_id": r.get("owner_user_id"),
        "owner_email": r.get("owner_email"),
        "device_name": r.get("device_name"),
        "purpose": r.get("purpose"),
        "device_type": r.get("device_type"),
        "mac_address": r.get("mac_address"),
        "allocated_at": r.get("allocated_at"),
        "released_at": r.get("released_at"),
        "last_checked_at": r.get("last_checked_at"),
        "last_check_result": r.get("last_check_result"),
        "notes": r.get("notes"),
        "days_in_use": _days_in_use(r),
    }


def _days_in_use(r: dict) -> Optional[int]:
    if r.get("status") == "in_use" and r.get("allocated_at"):
        try:
            allocated = datetime.fromisoformat(r["allocated_at"].replace("Z", "+00:00"))
            return (now_dt() - allocated).days
        except Exception:
            return None
    return None


async def _get_or_create_record(address: str, network_id: str, network_name: str) -> dict:
    r = await db.ip_records.find_one({"address": address})
    if r:
        return r
    doc = {
        "address": address,
        "network_id": network_id,
        "network_name": network_name,
        "status": "free",
        "created_at": now_iso(),
    }
    res = await db.ip_records.insert_one(doc)
    doc["_id"] = res.inserted_id
    return doc


async def _release_expired_holds():
    """Remove holds older than HOLD_MINUTES."""
    threshold = (now_dt() - timedelta(minutes=HOLD_MINUTES)).isoformat()
    await db.holds.delete_many({"created_at": {"$lt": threshold}})


@api.get("/ips")
async def list_ips(
    network_id: Optional[str] = None,
    status: Optional[str] = None,
    owner_email: Optional[str] = None,
    q: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    query: Dict[str, Any] = {}
    if network_id:
        query["network_id"] = network_id
    if status:
        query["status"] = status
    if owner_email:
        query["owner_email"] = owner_email
    if q:
        query["$or"] = [
            {"address": {"$regex": q, "$options": "i"}},
            {"device_name": {"$regex": q, "$options": "i"}},
            {"purpose": {"$regex": q, "$options": "i"}},
            {"owner_email": {"$regex": q, "$options": "i"}},
        ]
    records = await db.ip_records.find(query).sort("address", 1).to_list(5000)
    return [_serialize_ip(r) for r in records]


@api.get("/ips/mine")
async def my_ips(user: dict = Depends(get_current_user)):
    records = await db.ip_records.find({"owner_user_id": user["id"], "status": "in_use"}).to_list(500)
    return [_serialize_ip(r) for r in records]


@api.get("/ips/subnet-map/{network_id}")
async def subnet_map(network_id: str, user: dict = Depends(get_current_user)):
    net = await db.networks.find_one({"_id": ObjectId(network_id)})
    if not net:
        raise HTTPException(404, "Network not found")
    addrs = enumerate_addresses(net["cidr"])
    excluded = net.get("excluded_ranges", [])
    # Load existing records
    recs = await db.ip_records.find({"network_id": network_id}).to_list(5000)
    rec_map = {r["address"]: r for r in recs}
    cells = []
    for a in addrs:
        if is_in_dhcp_range(a, excluded):
            cells.append({"address": a, "status": "dhcp"})
        elif a in rec_map:
            r = rec_map[a]
            cells.append({
                "address": a,
                "status": r["status"],
                "owner_email": r.get("owner_email"),
                "device_name": r.get("device_name"),
                "purpose": r.get("purpose"),
            })
        else:
            cells.append({"address": a, "status": "free"})
    return {"network": _serialize_net(net), "cells": cells}


# ---------- Request/Finalize/Release ----------
def _all_addresses_for_net(net: dict) -> List[str]:
    return [a for a in enumerate_addresses(net["cidr"]) if not is_in_dhcp_range(a, net.get("excluded_ranges", []))]


async def _pick_candidate(net: dict, exclude: set) -> Optional[dict]:
    """Find one candidate address in this network."""
    net_id = str(net["_id"])
    sim = is_simulated()

    # Load in-use / reserved / conflict / stale addresses
    taken = set()
    taken_recs = await db.ip_records.find(
        {"network_id": net_id, "status": {"$in": ["in_use", "reserved", "conflict"]}}
    ).to_list(5000)
    for r in taken_recs:
        taken.add(r["address"])
    # Held addresses
    held = await db.holds.find({}).to_list(500)
    for h in held:
        taken.add(h["address"])

    for addr in _all_addresses_for_net(net):
        if addr in taken or addr in exclude:
            continue
        # Verify
        v = verify_address(addr, simulated=sim)
        # Update last_checked
        existing = await db.ip_records.find_one({"address": addr})
        rec_update = {
            "last_checked_at": v["checked_at"],
            "last_check_result": v,
        }
        if v["ping"]:
            # Never offer. Raise a conflict if DB thought it was free.
            if existing is None or existing["status"] == "free":
                await db.ip_records.update_one(
                    {"address": addr},
                    {"$set": {
                        **rec_update,
                        "address": addr,
                        "network_id": net_id,
                        "network_name": net["name"],
                        "status": "conflict",
                    }},
                    upsert=True,
                )
                await db.verification_log.insert_one({
                    "address": addr, "network_id": net_id, "trigger": "on_demand",
                    "ping": v["ping"], "dns": v["dns"], "checked_at": v["checked_at"],
                })
            continue
        # Not pinging — offer it
        stale = v["dns"] is not None
        await db.ip_records.update_one(
            {"address": addr},
            {"$set": {
                **rec_update,
                "address": addr,
                "network_id": net_id,
                "network_name": net["name"],
                "status": "stale_dns" if stale else "free",
            }},
            upsert=True,
        )
        await db.verification_log.insert_one({
            "address": addr, "network_id": net_id, "trigger": "on_demand",
            "ping": v["ping"], "dns": v["dns"], "checked_at": v["checked_at"],
        })
        return {
            "address": addr,
            "network_id": net_id,
            "network_name": net["name"],
            "ping": v["ping"],
            "dns": v["dns"],
            "stale": stale,
            "mode": v["mode"],
        }
    return None


@api.post("/ips/request")
async def request_ip(body: RequestIpIn, request: Request, user: dict = Depends(get_current_user)):
    # Simple rate limit: max 20 requests per minute per user
    minute_ago = (now_dt() - timedelta(minutes=1)).isoformat()
    recent = await db.request_log.count_documents({"user_id": user["id"], "at": {"$gt": minute_ago}})
    if recent > 20:
        raise HTTPException(429, "Too many requests, slow down.")
    await db.request_log.insert_one({"user_id": user["id"], "at": now_iso()})

    await _release_expired_holds()

    # Pick network
    if body.network_id:
        net = await db.networks.find_one({"_id": ObjectId(body.network_id)})
        if not net:
            raise HTTPException(404, "Network not found")
        nets = [net]
    else:
        # Any network — sorted by most free capacity
        all_nets = await db.networks.find({}).to_list(100)
        nets_with_free = []
        for n in all_nets:
            c = await _network_counts(n)
            nets_with_free.append((c["free"], n))
        nets_with_free.sort(reverse=True, key=lambda x: x[0])
        nets = [n for _, n in nets_with_free]

    exclude: set = set()
    # Exclude addresses previously offered in this session
    # Query param would help but keep simple.
    for net in nets:
        cand = await _pick_candidate(net, exclude)
        if cand:
            # Soft hold
            await db.holds.insert_one({
                "address": cand["address"],
                "user_id": user["id"],
                "created_at": now_iso(),
                "expires_at": (now_dt() + timedelta(minutes=HOLD_MINUTES)).isoformat(),
            })
            cand["hold_expires_at"] = (now_dt() + timedelta(minutes=HOLD_MINUTES)).isoformat()
            return cand
    raise HTTPException(404, "No eligible free address in the selected network(s).")


@api.post("/ips/try-another")
async def try_another(body: RequestIpIn, exclude_address: str, user: dict = Depends(get_current_user)):
    # Remove hold on excluded address if user owns it
    await db.holds.delete_many({"address": exclude_address, "user_id": user["id"]})
    return await request_ip(body, Request({"type": "http", "headers": []}), user)  # simplified


@api.post("/ips/finalize")
async def finalize_ip(body: FinalizeIn, user: dict = Depends(get_current_user)):
    # Allow finalization even without hold if address is free
    existing = await db.ip_records.find_one({"address": body.address})
    if existing and existing["status"] in ("in_use", "reserved", "conflict"):
        # Check if it's the same user - allow re-finalization is not applicable
        raise HTTPException(400, f"Address is {existing['status']}, cannot allocate.")

    doc_set = {
        "status": "in_use",
        "owner_user_id": user["id"],
        "owner_email": user["email"],
        "device_name": body.device_name,
        "purpose": body.purpose,
        "device_type": body.device_type,
        "mac_address": body.mac_address,
        "allocated_at": now_iso(),
        "released_at": None,
    }
    await db.ip_records.update_one({"address": body.address}, {"$set": doc_set}, upsert=True)
    await db.holds.delete_many({"address": body.address})
    await audit("ip.allocate", user, ip_address=body.address, note=f"Device: {body.device_name} — {body.purpose}")
    await notify(user["id"], "IP allocated", f"{body.address} allocated to {body.device_name}", "success")
    r = await db.ip_records.find_one({"address": body.address})
    return _serialize_ip(r)


@api.post("/ips/{address}/release")
async def release_ip(address: str, user: dict = Depends(get_current_user)):
    r = await db.ip_records.find_one({"address": address})
    if not r:
        raise HTTPException(404, "Address not found")
    is_owner = r.get("owner_user_id") == user["id"]
    is_admin = user["role"] in ("admin", "super_admin")
    if not (is_owner or is_admin):
        raise HTTPException(403, "Not your address")
    await db.ip_records.update_one({"address": address}, {"$set": {
        "status": "free",
        "released_at": now_iso(),
        "owner_user_id": None,
        "owner_email": None,
        "device_name": None,
        "purpose": None,
        "device_type": None,
        "mac_address": None,
        "allocated_at": None,
    }})
    action = "ip.release" if is_owner else "ip.force_release"
    await audit(action, user, ip_address=address)
    return {"ok": True}


@api.post("/ips/{address}/override")
async def override_ip(address: str, body: OverrideIn, user: dict = Depends(require_admin)):
    if body.status not in ("free", "reserved", "conflict", "in_use", "stale_dns"):
        raise HTTPException(400, "Invalid status")
    r = await db.ip_records.find_one({"address": address})
    if not r:
        # Find matching network
        net = None
        for n in await db.networks.find({}).to_list(100):
            try:
                if ipaddress.ip_address(address) in ipaddress.ip_network(n["cidr"], strict=False):
                    net = n
                    break
            except ValueError:
                continue
        if not net:
            raise HTTPException(404, "Address not part of any managed network")
        await db.ip_records.insert_one({
            "address": address,
            "network_id": str(net["_id"]),
            "network_name": net["name"],
            "status": body.status,
            "notes": body.note or "",
            "created_at": now_iso(),
        })
    else:
        await db.ip_records.update_one({"address": address}, {"$set": {"status": body.status, "notes": body.note or ""}})
    await audit("ip.override", user, ip_address=address, note=f"Set status={body.status}: {body.note}")
    return {"ok": True}


# ---------- Conflicts / Long-held ----------
@api.get("/conflicts")
async def conflicts(user: dict = Depends(require_admin)):
    rows = await db.ip_records.find({"status": "conflict"}).sort("address", 1).to_list(2000)
    return [_serialize_ip(r) for r in rows]


@api.get("/long-held")
async def long_held(user: dict = Depends(require_admin)):
    threshold_iso = (now_dt() - timedelta(days=LONG_HELD_DAYS)).isoformat()
    rows = await db.ip_records.find({"status": "in_use", "allocated_at": {"$lt": threshold_iso}}).to_list(2000)
    return [_serialize_ip(r) for r in rows]


# ---------- Users ----------
@api.get("/users")
async def list_users(user: dict = Depends(require_admin)):
    users = await db.users.find({}).sort("created_at", -1).to_list(500)
    return [{
        "id": str(u["_id"]),
        "email": u["email"],
        "name": u["name"],
        "role": u["role"],
        "active": u.get("active", True),
        "created_at": u.get("created_at"),
    } for u in users]


@api.post("/users/{user_id}/role")
async def change_role(user_id: str, role: str, user: dict = Depends(require_super_admin)):
    if role not in ("user", "admin"):
        raise HTTPException(400, "role must be user or admin")
    target = await db.users.find_one({"_id": ObjectId(user_id)})
    if not target:
        raise HTTPException(404, "User not found")
    if target.get("role") == "super_admin":
        raise HTTPException(400, "Cannot change super_admin")
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"role": role}})
    await audit("user.role_change", user, note=f"{target['email']} -> {role}")
    return {"ok": True}


@api.post("/users/{user_id}/deactivate")
async def deactivate_user(user_id: str, user: dict = Depends(require_admin)):
    target = await db.users.find_one({"_id": ObjectId(user_id)})
    if not target:
        raise HTTPException(404, "User not found")
    if target.get("role") == "super_admin":
        raise HTTPException(400, "Cannot deactivate super_admin")
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"active": False}})
    # Get their in-use addresses
    owned = await db.ip_records.find({"owner_user_id": user_id, "status": "in_use"}).to_list(500)
    await audit("user.deactivate", user, note=f"{target['email']} — {len(owned)} addresses still allocated")
    return {"ok": True, "orphaned_addresses": [_serialize_ip(r) for r in owned]}


@api.post("/users/{user_id}/activate")
async def activate_user(user_id: str, user: dict = Depends(require_admin)):
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"active": True}})
    return {"ok": True}


# ---------- Audit / Dashboard ----------
@api.get("/audit")
async def get_audit(q: Optional[str] = None, user: dict = Depends(require_admin)):
    query: Dict[str, Any] = {}
    if q:
        query["$or"] = [
            {"action": {"$regex": q, "$options": "i"}},
            {"actor_email": {"$regex": q, "$options": "i"}},
            {"ip_address": {"$regex": q, "$options": "i"}},
            {"note": {"$regex": q, "$options": "i"}},
        ]
    rows = await db.audit_log.find(query).sort("timestamp", -1).limit(1000).to_list(1000)
    for r in rows:
        r["id"] = str(r["_id"])
        del r["_id"]
    return rows


@api.get("/dashboard")
async def dashboard(user: dict = Depends(get_current_user)):
    nets = await db.networks.find({}).to_list(100)
    per_net = []
    total_eligible = 0
    total_in_use = 0
    total_free = 0
    for n in nets:
        c = await _network_counts(n)
        per_net.append({"id": str(n["_id"]), "name": n["name"], "cidr": n["cidr"], **c})
        total_eligible += c["total_eligible"]
        total_in_use += c["in_use"]
        total_free += c["free"]
    conflicts_count = await db.ip_records.count_documents({"status": "conflict"})
    stale_count = await db.ip_records.count_documents({"status": "stale_dns"})
    threshold_iso = (now_dt() - timedelta(days=LONG_HELD_DAYS)).isoformat()
    long_held_count = await db.ip_records.count_documents({"status": "in_use", "allocated_at": {"$lt": threshold_iso}})
    return {
        "networks": per_net,
        "total_eligible": total_eligible,
        "total_in_use": total_in_use,
        "total_free": total_free,
        "utilization_pct": round(100 * total_in_use / total_eligible, 1) if total_eligible else 0,
        "conflicts": conflicts_count,
        "stale_dns": stale_count,
        "long_held": long_held_count,
        "simulated": is_simulated(),
    }


# ---------- Notifications ----------
@api.get("/notifications")
async def get_notifications(user: dict = Depends(get_current_user)):
    rows = await db.notifications.find({"user_id": user["id"]}).sort("created_at", -1).limit(50).to_list(50)
    for r in rows:
        r["id"] = str(r["_id"])
        del r["_id"]
    return rows


@api.post("/notifications/mark-read")
async def mark_read(user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["id"], "read": False}, {"$set": {"read": True}})
    return {"ok": True}


# ---------- Export ----------
@api.get("/export/csv")
async def export_csv(user: dict = Depends(require_admin)):
    rows = await db.ip_records.find({}).sort("address", 1).to_list(10000)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "address", "network", "status", "owner_email", "device_name", "purpose",
        "device_type", "mac_address", "allocated_at", "released_at", "last_checked_at", "days_in_use",
    ])
    for r in rows:
        writer.writerow([
            r.get("address"), r.get("network_name"), r.get("status"),
            r.get("owner_email"), r.get("device_name"), r.get("purpose"),
            r.get("device_type"), r.get("mac_address"),
            r.get("allocated_at"), r.get("released_at"),
            r.get("last_checked_at"), _days_in_use(r),
        ])
    output.seek(0)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=ipam_export.csv"})


# ---------- Excel Import ----------
@api.post("/import/excel")
async def import_excel(file: UploadFile = File(...), user: dict = Depends(require_admin)):
    content = await file.read()
    wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        raise HTTPException(400, "Empty spreadsheet")
    headers_row = [str(h).strip().lower() if h else "" for h in rows[0]]

    def find_col(*candidates):
        for c in candidates:
            if c in headers_row:
                return headers_row.index(c)
        return None

    idx_addr = find_col("address", "ip", "ip address", "ip_address")
    idx_owner = find_col("owner", "owner_email", "email", "user")
    idx_device = find_col("device", "device_name", "hostname")
    idx_purpose = find_col("purpose", "notes", "note")
    idx_mac = find_col("mac", "mac_address")
    idx_date = find_col("allocated_at", "date", "allocated")

    if idx_addr is None:
        raise HTTPException(400, "Column 'address' (or 'ip') is required.")

    nets = await db.networks.find({}).to_list(100)

    imported = 0
    skipped = 0
    for row in rows[1:]:
        addr = row[idx_addr] if idx_addr is not None and row[idx_addr] else None
        if not addr:
            continue
        addr = str(addr).strip()
        # Find matching network
        net_match = None
        try:
            ip = ipaddress.ip_address(addr)
            for n in nets:
                if ip in ipaddress.ip_network(n["cidr"], strict=False):
                    net_match = n
                    break
        except ValueError:
            skipped += 1
            continue
        if not net_match:
            skipped += 1
            continue
        if is_in_dhcp_range(addr, net_match.get("excluded_ranges", [])):
            skipped += 1
            continue
        allocated_at = None
        if idx_date is not None and row[idx_date]:
            d = row[idx_date]
            if isinstance(d, datetime):
                allocated_at = d.replace(tzinfo=timezone.utc).isoformat() if d.tzinfo is None else d.isoformat()
            else:
                allocated_at = str(d)
        doc = {
            "address": addr,
            "network_id": str(net_match["_id"]),
            "network_name": net_match["name"],
            "status": "in_use",
            "owner_email": str(row[idx_owner]).strip().lower() if idx_owner is not None and row[idx_owner] else None,
            "device_name": str(row[idx_device]).strip() if idx_device is not None and row[idx_device] else "imported",
            "purpose": str(row[idx_purpose]).strip() if idx_purpose is not None and row[idx_purpose] else "imported from spreadsheet",
            "mac_address": str(row[idx_mac]).strip() if idx_mac is not None and row[idx_mac] else None,
            "allocated_at": allocated_at or now_iso(),
        }
        await db.ip_records.update_one({"address": addr}, {"$set": doc}, upsert=True)
        imported += 1
    await audit("import.excel", user, note=f"Imported {imported} rows, skipped {skipped}")
    return {"imported": imported, "skipped": skipped}


# ---------- Startup ----------
async def seed_admin():
    email = os.environ["ADMIN_EMAIL"].lower()
    pw = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": email})
    if not existing:
        await db.users.insert_one({
            "email": email,
            "name": "Super Admin",
            "password_hash": hash_pw(pw),
            "role": "super_admin",
            "active": True,
            "created_at": now_iso(),
        })
        logger.info(f"Seeded super_admin {email}")
    else:
        # Ensure role stays super_admin and password matches env
        updates = {}
        if existing.get("role") != "super_admin":
            updates["role"] = "super_admin"
        if not verify_pw(pw, existing["password_hash"]):
            updates["password_hash"] = hash_pw(pw)
        if updates:
            await db.users.update_one({"_id": existing["_id"]}, {"$set": updates})


async def seed_networks():
    if await db.networks.count_documents({}) > 0:
        return
    for n in DEFAULT_NETWORKS:
        await db.networks.insert_one({**n, "created_at": now_iso()})
    logger.info("Seeded default networks A/B/C")


async def create_indexes():
    await db.users.create_index("email", unique=True)
    await db.ip_records.create_index("address", unique=True)
    await db.ip_records.create_index([("network_id", 1), ("status", 1)])
    await db.audit_log.create_index([("timestamp", -1)])
    await db.holds.create_index("expires_at")


scheduler = AsyncIOScheduler()


async def background_sweep():
    """Sweep all networks, verify statuses, flag conflicts."""
    logger.info("[sweep] starting…")
    sim = is_simulated()
    nets = await db.networks.find({}).to_list(100)
    updated = 0
    for net in nets:
        for addr in _all_addresses_for_net(net):
            existing = await db.ip_records.find_one({"address": addr})
            v = verify_address(addr, simulated=sim)
            new_status = None
            if existing and existing["status"] in ("in_use", "reserved"):
                # keep, but note last check
                await db.ip_records.update_one({"address": addr}, {"$set": {
                    "last_checked_at": v["checked_at"], "last_check_result": v,
                }})
                if existing["status"] == "in_use" and not v["ping"]:
                    # Just log; some machines are off. No status change.
                    pass
                continue
            # Free-side addresses
            if v["ping"]:
                new_status = "conflict"
            elif v["dns"]:
                new_status = "stale_dns"
            else:
                new_status = "free"
            doc_set = {
                "address": addr,
                "network_id": str(net["_id"]),
                "network_name": net["name"],
                "status": new_status,
                "last_checked_at": v["checked_at"],
                "last_check_result": v,
            }
            await db.ip_records.update_one({"address": addr}, {"$set": doc_set}, upsert=True)
            updated += 1
            # Throttle a bit to avoid overwhelming
            if updated % 100 == 0:
                await asyncio.sleep(0.05)
    logger.info(f"[sweep] done — {updated} addresses evaluated")


@app.on_event("startup")
async def startup():
    await create_indexes()
    await seed_admin()
    await seed_networks()
    # Kick off scheduler
    scheduler.add_job(background_sweep, "interval", minutes=SWEEP_MIN, id="sweep", max_instances=1, coalesce=True)
    scheduler.start()
    # Run an initial sweep in the background (non-blocking)
    asyncio.create_task(background_sweep())


@app.on_event("shutdown")
async def shutdown():
    try:
        scheduler.shutdown(wait=False)
    except Exception:
        pass
    client.close()


@api.get("/")
async def root():
    return {"service": "ThinkCloud IPAM", "simulated": is_simulated()}


app.include_router(api)
