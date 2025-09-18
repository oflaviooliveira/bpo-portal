import requests

BASE_URL = "http://localhost:3001"
LOGIN_ENDPOINT = "/api/auth/login"
TIMEOUT = 30

def test_user_authentication_login():
    url = f"{BASE_URL}{LOGIN_ENDPOINT}"
    headers = {
        "Content-Type": "application/json"
    }
    # Valid credentials with tenantId in payload
    payload = {
        "username": "validuser@example.com",
        "password": "ValidPassword123",
        "tenantId": "validTenantId123"
    }
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request to {url} failed with exception: {e}"

    # Assert successful status code
    assert response.status_code == 200, f"Unexpected status code: {response.status_code}, response: {response.text}"

    # Assert JSON response structure and content
    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    # Check for presence of accessToken (as per typical auth response)
    assert "accessToken" in data, "No accessToken found in response"

    # Check user object with role information
    user = data.get("user") or data.get("data", {}).get("user")
    assert user is not None, "User data not found in response"

    # Validate role is present and valid - example roles: SUPER_ADMIN, CLIENT_USER
    role = user.get("role")
    assert role in {"SUPER_ADMIN", "CLIENT_USER"}, f"Unexpected or missing role: {role}"

    # Optional: Validate permissions or RBAC indicators if present
    permissions = user.get("permissions")
    if permissions is not None:
        assert isinstance(permissions, list), "Permissions should be a list"

test_user_authentication_login()
