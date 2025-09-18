import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

# Replace these with valid test user credentials and tenant info for login
TEST_USERNAME = "testuser"
TEST_PASSWORD = "testpassword"
TEST_TENANT = "testtenant"


def test_get_current_user_information():
    session = requests.Session()
    try:
        # Step 1: Authenticate user to get authentication cookie/session or token
        login_payload = {
            "username": TEST_USERNAME,
            "password": TEST_PASSWORD,
            "tenant": TEST_TENANT
        }
        login_resp = session.post(
            f"{BASE_URL}/api/auth/login",
            json=login_payload,
            timeout=TIMEOUT
        )
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        try:
            login_json = login_resp.json()
            # Optionally check for success field in the login response
            assert isinstance(login_json, dict), "Login response is not a JSON object"
        except Exception as e:
            assert False, f"Login response is not valid JSON: {str(e)}"

        # Step 2: Call GET /api/auth/me endpoint to get current user details
        me_resp = session.get(f"{BASE_URL}/api/auth/me", timeout=TIMEOUT)
        assert me_resp.status_code == 200, f"Failed to get current user info: {me_resp.text}"
        assert me_resp.content, "GET /api/auth/me returned empty response"

        try:
            user_info = me_resp.json()
        except Exception as e:
            assert False, f"Failed to decode JSON from /api/auth/me: {str(e)}"

        # Validate expected keys and types
        assert isinstance(user_info, dict), "User info response is not a JSON object"
        # Expected keys: tenant info and role info must exist to ensure data isolation and RBAC
        assert "tenant" in user_info and user_info["tenant"], "Tenant info missing in user info"
        assert "role" in user_info and user_info["role"], "Role info missing in user info"
        assert "username" in user_info and user_info["username"] == TEST_USERNAME, "Username mismatch in user info"

        # Ensure tenant isolation: tenant should be TEST_TENANT or matches expected tenant id/name
        assert user_info["tenant"] == TEST_TENANT, f"Tenant mismatch. Expected '{TEST_TENANT}', got '{user_info['tenant']}'"

        # Role should be one of expected roles (SUPER_ADMIN, CLIENT_USER)
        valid_roles = {"SUPER_ADMIN", "CLIENT_USER"}
        assert user_info["role"] in valid_roles, f"Unexpected role '{user_info['role']}'"

    finally:
        try:
            logout_resp = session.post(f"{BASE_URL}/api/auth/logout", timeout=TIMEOUT)
            assert logout_resp.status_code in [200, 204], f"Logout failed: {logout_resp.text}"
        except Exception:
            pass


test_get_current_user_information()
