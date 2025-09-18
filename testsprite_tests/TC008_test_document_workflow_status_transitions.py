import requests
import io

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

def test_document_workflow_status_transitions():
    session = requests.Session()
    try:
        # Step 1: Test /api/login endpoint for JSON response format (simulate a login)
        login_payload = {
            "username": "testclientuser",
            "password": "TestPassword123!"
        }
        login_resp = session.post(
            f"{BASE_URL}/api/login",
            json=login_payload,
            timeout=TIMEOUT,
        )
        assert login_resp.status_code in (200, 201, 202), f"Login failed with status {login_resp.status_code}"
        try:
            login_json = login_resp.json()
        except Exception:
            assert False, "Login response is not JSON"
        assert isinstance(login_json, dict), "Login response JSON is not a dict"

        # Step 2: Test /api/file/upload endpoint for JSON response (upload a dummy file)
        # Construct a small dummy file in-memory for upload
        dummy_file_content = b"%PDF-1.4\n%Dummy PDF content for test\n"
        files = {
            "file": ("testdocument.pdf", io.BytesIO(dummy_file_content), "application/pdf")
        }
        upload_file_resp = session.post(
            f"{BASE_URL}/api/file/upload",
            files=files,
            timeout=TIMEOUT,
        )
        assert upload_file_resp.status_code in (200, 201), f"/api/file/upload failed with status {upload_file_resp.status_code}"
        try:
            upload_file_json = upload_file_resp.json()
        except Exception:
            assert False, "/api/file/upload response is not JSON"
        assert isinstance(upload_file_json, dict), "/api/file/upload response JSON is not a dict"
        file_upload_id = upload_file_json.get("id") or upload_file_json.get("fileId") or upload_file_json.get("file_id")
        assert file_upload_id, "Uploaded file ID missing from /api/file/upload response"

        # Step 3: Test /api/documents/upload endpoint for JSON response, uploading the file ID
        # Usually this endpoint probably expects metadata and a reference to file or actual file upload, try both:
        document_payload = {
            "fileId": file_upload_id,
            "documentType": "PAGO",  # example document type from user flow summary
            "metadata": {
                "dueDate": "2025-12-31",
                "amount": 1000.00,
                "supplier": "Test Supplier",
                "tenantId": "tenant_test_01"
            }
        }
        doc_upload_resp = session.post(
            f"{BASE_URL}/api/documents/upload",
            json=document_payload,
            timeout=TIMEOUT,
        )
        assert doc_upload_resp.status_code in (200, 201), f"/api/documents/upload failed with status {doc_upload_resp.status_code}"
        try:
            doc_upload_json = doc_upload_resp.json()
        except Exception:
            assert False, "/api/documents/upload response is not JSON"
        assert isinstance(doc_upload_json, dict), "/api/documents/upload response JSON is not a dict"
        document_id = doc_upload_json.get("id") or doc_upload_json.get("documentId") or doc_upload_json.get("document_id")
        assert document_id, "Document ID missing from /api/documents/upload response"

        # Step 4: Optionally, check the workflow status transitions by querying the document status
        # The PRD implies automated workflow status transitions based on business rules,
        # but no explicit endpoint given - however, we can try to GET the document to check status.
        get_doc_resp = session.get(
            f"{BASE_URL}/api/documents/{document_id}",
            timeout=TIMEOUT,
        )
        assert get_doc_resp.status_code == 200, f"Fetching document status failed with status {get_doc_resp.status_code}"
        try:
            get_doc_json = get_doc_resp.json()
        except Exception:
            assert False, "Document GET response is not JSON"
        assert "status" in get_doc_json, "Document status field missing in GET response"

        status = get_doc_json["status"]
        allowed_statuses = ["RECEBIDO", "VALIDANDO", "PAGO_A_CONCILIAR", "EM_CONCILIACAO", "ARQUIVADO"]
        assert status in allowed_statuses, f"Document status '{status}' not in expected workflow states"

    finally:
        # Clean up created resources if possible
        # Delete document if created
        if 'document_id' in locals():
            try:
                del_doc_resp = session.delete(
                    f"{BASE_URL}/api/documents/{document_id}",
                    timeout=TIMEOUT,
                )
                # Accept 200 or 204 as success
                assert del_doc_resp.status_code in (200, 204, 404)
            except Exception:
                pass

        # Delete uploaded file if created
        if 'file_upload_id' in locals():
            try:
                del_file_resp = session.delete(
                    f"{BASE_URL}/api/file/{file_upload_id}",
                    timeout=TIMEOUT,
                )
                assert del_file_resp.status_code in (200, 204, 404)
            except Exception:
                pass


test_document_workflow_status_transitions()