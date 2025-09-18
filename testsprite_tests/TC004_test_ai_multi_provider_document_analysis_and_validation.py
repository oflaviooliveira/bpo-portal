import requests
import json

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

def test_ai_multi_provider_document_analysis_and_validation():
    session = requests.Session()

    # 1. Test /api/login endpoint - POST expecting JSON response
    login_url = f"{BASE_URL}/api/login"
    login_payload = {
        "username": "testuser",
        "password": "testpassword"
    }
    try:
        login_response = session.post(login_url, json=login_payload, timeout=TIMEOUT)
        assert login_response.headers.get("Content-Type", "").startswith("application/json"), "Login response not JSON"
        assert login_response.status_code == 200, f"Unexpected login status code: {login_response.status_code}"
        login_json = login_response.json()
        assert "token" in login_json or "accessToken" in login_json or "session" in login_json, "Login response missing token/session"
    except requests.RequestException as e:
        assert False, f"Login request failed: {e}"

    # Prepare auth header if token present
    token = None
    if "token" in login_json:
        token = login_json["token"]
    elif "accessToken" in login_json:
        token = login_json["accessToken"]
    auth_headers = {"Authorization": f"Bearer {token}"} if token else {}

    # 2. Test /api/file/upload endpoint - POST expecting JSON response
    file_upload_url = f"{BASE_URL}/api/file/upload"
    # Prepare a minimal dummy file content for upload
    file_content = b"Dummy file content for AI multi-provider test"
    files = {"file": ("testfile.txt", file_content, "text/plain")}
    try:
        upload_response = session.post(file_upload_url, headers=auth_headers, files=files, timeout=TIMEOUT)
        assert upload_response.headers.get("Content-Type", "").startswith("application/json"), "File upload response not JSON"
        assert upload_response.status_code in (200, 201), f"Unexpected file upload status code: {upload_response.status_code}"
        upload_json = upload_response.json()
        # Validate expected keys in response related to uploaded file info or document ID
        assert any(k in upload_json for k in ("fileId", "id", "documentId")), "File upload response missing file/document ID"
    except requests.RequestException as e:
        assert False, f"File upload request failed: {e}"

    # 3. Test /api/documents/upload endpoint - POST expecting JSON response
    documents_upload_url = f"{BASE_URL}/api/documents/upload"
    # Use the previously uploaded file info if available to simulate document upload
    # If upload_json has an id for the uploaded file, include it; else, send minimal data
    document_upload_payload = {
        "documentType": "PAGO",
        "aiProviders": ["OpenAI_GPT", "GLM-4.5"],
        "filename": "testfile.txt",
        "metadata": {"source": "unittest"},
    }
    # If a fileId or documentId from /api/file/upload is available, include it as reference
    file_id = None
    for key in ("fileId", "id", "documentId"):
        if key in upload_json:
            file_id = upload_json[key]
            break
    if file_id:
        document_upload_payload["fileId"] = file_id

    # For this endpoint, assume it expects multipart/form-data with file and JSON fields or JSON body
    # Try JSON body first
    try:
        doc_upload_response = session.post(documents_upload_url, headers={**auth_headers, "Content-Type": "application/json"}, json=document_upload_payload, timeout=TIMEOUT)
        # If server rejects JSON, fallback to multipart upload with file and metadata
        if doc_upload_response.status_code == 415 or doc_upload_response.status_code >= 400:
            # Retry with multipart/form-data including file again and metadata as fields
            multipart_data = {
                "documentType": (None, document_upload_payload["documentType"]),
                "aiProviders": (None, json.dumps(document_upload_payload["aiProviders"])),
                "filename": (None, document_upload_payload["filename"]),
                "metadata": (None, json.dumps(document_upload_payload["metadata"])),
            }
            if file_id:
                multipart_data["fileId"] = (None, str(file_id))
            # Include file content again
            multipart_files = {
                **multipart_data,
                "file": ("testfile.txt", file_content, "text/plain"),
            }
            doc_upload_response = session.post(documents_upload_url, headers=auth_headers, files=multipart_files, timeout=TIMEOUT)

        assert doc_upload_response.headers.get("Content-Type", "").startswith("application/json"), "Documents upload response not JSON"
        assert doc_upload_response.status_code in (200, 201), f"Unexpected documents upload status code: {doc_upload_response.status_code}"
        doc_upload_json = doc_upload_response.json()

        # Validate AI analysis results in the response if available
        # Check presence of keys indicating AI providers results or document validation status
        assert "analysisResults" in doc_upload_json or "validationStatus" in doc_upload_json or "categories" in doc_upload_json, \
            "Documents upload response missing AI analysis or validation results"

    except requests.RequestException as e:
        assert False, f"Documents upload request failed: {e}"

test_ai_multi_provider_document_analysis_and_validation()