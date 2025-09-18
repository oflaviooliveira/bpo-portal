import requests

BASE_URL = "http://localhost:3001"
LOGIN_ENDPOINT = "/api/auth/login"
LOGOUT_ENDPOINT = "/api/auth/logout"
ME_ENDPOINT = "/api/auth/me"
TIMEOUT = 30

# Test credentials and tenant for login (these must be valid in the test environment)
TEST_USERNAME = "testuser"
TEST_PASSWORD = "testpassword"
TEST_TENANT = "testtenant"

def test_user_logout_functionality():
    session = requests.Session()
    try:
        # Step 1: Login to obtain session cookies and authentication
        login_payload = {
            "username": TEST_USERNAME,
            "password": TEST_PASSWORD,
            "tenant": TEST_TENANT
        }
        login_resp = session.post(
            BASE_URL + LOGIN_ENDPOINT,
            json=login_payload,
            timeout=TIMEOUT
        )
        assert login_resp.status_code == 200, f"Login failed with status {login_resp.status_code}"
        login_data = login_resp.json()
        assert "token" in login_data or session.cookies, "Login response missing token or session cookie"

        # Optionally test if /api/auth/me works after login
        me_resp = session.get(BASE_URL + ME_ENDPOINT, timeout=TIMEOUT)
        assert me_resp.status_code == 200, f"Failed to get user info after login, status {me_resp.status_code}"
        me_data = me_resp.json()
        assert me_data.get("username") == TEST_USERNAME or me_data.get("tenant") == TEST_TENANT, "User info mismatch after login"

        # Step 2: Call logout endpoint to terminate session
        logout_resp = session.post(BASE_URL + LOGOUT_ENDPOINT, timeout=TIMEOUT)
        assert logout_resp.status_code == 200, f"Logout failed with status {logout_resp.status_code}"

        # Check if logout response has JSON content before parsing
        if logout_resp.content and logout_resp.content.strip():
            try:
                logout_data = logout_resp.json()
                assert ("message" in logout_data) or (logout_data.get("success") is True), "Logout response invalid or missing confirmation"
            except Exception:
                assert False, "Logout response is not valid JSON"
        else:
            # If no meaningful content, consider status code 200 as success
            pass

        # Step 3: Verify session is terminated by attempting to access protected resource
        me_after_logout_resp = session.get(BASE_URL + ME_ENDPOINT, timeout=TIMEOUT)
        # After logout, this should not succeed - expecting 401 Unauthorized or 403 Forbidden
        assert me_after_logout_resp.status_code in (401, 403), "Session was not properly terminated after logout"

    finally:
        session.close()

test_user_logout_functionality()