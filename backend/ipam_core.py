"""Core IPAM logic: networks, ping/DNS verification, address enumeration."""
import ipaddress
import os
import socket
import subprocess
import random
from datetime import datetime, timezone
from typing import List, Dict, Optional


DEFAULT_NETWORKS = [
    {
        "name": "Network A",
        "cidr": "10.1.0.0/22",
        "excluded_ranges": ["10.1.3.0/24"],
        "notes": "10.1.3.x is DHCP pool",
    },
    {
        "name": "Network B",
        "cidr": "192.168.100.0/24",
        "excluded_ranges": [],
        "notes": "Fully eligible",
    },
    {
        "name": "Network C",
        "cidr": "172.16.0.0/22",
        "excluded_ranges": [],
        "notes": "Fully eligible",
    },
]


def enumerate_addresses(cidr: str) -> List[str]:
    net = ipaddress.ip_network(cidr, strict=False)
    return [str(a) for a in net.hosts()]


def is_in_dhcp_range(address: str, excluded_ranges: List[str]) -> bool:
    ip = ipaddress.ip_address(address)
    for r in excluded_ranges:
        try:
            if ip in ipaddress.ip_network(r, strict=False):
                return True
        except ValueError:
            continue
    return False


def ping_host(address: str, retries: int = 2, timeout_sec: int = 1) -> bool:
    """Real ICMP ping using system ping. Returns True if any reply."""
    for _ in range(retries + 1):
        try:
            r = subprocess.run(
                ["ping", "-c", "1", "-W", str(timeout_sec), address],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=timeout_sec + 2,
            )
            if r.returncode == 0:
                return True
        except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
            continue
    return False


def reverse_dns(address: str) -> Optional[str]:
    """Reverse DNS lookup. Returns hostname or None."""
    try:
        socket.setdefaulttimeout(2)
        host, _, _ = socket.gethostbyaddr(address)
        return host
    except (socket.herror, socket.gaierror, OSError):
        return None
    finally:
        socket.setdefaulttimeout(None)


def _simulated_state(address: str) -> Dict:
    """Deterministic pseudo-random state for preview/demo mode."""
    seed = sum(int(o) for o in address.split("."))
    random.seed(seed)
    roll = random.random()
    if roll < 0.06:
        return {"ping": True, "dns": f"host-{seed}.legacy.thinkcloud.local"}
    if roll < 0.14:
        return {"ping": False, "dns": f"stale-{seed}.old.thinkcloud.local"}
    return {"ping": False, "dns": None}


def verify_address(address: str, simulated: bool = False) -> Dict:
    """Runs ping + DNS. Returns dict {ping, dns, checked_at}."""
    if simulated:
        s = _simulated_state(address)
        return {
            "ping": s["ping"],
            "dns": s["dns"],
            "checked_at": datetime.now(timezone.utc).isoformat(),
            "mode": "simulated",
        }
    ping_ok = ping_host(address)
    dns_name = reverse_dns(address)
    return {
        "ping": ping_ok,
        "dns": dns_name,
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "mode": "live",
    }


def is_simulated() -> bool:
    return os.environ.get("IPAM_SIMULATED", "false").lower() in ("1", "true", "yes")
