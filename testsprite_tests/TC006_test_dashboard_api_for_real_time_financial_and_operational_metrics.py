import requests
from requests.exceptions import RequestException, Timeout

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

def test_dashboard_api_real_time_metrics():
    """Test /api/login, /api/file/upload, /api/documents/upload endpoints for JSON responses and no HTML"""
    headers_json = {
        "Accept": "application/json"
    }
    session = requests.Session()

    # 1. Test /api/login endpoint: POST with sample credentials, expect JSON response
    login_url = f"{BASE_URL}/api/login"
    login_payload = {
        "username": "testuser@example.com",
        "password": "TestPass123!"
    }
    try:
        login_resp = session.post(login_url, json=login_payload, headers=headers_json, timeout=TIMEOUT)
        assert login_resp.status_code == 200, f"Login status code {login_resp.status_code} != 200"
        try:
            login_json = login_resp.json()
        except ValueError:
            raise AssertionError("Login response is not JSON")
        # Basic validation of expected keys in login response
        assert "token" in login_json or "accessToken" in login_json or "user" in login_json, \
            "Login JSON response missing expected keys (token or user)"
    except (RequestException, Timeout) as e:
        raise AssertionError(f"Login request failed: {e}")

    # Prepare auth header if token returned
    auth_token = login_json.get("token") or login_json.get("accessToken")
    auth_headers = headers_json.copy()
    if auth_token:
        auth_headers["Authorization"] = f"Bearer {auth_token}"


    # 2. Test /api/file/upload endpoint: POST file upload, expect JSON response (no HTML)
    file_upload_url = f"{BASE_URL}/api/file/upload"
    # Create a small dummy file content in-memory
    dummy_file_content = b"Dummy file content for testing"
    files = {
        "file": ("testfile.txt", dummy_file_content, "text/plain"),
    }
    try:
        upload_resp = session.post(file_upload_url, headers=auth_headers, files=files, timeout=TIMEOUT)
        assert upload_resp.status_code in (200, 201), f"File upload status code {upload_resp.status_code} not 200 or 201"
        # Assert content type is application/json or compatible
        ct = upload_resp.headers.get("Content-Type", "")
        assert "application/json" in ct.lower(), f"File upload Content-Type not JSON: {ct}"
        try:
            upload_json = upload_resp.json()
        except ValueError:
            raise AssertionError("File upload response is not JSON")
        # Basic check that response JSON is a dict/object
        assert isinstance(upload_json, dict), "File upload JSON response is not an object"
    except (RequestException, Timeout) as e:
        raise AssertionError(f"File upload request failed: {e}")

    # 3. Test /api/documents/upload endpoint: POST with file, expect JSON response (no HTML)
    doc_upload_url = f"{BASE_URL}/api/documents/upload"
    # Reuse dummy file content
    files = {
        "file": ("document.pdf", dummy_file_content, "application/pdf"),
    }
    try:
        doc_resp = session.post(doc_upload_url, headers=auth_headers, files=files, timeout=TIMEOUT)
        assert doc_resp.status_code in (200, 201), f"Documents upload status code {doc_resp.status_code} not 200 or 201"
        ct = doc_resp.headers.get("Content-Type", "")
        assert "application/json" in ct.lower(), f"Documents upload Content-Type not JSON: {ct}"
        try:
            doc_json = doc_resp.json()
        except ValueError:
            raise AssertionError("Documents upload response is not JSON")
        assert isinstance(doc_json, dict), "Documents upload JSON response is not an object"
    except (RequestException, Timeout) as e:
        raise AssertionError(f"Documents upload request failed: {e}")

test_dashboard_api_real_time_metrics()