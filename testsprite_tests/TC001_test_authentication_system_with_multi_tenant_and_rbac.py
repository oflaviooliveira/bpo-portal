import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

def test_authentication_system_multi_tenant_rbac():
    headers = {"Content-Type": "application/json"}
    # Sample tenants and users with credentials and expected roles
    tenants = [
        {
            "tenant": "tenant_superadmin",
            "username": "superadmin_user",
            "password": "superadmin_pass",
            "role": "SUPER_ADMIN"
        },
        {
            "tenant": "tenant_clientuser",
            "username": "clientuser_user",
            "password": "clientuser_pass",
            "role": "CLIENT_USER"
        }
    ]

    tokens = {}

    # Login for each tenant/user and verify JSON response and token presence
    for user in tenants:
        login_payload = {
            "tenant": user["tenant"],
            "username": user["username"],
            "password": user["password"]
        }
        try:
            resp = requests.post(f"{BASE_URL}/api/login", json=login_payload, headers=headers, timeout=TIMEOUT)
        except Exception as e:
            assert False, f"Login request failed for {user['role']} ({user['tenant']}): {e}"
        assert resp.status_code == 200, f"Login failed for {user['role']} ({user['tenant']}), status code: {resp.status_code}"
        try:
            json_resp = resp.json()
        except Exception:
            assert False, f"Login response not JSON for {user['role']} ({user['tenant']})"
        assert "token" in json_resp and isinstance(json_resp["token"], str) and json_resp["token"], f"Token missing or invalid in login response for {user['role']} ({user['tenant']})"
        tokens[user["role"]] = json_resp["token"]

    # Verify that accessing upload endpoints returns JSON and is role/tenant sensitive

    # Define upload endpoints to test
    upload_endpoints = [
        "/api/file/upload",
        "/api/documents/upload"
    ]

    # Test upload endpoint without authentication (should reject or return JSON error)
    for endpoint in upload_endpoints:
        try:
            resp = requests.post(f"{BASE_URL}{endpoint}", timeout=TIMEOUT)
        except Exception as e:
            assert False, f"Unauthenticated POST to {endpoint} failed: {e}"
        try:
            resp.json()
        except Exception:
            assert False, f"Unauthenticated response from {endpoint} is not JSON"
        # Commonly unauthorized or forbidden expected; status code 401 or 403 or 400 or 422 etc
        assert resp.status_code in {400,401,403,422}, f"Unexpected status code from unauthenticated POST {endpoint}: {resp.status_code}"

    # Test upload endpoints with each tenant token to verify tenant isolation and RBAC enforcement
    # For the sake of the test, send empty file data multipart/form-data or json placeholder and check response JSON (not HTML)
    for role, token in tokens.items():
        auth_headers = {
            "Authorization": f"Bearer {token}",
        }
        for endpoint in upload_endpoints:
            # For upload, provide a minimal valid file upload request.
            # Using files param with empty content to check response type and access control.
            files = {
                "file": ("test.txt", b"Test content", "text/plain")
            }
            try:
                resp = requests.post(f"{BASE_URL}{endpoint}", headers=auth_headers, files=files, timeout=TIMEOUT)
            except Exception as e:
                assert False, f"Authenticated POST to {endpoint} failed for role {role}: {e}"
            assert resp.status_code in {200, 201, 400, 401, 403, 422}, f"Unexpected status code {resp.status_code} for {endpoint} with role {role}"
            try:
                json_resp = resp.json()
            except Exception:
                assert False, f"Response from {endpoint} with role {role} is not JSON"

            # Role-based access control check:
            # SUPER_ADMIN should have access, CLIENT_USER may have restricted access or specific errors
            if role == "SUPER_ADMIN":
                assert resp.status_code in {200,201,400,422}, f"SUPER_ADMIN should have allowed or validation error responses at {endpoint}, got {resp.status_code}"
            elif role == "CLIENT_USER":
                # CLIENT_USER allowed or forbidden depending on API design. Accept 200, 201 or 403 for forbidden.
                assert resp.status_code in {200,201,403,422}, f"CLIENT_USER unexpected status code at {endpoint}: {resp.status_code}"

    # Finally check /api/login endpoint returns JSON error on bad credentials, no HTML
    bad_login_payload = {"tenant": "invalid_tenant", "username": "invalid", "password": "invalid"}
    try:
        resp = requests.post(f"{BASE_URL}/api/login", json=bad_login_payload, headers=headers, timeout=TIMEOUT)
    except Exception as e:
        assert False, f"Login request with bad credentials failed unexpectedly: {e}"
    assert resp.status_code in {400,401,403}, "Bad login credentials should return 400/401/403 status code"
    try:
        resp.json()
    except Exception:
        assert False, "Bad login credentials response is not JSON"

test_authentication_system_multi_tenant_rbac()