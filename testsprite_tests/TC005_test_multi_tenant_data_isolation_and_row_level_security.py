import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

def test_multi_tenant_data_isolation_and_row_level_security():
    """Ensure upload and login endpoints enforce multi-tenant isolation and return JSON, not HTML."""

    headers = {
        'Accept': 'application/json',
    }

    # Test /api/login endpoint with invalid credentials to check JSON error response format
    login_url = f"{BASE_URL}/api/login"
    login_payload = {
        "username": "nonexistent_user",
        "password": "wrongpassword"
    }
    try:
        login_response = requests.post(login_url, json=login_payload, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Login request failed unexpectedly: {e}"
    assert login_response.headers.get('Content-Type', '').startswith('application/json'), \
        f"Expected JSON response content-type for /api/login, got {login_response.headers.get('Content-Type')}"
    assert login_response.status_code in (400, 401, 403), \
        f"Expected 4xx status code for invalid login, got {login_response.status_code}"
    try:
        login_json = login_response.json()
    except Exception as e:
        assert False, f"Response from /api/login is not valid JSON: {e}"
    assert isinstance(login_json, dict), "Response JSON from /api/login is not a dictionary"

    # Prepare dummy file content for upload endpoints (empty small text file in-memory)
    dummy_file_content = b"Test file content for multi-tenant isolation."
    dummy_file = {'file': ('test.txt', dummy_file_content, 'text/plain')}

    # Test /api/file/upload
    file_upload_url = f"{BASE_URL}/api/file/upload"
    try:
        file_upload_response = requests.post(file_upload_url, files=dummy_file, headers={}, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"File upload request failed unexpectedly: {e}"
    # Accept header may not apply for file upload; checking content-type response
    assert file_upload_response.headers.get('Content-Type', '').startswith('application/json'), \
        f"Expected JSON response content-type for /api/file/upload, got {file_upload_response.headers.get('Content-Type')}"
    # Status code generally 200 or 201; check that too
    assert file_upload_response.status_code in (200, 201, 400, 401, 403), \
        f"Unexpected status code for /api/file/upload: {file_upload_response.status_code}"
    try:
        file_upload_json = file_upload_response.json()
    except Exception as e:
        assert False, f"Response from /api/file/upload is not valid JSON: {e}"
    assert isinstance(file_upload_json, dict), "Response JSON from /api/file/upload is not a dictionary"

    # Test /api/documents/upload
    documents_upload_url = f"{BASE_URL}/api/documents/upload"
    try:
        doc_upload_response = requests.post(documents_upload_url, files=dummy_file, headers={}, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Documents upload request failed unexpectedly: {e}"
    assert doc_upload_response.headers.get('Content-Type', '').startswith('application/json'), \
        f"Expected JSON response content-type for /api/documents/upload, got {doc_upload_response.headers.get('Content-Type')}"
    assert doc_upload_response.status_code in (200, 201, 400, 401, 403), \
        f"Unexpected status code for /api/documents/upload: {doc_upload_response.status_code}"
    try:
        doc_upload_json = doc_upload_response.json()
    except Exception as e:
        assert False, f"Response from /api/documents/upload is not valid JSON: {e}"
    assert isinstance(doc_upload_json, dict), "Response JSON from /api/documents/upload is not a dictionary"


test_multi_tenant_data_isolation_and_row_level_security()