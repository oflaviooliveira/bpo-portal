import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

def test_dashboard_statistics_retrieval():
    """
    Test the GET /api/dashboard/stats endpoint to ensure it returns 
    correct operational and financial statistics filtered by tenant and user permissions.
    """
    session = requests.Session()

    try:
        # Step 1: Authenticate user to obtain auth token (assuming username/password)
        login_payload = {
            "username": "testuser",
            "password": "TestPassword123",
            "tenant": "tenant_01"
        }
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json=login_payload,
            timeout=TIMEOUT
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        token = login_response.json().get("accessToken")
        assert token, "Auth token not returned on login"
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json"
        }

        # Step 2: Call dashboard statistics endpoint
        stats_response = session.get(
            f"{BASE_URL}/api/dashboard/stats",
            headers=headers,
            timeout=TIMEOUT
        )
        assert stats_response.status_code == 200, f"Failed to retrieve dashboard stats: {stats_response.text}"
        data = stats_response.json()

        # Validate expected keys related to operational and financial statistics
        expected_keys = [
            "operationalStats",
            "financialStats",
            "tenantId",
            "userPermissions"
        ]
        for key in expected_keys:
            assert key in data, f"Missing key in response data: {key}"

        # Validate tenant filtering (tenantId must match login tenant)
        assert data.get("tenantId") == "tenant_01", "Tenant ID in response does not match logged in tenant"

        # Validate operationalStats and financialStats are dicts with expected fields
        operational_stats = data.get("operationalStats")
        financial_stats = data.get("financialStats")
        assert isinstance(operational_stats, dict), "operationalStats should be an object"
        assert isinstance(financial_stats, dict), "financialStats should be an object"

        # Example expected fields inside operationalStats (based on PRD context)
        op_expected_fields = ["documentsProcessed", "documentsPending", "activeWorkflows"]
        for field in op_expected_fields:
            assert field in operational_stats, f"Missing operationalStats field: {field}"
            assert isinstance(operational_stats[field], (int, float)), f"Field {field} should be numeric"

        # Example expected fields inside financialStats
        fin_expected_fields = ["totalRevenue", "totalExpenses", "pendingPayments"]
        for field in fin_expected_fields:
            assert field in financial_stats, f"Missing financialStats field: {field}"
            assert isinstance(financial_stats[field], (int, float)), f"Field {field} should be numeric"

        # Validate userPermissions indicate role-based access control info
        user_permissions = data.get("userPermissions")
        assert isinstance(user_permissions, dict), "userPermissions should be an object"
        assert "roles" in user_permissions and isinstance(user_permissions["roles"], list), "userPermissions.roles missing or invalid"
        assert len(user_permissions["roles"]) > 0, "User should have at least one role in permissions"

    finally:
        # Step 3: Logout user
        try:
            logout_response = session.post(
                f"{BASE_URL}/api/auth/logout",
                headers=headers,
                timeout=TIMEOUT
            )
            assert logout_response.status_code == 200, f"Logout failed: {logout_response.text}"
        except Exception:
            # Ignore logout errors, as this is cleanup
            pass

test_dashboard_statistics_retrieval()
