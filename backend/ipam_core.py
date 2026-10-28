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


def ping_host_detailed(address: str, timeout_ms: int = 600) -> Dict:
    """Real ICMP ping using system ping. Returns dict with status, rtt, output.
    A valid reply on Windows and Linux contains 'ttl='.
    Destination unreachable and request timed out do not contain 'ttl='.
    """
    is_win = os.name == "nt"
    cmd = (
        ["ping", "-n", "1", "-w", str(timeout_ms), address]
        if is_win
        else ["ping", "-c", "1", "-W", str(max(1, timeout_ms // 1000)), address]
    )
    try:
        r = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=(timeout_ms / 1000.0) + 1.5,
        )
        out = r.stdout or ""
        out_lower = out.lower()
        is_alive = (r.returncode == 0) and ("ttl=" in out_lower)
        rtt = None
        for line in out.splitlines():
            line_lower = line.lower()
            if "time=" in line_lower or "time<" in line_lower:
                for part in line.split():
                    if "time" in part.lower():
                        rtt = part.strip()
                        break
        return {
            "alive": is_alive,
            "details": out.strip(),
            "rtt": rtt,
            "returncode": r.returncode,
        }
    except Exception as e:
        return {
            "alive": False,
            "details": str(e),
            "rtt": None,
            "returncode": -1,
        }


def ping_host(address: str, retries: int = 0, timeout_sec: int = 1) -> bool:
    """Real ICMP ping. Returns True if target host replies with TTL."""
    timeout_ms = int(timeout_sec * 1000) if timeout_sec else 600
    res = ping_host_detailed(address, timeout_ms=timeout_ms)
    if res["alive"]:
        return True
    for _ in range(retries):
        if ping_host_detailed(address, timeout_ms=timeout_ms)["alive"]:
            return True
    return False


def reverse_dns(address: str, timeout_sec: float = 0.5) -> Optional[str]:
    """Reverse DNS lookup using dnspython for ultra-fast non-blocking resolution.
    Avoids Windows socket.gethostbyaddr NetBIOS/WINS broadcast delays.
    """
    try:
        import dns.resolver
        import dns.reversename
        rev = dns.reversename.from_address(address)
        resolver = dns.resolver.Resolver()
        resolver.lifetime = timeout_sec
        resolver.timeout = timeout_sec * 0.7
        ans = resolver.resolve(rev, "PTR")
        if ans:
            return str(ans[0]).rstrip(".")
        return None
    except Exception:
        # Fallback to standard socket only if dnspython fails or is unavailable
        try:
            socket.setdefaulttimeout(0.3)
            host, _, _ = socket.gethostbyaddr(address)
            return host
        except Exception:
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
    """Runs ping + DNS. Returns dict {ping, dns, checked_at, mode, rtt, details}."""
    if simulated:
        s = _simulated_state(address)
        return {
            "ping": s["ping"],
            "dns": s["dns"],
            "checked_at": datetime.now(timezone.utc).isoformat(),
            "mode": "simulated",
            "rtt": "1ms" if s["ping"] else None,
            "details": "Simulated check",
        }
    res = ping_host_detailed(address, timeout_ms=600)
    dns_name = reverse_dns(address, timeout_sec=0.5)
    return {
        "ping": res["alive"],
        "dns": dns_name,
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "mode": "live",
        "rtt": res.get("rtt"),
        "details": res.get("details"),
    }


def is_simulated() -> bool:
    return os.environ.get("IPAM_SIMULATED", "false").lower() in ("1", "true", "yes")

