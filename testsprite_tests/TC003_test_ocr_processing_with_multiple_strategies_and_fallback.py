import requests
import os

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

def test_ocr_processing_with_multiple_strategies_and_fallback():
    # Step 1: Authenticate (assuming /api/login requires username and password to get token)
    login_url = f"{BASE_URL}/api/login"
    login_payload = {
        "username": "clientuser",
        "password": "clientpassword"
    }
    headers = {
        "Accept": "application/json"
    }
    try:
        login_resp = requests.post(login_url, json=login_payload, headers=headers, timeout=TIMEOUT)
        assert login_resp.headers.get("Content-Type") and "application/json" in login_resp.headers.get("Content-Type"), \
            f"/api/login did not return JSON content type, got: {login_resp.headers.get('Content-Type')}"
        login_resp.raise_for_status()
        login_json = login_resp.json()
        assert "token" in login_json, "Login response JSON does not contain token"
        token = login_json["token"]
    except requests.RequestException as e:
        raise AssertionError(f"Login request failed: {e}")

    auth_headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json"
    }

    # Step 2: Prepare a sample document file to upload for OCR processing
    # We simulate multi-format by using a PDF file. We'll create a small dummy PDF file on the fly.
    # For this test, create a minimal PDF content binary in-memory
    pdf_content = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\nstartxref\n0\n%%EOF"

    files = {
        "file": ("sample.pdf", pdf_content, "application/pdf")
    }

    # Test upload to /api/file/upload first
    upload_file_url = f"{BASE_URL}/api/file/upload"
    try:
        upload_resp = requests.post(upload_file_url, headers=auth_headers, files=files, timeout=TIMEOUT)
        assert upload_resp.headers.get("Content-Type") and "application/json" in upload_resp.headers.get("Content-Type"), \
            f"/api/file/upload did not return JSON content type, got: {upload_resp.headers.get('Content-Type')}"
        upload_resp.raise_for_status()
        upload_json = upload_resp.json()
        # Expect uploaded file data including an ID or filename reference for OCR processing
        assert "fileId" in upload_json or "filename" in upload_json, "Upload response missing file identifier"
        file_identifier = upload_json.get("fileId") or upload_json.get("filename")
    except requests.RequestException as e:
        raise AssertionError(f"File upload failed: {e}")

    # Step 3: Upload document via /api/documents/upload to initiate document processing including OCR
    upload_doc_url = f"{BASE_URL}/api/documents/upload"
    # The API likely expects file and possibly metadata; re-use same file
    try:
        doc_upload_resp = requests.post(upload_doc_url, headers=auth_headers, files=files, timeout=TIMEOUT)
        assert doc_upload_resp.headers.get("Content-Type") and "application/json" in doc_upload_resp.headers.get("Content-Type"), \
            f"/api/documents/upload did not return JSON content type, got: {doc_upload_resp.headers.get('Content-Type')}"
        doc_upload_resp.raise_for_status()
        doc_upload_json = doc_upload_resp.json()
        # The response should include OCR processing results or document id for retrieval
        assert "documentId" in doc_upload_json or "ocrResult" in doc_upload_json, \
            "Document upload response missing documentId or ocrResult"
        document_id = doc_upload_json.get("documentId")
        ocr_result = doc_upload_json.get("ocrResult")
    except requests.RequestException as e:
        raise AssertionError(f"Document upload failed: {e}")

    # Step 4: If the response does not contain OCR result, poll or request OCR result separately (not provided explicitly in PRD)
    # We'll do a GET /api/documents/{id}/ocr if documentId available to verify OCR processing and fallback
    if document_id:
        ocr_status_url = f"{BASE_URL}/api/documents/{document_id}/ocr"
        try:
            ocr_status_resp = requests.get(ocr_status_url, headers=auth_headers, timeout=TIMEOUT)
            assert ocr_status_resp.headers.get("Content-Type") and "application/json" in ocr_status_resp.headers.get("Content-Type"), \
                f"GET {ocr_status_url} did not return JSON content type, got: {ocr_status_resp.headers.get('Content-Type')}"
            ocr_status_resp.raise_for_status()
            ocr_status_json = ocr_status_resp.json()
            # Validate presence of OCR text, confidence scores, and fallback indicator
            assert "extractedText" in ocr_status_json, "OCR result missing extractedText"
            assert "strategiesUsed" in ocr_status_json, "OCR result missing strategiesUsed"
            assert isinstance(ocr_status_json["strategiesUsed"], list) and len(ocr_status_json["strategiesUsed"]) > 0, \
                "OCR strategiesUsed should be a non-empty list"
            # Check confidence scores keys present
            assert "confidenceScores" in ocr_status_json and isinstance(ocr_status_json["confidenceScores"], dict), \
                "OCR confidenceScores missing or not a dict"
            # Validate fallback mechanism flag present (boolean)
            assert "fallbackUsed" in ocr_status_json and isinstance(ocr_status_json["fallbackUsed"], bool), \
                "OCR fallbackUsed flag missing or not boolean"
        except requests.RequestException as e:
            raise AssertionError(f"OCR status request failed: {e}")
    else:
        # If OCR result was returned in document upload response, we validate it locally
        assert isinstance(ocr_result, dict), "ocrResult should be a dictionary"
        assert "extractedText" in ocr_result, "OCR result missing extractedText"
        assert "strategiesUsed" in ocr_result and isinstance(ocr_result["strategiesUsed"], list) and len(ocr_result["strategiesUsed"]) > 0, \
            "OCR strategiesUsed should be a non-empty list in ocrResult"
        assert "confidenceScores" in ocr_result and isinstance(ocr_result["confidenceScores"], dict), \
            "OCR confidenceScores missing or not a dict in ocrResult"
        assert "fallbackUsed" in ocr_result and isinstance(ocr_result["fallbackUsed"], bool), \
            "OCR fallbackUsed flag missing or not boolean in ocrResult"

# Execute the test function
test_ocr_processing_with_multiple_strategies_and_fallback()