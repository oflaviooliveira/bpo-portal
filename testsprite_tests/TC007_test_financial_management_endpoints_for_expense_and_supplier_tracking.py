import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30


def test_financial_management_upload_and_auth_endpoints():
    # Test /api/login endpoint returns JSON and handles authentication
    login_url = f"{BASE_URL}/api/login"
    login_payload = {
        "username": "testuser",
        "password": "testpassword"
    }
    headers = {"Accept": "application/json"}

    # Send POST to /api/login
    login_response = requests.post(login_url, json=login_payload, headers=headers, timeout=TIMEOUT)
    try:
        login_response.raise_for_status()
    except requests.RequestException as e:
        assert False, f"/api/login request failed: {e}"
    try:
        login_json = login_response.json()
    except ValueError:
        assert False, "/api/login response is not valid JSON"
    # Assert JSON response contains expected keys (e.g., token, user)
    assert isinstance(login_json, dict), "/api/login response JSON is not a dictionary"
    assert "token" in login_json or "error" in login_json, "/api/login JSON missing 'token' or 'error' key"

    token = login_json.get("token")
    auth_headers = {
        "Authorization": f"Bearer {token}" if token else "",
        "Accept": "application/json"
    }

    # Test /api/file/upload endpoint returns JSON (file upload simulation)
    file_upload_url = f"{BASE_URL}/api/file/upload"
    # Create sample file content in memory
    files = {
        "file": ("test_document.txt", b"Sample file content for upload test", "text/plain")
    }
    try:
        file_upload_resp = requests.post(file_upload_url, headers=auth_headers, files=files, timeout=TIMEOUT)
        file_upload_resp.raise_for_status()
    except requests.RequestException as e:
        assert False, f"/api/file/upload request failed: {e}"
    # Check JSON response, not HTML
    content_type = file_upload_resp.headers.get("Content-Type", "")
    assert "application/json" in content_type.lower(), "/api/file/upload response Content-Type is not JSON"
    try:
        file_upload_json = file_upload_resp.json()
    except ValueError:
        assert False, "/api/file/upload response is not valid JSON"
    assert isinstance(file_upload_json, dict), "/api/file/upload response JSON is not a dictionary"

    # Test /api/documents/upload endpoint returns JSON (document upload simulation)
    documents_upload_url = f"{BASE_URL}/api/documents/upload"
    # Similar file upload with minimal dummy content
    doc_files = {
        "document": ("invoice.pdf", b"%PDF-1.4 dummy pdf content", "application/pdf")
    }
    try:
        doc_upload_resp = requests.post(documents_upload_url, headers=auth_headers, files=doc_files, timeout=TIMEOUT)
        doc_upload_resp.raise_for_status()
    except requests.RequestException as e:
        assert False, f"/api/documents/upload request failed: {e}"
    content_type_doc = doc_upload_resp.headers.get("Content-Type", "")
    assert "application/json" in content_type_doc.lower(), "/api/documents/upload response Content-Type is not JSON"
    try:
        doc_upload_json = doc_upload_resp.json()
    except ValueError:
        assert False, "/api/documents/upload response is not valid JSON"
    assert isinstance(doc_upload_json, dict), "/api/documents/upload response JSON is not a dictionary"


test_financial_management_upload_and_auth_endpoints()