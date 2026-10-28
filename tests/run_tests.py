import unittest
import urllib.request
import urllib.parse
import json
import time

BASE_URL = "http://localhost:8001/api"
ADMIN_EMAIL = "admin@thinkcloud.in"
# Try passwords
PASSWORDS = ["Teamw0rk@1", "ChangeMe@123"]


def api_request(path, method="GET", data=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    encoded_data = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=encoded_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=35) as response:
            status = response.status
            body = response.read().decode("utf-8")
            try:
                res_data = json.loads(body)
            except Exception:
                res_data = body
            return status, res_data
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        try:
            res_data = json.loads(body)
        except Exception:
            res_data = body
        return e.code, res_data


class ThinkCloudIPAMTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # 1. Login to get token
        cls.token = None
        for pw in PASSWORDS:
            status, res = api_request("/auth/login", method="POST", data={"email": ADMIN_EMAIL, "password": pw})
            if status == 200 and "token" in res:
                cls.token = res["token"]
                cls.user = res.get("user")
                break
        if not cls.token:
            raise RuntimeError(f"Could not authenticate as {ADMIN_EMAIL}")

    def test_01_root(self):
        status, res = api_request("/")
        self.assertEqual(status, 200)
        self.assertEqual(res.get("service"), "ThinkCloud IPAM")

    def test_02_auth_me(self):
        status, res = api_request("/auth/me", token=self.token)
        self.assertEqual(status, 200)
        self.assertEqual(res.get("email"), ADMIN_EMAIL)
        self.assertIn(res.get("role"), ["admin", "super_admin"])

    def test_03_networks(self):
        status, res = api_request("/networks", token=self.token)
        self.assertEqual(status, 200)
        self.assertIsInstance(res, list)
        self.assertGreaterEqual(len(res), 3)

    def test_04_dashboard_stats(self):
        status, res = api_request("/dashboard", token=self.token)
        self.assertEqual(status, 200)
        self.assertIn("utilization_pct", res)
        self.assertIn("total_in_use", res)
        self.assertIn("networks", res)

    def test_05_all_addresses(self):
        status, res = api_request("/ips", token=self.token)
        self.assertEqual(status, 200)
        self.assertIsInstance(res, list)
        self.assertGreater(len(res), 0)

    def test_06_backups_generate_list_and_download(self):
        # Generate backup
        status, gen_res = api_request("/backups/generate", method="POST", token=self.token)
        self.assertEqual(status, 200, f"Generate backup failed: {gen_res}")
        self.assertIn("filename", gen_res)
        filename = gen_res["filename"]
        self.assertTrue(filename.endswith(".csv"))

        # List backups
        status, list_res = api_request("/backups", token=self.token)
        self.assertEqual(status, 200)
        filenames = [b.get("filename") for b in list_res]
        self.assertIn(filename, filenames)

        # Download backup
        status, dl_res = api_request(f"/backups/{filename}", token=self.token)
        self.assertEqual(status, 200)
        self.assertIn("address", dl_res.lower())
        self.assertIn("vlan", dl_res.lower())

    def test_07_vlan_and_location_allocation_and_edit(self):
        # 1. Request an IP
        status, req_res = api_request("/ips/request", method="POST", data={}, token=self.token)
        self.assertEqual(status, 200, f"Request failed: {req_res}")
        addr = req_res["address"]

        # 2. Finalize with VLAN and Location
        status, fin_res = api_request(
            "/ips/finalize",
            method="POST",
            data={
                "address": addr,
                "device_name": "Test-Device-PyUnit",
                "purpose": "Automated Testing Suite",
                "vlan_id": "VLAN-100",
                "location": "Rack-4-Lab",
                "mac_address": "AA:BB:CC:11:22:33",
            },
            token=self.token,
        )
        self.assertEqual(status, 200, f"Finalize failed: {fin_res}")

        # 3. Verify in /ips/mine
        status, mine_res = api_request("/ips/mine", token=self.token)
        self.assertEqual(status, 200)
        mine_dict = {item["address"]: item for item in mine_res}
        self.assertIn(addr, mine_dict)
        rec = mine_dict[addr]
        self.assertEqual(rec.get("vlan_id"), "VLAN-100")
        self.assertEqual(rec.get("location"), "Rack-4-Lab")

        # 4. Patch/Update VLAN and location
        status, patch_res = api_request(
            f"/ips/{addr}",
            method="PATCH",
            data={
                "vlan_id": "VLAN-300",
                "location": "Datacenter-Floor-2",
            },
            token=self.token,
        )
        self.assertEqual(status, 200)

        # 5. Release IP back to pool
        status, rel_res = api_request(f"/ips/{addr}/release", method="POST", token=self.token)
        self.assertEqual(status, 200)

    def test_08_conflicts(self):
        status, res = api_request("/conflicts", token=self.token)
        self.assertEqual(status, 200)
        self.assertIsInstance(res, list)

    def test_09_notifications(self):
        status, res = api_request("/notifications", token=self.token)
        self.assertEqual(status, 200)
        self.assertIsInstance(res, list)


if __name__ == "__main__":
    unittest.main()
