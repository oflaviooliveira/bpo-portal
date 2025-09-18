import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

def test_document_upload_and_lifecycle_management():
    session = requests.Session()
    try:
        # 1. Test authentication endpoint /api/login returns JSON
        login_payload = {
            "username": "testclientuser",
            "password": "TestPassword123!"
        }
        login_headers = {"Content-Type": "application/json"}
        login_resp = session.post(
            f"{BASE_URL}/api/login",
            json=login_payload,
            headers=login_headers,
            timeout=TIMEOUT
        )
        # Validate HTTP status and JSON content type
        assert login_resp.status_code == 200, f"Login failed with status {login_resp.status_code}"
        assert "application/json" in login_resp.headers.get("Content-Type", ""), \
            "Login response Content-Type is not application/json"
        login_json = login_resp.json()
        assert "token" in login_json or "accessToken" in login_json, \
            "Login response JSON should contain token or accessToken"

        # Use token for authenticated requests if present (assume Bearer token)
        auth_token = login_json.get("token") or login_json.get("accessToken")
        assert auth_token, "Authentication token missing in login response"
        auth_headers = {
            "Authorization": f"Bearer {auth_token}"
        }

        # 2. Test /api/file/upload endpoint - upload a small dummy file and check JSON response
        file_upload_url = f"{BASE_URL}/api/file/upload"
        file_content = b"Test file content for upload endpoint"
        files = {
            "file": ("testfile.txt", file_content, "text/plain")
        }
        file_upload_resp = session.post(
            file_upload_url,
            files=files,
            headers=auth_headers,
            timeout=TIMEOUT
        )
        assert file_upload_resp.status_code == 200, f"/api/file/upload returned status {file_upload_resp.status_code}"
        assert "application/json" in file_upload_resp.headers.get("Content-Type", ""), \
            "/api/file/upload response Content-Type is not application/json"
        file_upload_json = file_upload_resp.json()
        # Validate essential fields in response (example: fileId, status or similar)
        assert isinstance(file_upload_json, dict), "File upload response is not a JSON object"
        assert "fileId" in file_upload_json or "id" in file_upload_json, "No file identifier in upload response"

        # 3. Test /api/documents/upload endpoint - upload same dummy file and check JSON response
        documents_upload_url = f"{BASE_URL}/api/documents/upload"
        files = {
            "file": ("testdoc.pdf", file_content, "application/pdf")
        }
        documents_upload_resp = session.post(
            documents_upload_url,
            files=files,
            headers=auth_headers,
            timeout=TIMEOUT
        )
        assert documents_upload_resp.status_code == 200, f"/api/documents/upload returned status {documents_upload_resp.status_code}"
        assert "application/json" in documents_upload_resp.headers.get("Content-Type", ""), \
            "/api/documents/upload response Content-Type is not application/json"
        documents_upload_json = documents_upload_resp.json()
        assert isinstance(documents_upload_json, dict), "Documents upload response is not a JSON object"
        # Validate expected keys for document upload response (example: documentId, status)
        assert "documentId" in documents_upload_json or "id" in documents_upload_json, "No document identifier in upload response"
        assert "status" in documents_upload_json, "No status in document upload response"

        # Optional: Validate workflow status transition keys exist (basic check)
        expected_status_values = ["RECEBIDO", "VALIDANDO", "PAGO_A_CONCILIAR", "EM_CONCILIACAO", "ARQUIVADO"]
        assert documents_upload_json["status"] in expected_status_values, \
            f"Unexpected document status: {documents_upload_json['status']}"

    except requests.exceptions.RequestException as e:
        assert False, f"HTTP request failed: {e}"
    except ValueError as e:
        assert False, f"Response content is not valid JSON: {e}"

test_document_upload_and_lifecycle_management()