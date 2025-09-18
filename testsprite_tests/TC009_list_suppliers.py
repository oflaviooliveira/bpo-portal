import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

def test_list_suppliers():
    session = requests.Session()
    try:
        # Step 1: Authenticate user to get access token (assuming credentials and login endpoint)
        login_url = f"{BASE_URL}/api/auth/login"
        login_payload = {
            "username": "testuser",
            "password": "TestPassword123",
            "tenant": "default_tenant"
        }
        login_headers = {"Content-Type": "application/json"}
        login_response = session.post(login_url, json=login_payload, headers=login_headers, timeout=TIMEOUT)
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        login_data = login_response.json()
        assert "accessToken" in login_data, "Access token missing in login response"
        token = login_data["accessToken"]

        # Step 2: Call GET /api/fornecedores with Authorization header
        fornecedores_url = f"{BASE_URL}/api/fornecedores"
        headers = {
            "Authorization": f"Bearer {token}"
        }
        response = session.get(fornecedores_url, headers=headers, timeout=TIMEOUT)
        
        # Step 3: Assert response status and content
        assert response.status_code == 200, f"Expected 200 OK, got {response.status_code}"
        suppliers = response.json()
        assert isinstance(suppliers, list), "Response is not a list"
        
        # Optional: Check that suppliers contain expected keys, filtered by tenant & permissions
        for supplier in suppliers:
            assert isinstance(supplier, dict), "Supplier item is not a dictionary"
            # Example expected keys based on typical supplier entity
            required_keys = {"id", "name", "tenantId"}
            missing_keys = required_keys - supplier.keys()
            assert not missing_keys, f"Supplier missing keys: {missing_keys}"
            assert supplier["tenantId"] == login_payload["tenant"], "Supplier tenantId does not match authenticated tenant"
    finally:
        session.close()

test_list_suppliers()
