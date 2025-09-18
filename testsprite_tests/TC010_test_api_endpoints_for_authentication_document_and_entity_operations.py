import requests
from requests.exceptions import RequestException

BASE_URL = "http://localhost:3001"
TIMEOUT = 30
HEADERS_JSON = {"Accept": "application/json"}

def test_api_endpoints_authentication_and_uploads():
    # Test /api/login endpoint (authentication)
    login_url = f"{BASE_URL}/api/login"
    login_payload = {
        "username": "testuser",
        "password": "testpassword"
    }
    try:
        login_resp = requests.post(login_url, json=login_payload, headers=HEADERS_JSON, timeout=TIMEOUT)
        assert login_resp.status_code in (200, 401, 403)
        content_type = login_resp.headers.get("Content-Type", "")
        assert "application/json" in content_type, f"/api/login returned non-JSON content-type: {content_type}"
        # If success, parse JSON
        if login_resp.status_code == 200:
            data = login_resp.json()
            assert "token" in data or "session" in data or "user" in data, "Login success response missing expected keys"
    except RequestException as e:
        assert False, f"RequestException for /api/login: {e}"

    # Test /api/file/upload endpoint (file upload)
    upload_file_url = f"{BASE_URL}/api/file/upload"
    # Prepare a dummy in-memory file
    file_content = b"Dummy file content for testing"
    files = {
        "file": ("dummy.txt", file_content, "text/plain")
    }
    try:
        upload_file_resp = requests.post(upload_file_url, files=files, headers={"Accept": "application/json"}, timeout=TIMEOUT)
        content_type = upload_file_resp.headers.get("Content-Type", "")
        assert "application/json" in content_type, f"/api/file/upload returned non-JSON content-type: {content_type}"
        assert upload_file_resp.status_code in (200, 400, 401, 403), f"Unexpected status code for /api/file/upload: {upload_file_resp.status_code}"
        try:
            upload_file_resp.json()
        except ValueError:
            assert False, "/api/file/upload response content is not valid JSON"
    except RequestException as e:
        assert False, f"RequestException for /api/file/upload: {e}"

    # Test /api/documents/upload endpoint (document upload)
    upload_doc_url = f"{BASE_URL}/api/documents/upload"
    # Prepare dummy file upload as well, with a likely accepted mimetype for documents, e.g., PDF
    dummy_pdf_content = b"%PDF-1.4\n%Dummy PDF content\n"
    files = {
        "document": ("dummy.pdf", dummy_pdf_content, "application/pdf")
    }
    try:
        upload_doc_resp = requests.post(upload_doc_url, files=files, headers={"Accept": "application/json"}, timeout=TIMEOUT)
        content_type = upload_doc_resp.headers.get("Content-Type", "")
        assert "application/json" in content_type, f"/api/documents/upload returned non-JSON content-type: {content_type}"
        assert upload_doc_resp.status_code in (200, 400, 401, 403), f"Unexpected status code for /api/documents/upload: {upload_doc_resp.status_code}"
        try:
            upload_doc_resp.json()
        except ValueError:
            assert False, "/api/documents/upload response content is not valid JSON"
    except RequestException as e:
        assert False, f"RequestException for /api/documents/upload: {e}"


test_api_endpoints_authentication_and_uploads()