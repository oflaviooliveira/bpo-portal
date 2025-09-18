import requests
import os

BASE_URL = "http://localhost:3001"
LOGIN_URL = f"{BASE_URL}/api/auth/login"
UPLOAD_URL = f"{BASE_URL}/api/documents/upload"
DELETE_URL_TEMPLATE = f"{BASE_URL}/api/documents/{{}}"

# Credentials and tenant info should be valid for test environment
TEST_USER = {
    "username": "testuser",
    "password": "testpassword",
    "tenant": "testtenant"
}

# Sample document file paths (multi-format)
DOCUMENTS = [
    ("invoice.pdf", "application/pdf"),
    ("receipt.jpg", "image/jpeg"),
    ("bill.png", "image/png")
]

def test_document_upload_and_processing():
    session = requests.Session()
    uploaded_document_ids = []
    try:
        # Step 1: Login to obtain authentication cookies or tokens
        login_payload = {
            "username": TEST_USER["username"],
            "password": TEST_USER["password"],
            "tenant": TEST_USER["tenant"]
        }
        login_resp = session.post(LOGIN_URL, json=login_payload, timeout=30)
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        auth_data = login_resp.json()
        # Assuming login sets a session cookie or a JWT token in response
        # If token-based auth:
        token = auth_data.get("token")
        headers = {}
        if token:
            headers["Authorization"] = f"Bearer {token}"

        for doc_filename, mime_type in DOCUMENTS:
            filepath = os.path.join(os.path.dirname(__file__), doc_filename)
            # Check file existence for safety; for real test environment this should exist
            assert os.path.isfile(filepath), f"Test document file missing: {filepath}"

            with open(filepath, "rb") as f:
                files = {
                    "file": (doc_filename, f, mime_type)
                }
                # Upload document
                resp = session.post(UPLOAD_URL, headers=headers, files=files, timeout=30)
                assert resp.status_code == 201, f"Upload failed for {doc_filename}: {resp.text}"

                # Check that response content-type is JSON and content is not empty
                content_type = resp.headers.get('Content-Type', '')
                assert 'application/json' in content_type.lower(), f"Upload response is not JSON for {doc_filename}: {resp.text}"
                assert resp.text.strip(), f"Upload response is empty for {doc_filename}"

                resp_json = resp.json()

                # Validate response structure
                assert "id" in resp_json, "Response missing document id"
                assert "status" in resp_json, "Response missing document status"
                # The status should be initial status, e.g. "RECEBIDO" or similar from PRD
                initial_statuses = {"RECEBIDO", "VALIDANDO", "PENDENTE_REVISAO"}
                assert resp_json["status"] in initial_statuses, f"Unexpected initial status: {resp_json['status']}"

                uploaded_document_ids.append(resp_json["id"])

    finally:
        # Clean up: delete uploaded documents to maintain test environment state
        for doc_id in uploaded_document_ids:
            try:
                del_resp = session.delete(DELETE_URL_TEMPLATE.format(doc_id), headers=headers, timeout=30)
                # Accept 200 or 204 as success for delete
                assert del_resp.status_code in (200, 204), f"Failed to delete document {doc_id}: {del_resp.text}"
            except Exception:
                pass

test_document_upload_and_processing()
