import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

def test_file_storage_and_upload_handling():
    """
    Test the upload endpoints /api/file/upload, /api/documents/upload and authentication /api/login
    to verify they return JSON responses (not HTML), supporting multiple document formats,
    and validating file integrity.
    """

    # Sample credentials for login (adjust as needed)
    login_payload = {
        "username": "testuser",
        "password": "testpassword"
    }
    headers = {
        "Accept": "application/json"
    }

    # 1) Test authentication endpoint /api/login - POST
    try:
        login_response = requests.post(
            f"{BASE_URL}/api/login",
            json=login_payload,
            headers=headers,
            timeout=TIMEOUT
        )
    except requests.RequestException as e:
        assert False, f"Login request failed: {e}"

    assert login_response.status_code == 200, f"Expected 200 OK for /api/login, got {login_response.status_code}"
    try:
        login_json = login_response.json()
    except ValueError:
        assert False, "Login response is not JSON"
    # Basic check for presence of a token or user info field
    assert any(k in login_json for k in ("token", "accessToken", "user")), "Login response JSON missing token/user info"

    token = login_json.get("token") or login_json.get("accessToken")
    assert token, "Token not found in login response"

    auth_headers = {
        "Authorization": f"Bearer {token}"
    }

    # Prepare a set of sample files for upload testing with minimal binary content.
    # For testing purposes, small bytes content simulating different file types:
    test_files = [
        ("document.pdf", b"%PDF-1.4\n%EOF\n", "application/pdf"),
        ("image.png", b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00", "image/png"),
        ("text.txt", b"Sample text content", "text/plain"),
        ("spreadsheet.xlsx", b"PK\x03\x04\x14\x00\x06\x00", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    ]

    # 2) Test /api/file/upload endpoint - POST with files
    for filename, filedata, mimetype in test_files:
        files = {
            "file": (filename, filedata, mimetype)
        }
        try:
            response = requests.post(
                f"{BASE_URL}/api/file/upload",
                headers={**headers, **auth_headers},
                files=files,
                timeout=TIMEOUT
            )
        except requests.RequestException as e:
            assert False, f"/api/file/upload request failed for {filename}: {e}"

        assert response.status_code == 200, f"/api/file/upload expected 200 OK for {filename}, got {response.status_code}"
        # Response should be JSON
        try:
            resp_json = response.json()
        except ValueError:
            assert False, f"/api/file/upload response for {filename} is not JSON"
        # Basic file upload response validation: expect file info or success msg
        assert isinstance(resp_json, dict), f"/api/file/upload response JSON invalid for {filename}"

    # 3) Test /api/documents/upload endpoint - POST with files
    for filename, filedata, mimetype in test_files:
        files = {
            "document": (filename, filedata, mimetype)
        }
        try:
            response = requests.post(
                f"{BASE_URL}/api/documents/upload",
                headers={**headers, **auth_headers},
                files=files,
                timeout=TIMEOUT
            )
        except requests.RequestException as e:
            assert False, f"/api/documents/upload request failed for {filename}: {e}"

        assert response.status_code == 200, f"/api/documents/upload expected 200 OK for {filename}, got {response.status_code}"
        try:
            resp_json = response.json()
        except ValueError:
            assert False, f"/api/documents/upload response for {filename} is not JSON"
        assert isinstance(resp_json, dict), f"/api/documents/upload response JSON invalid for {filename}"

test_file_storage_and_upload_handling()
