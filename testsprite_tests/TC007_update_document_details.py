import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

# Replace these with valid credentials for an authorized user with update permissions
AUTH_CREDENTIALS = {
    "username": "testuser",
    "password": "testpassword"
}

def login_and_get_token():
    login_url = f"{BASE_URL}/api/auth/login"
    headers = {"Content-Type": "application/json"}
    payload = {
        "username": AUTH_CREDENTIALS["username"],
        "password": AUTH_CREDENTIALS["password"]
    }
    response = requests.post(login_url, json=payload, headers=headers, timeout=TIMEOUT)
    response.raise_for_status()
    data = response.json()
    token = data.get("token") or data.get("accessToken")
    assert token, "Authentication token not found in login response"
    return token

def create_document(token):
    url = f"{BASE_URL}/api/documents/upload"
    headers = {
        "Authorization": f"Bearer {token}"
    }
    files = {
        "file": ("test-document.pdf", b"%PDF-1.4 test pdf content", "application/pdf")
    }
    response = requests.post(url, headers=headers, files=files, timeout=TIMEOUT)
    response.raise_for_status()
    data = response.json()
    doc_id = data.get("id") or data.get("documentId")
    assert doc_id, "Document ID not found in upload response"
    return doc_id

def delete_document(token, doc_id):
    url = f"{BASE_URL}/api/documents/{doc_id}"
    headers = {
        "Authorization": f"Bearer {token}"
    }
    response = requests.delete(url, headers=headers, timeout=TIMEOUT)
    assert response.status_code in (200, 204), f"Failed to delete document {doc_id}: {response.status_code} {response.text}"

def test_update_document_details():
    token = login_and_get_token()
    doc_id = None

    try:
        doc_id = create_document(token)

        update_url = f"{BASE_URL}/api/documents/{doc_id}"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        payload = {
            "metadata": {
                "title": "Updated Document Title",
                "description": "Updated description for testing PUT update"
            },
            "status": "VALIDANDO",
            "validationRequested": True
        }

        response = requests.put(update_url, json=payload, headers=headers, timeout=TIMEOUT)
        assert response.status_code == 200, f"Expected status 200, got {response.status_code}"

        response_data = response.json()
        assert response_data.get("id") == doc_id, "Returned document ID mismatch"
        metadata = response_data.get("metadata", {})
        assert metadata.get("title") == payload["metadata"]["title"], "Title not updated correctly"
        assert metadata.get("description") == payload["metadata"]["description"], "Description not updated correctly"
        assert response_data.get("status") == payload["status"], "Status not updated correctly"

        if "validationStatus" in response_data:
            assert response_data["validationStatus"] in ("pending", "in_progress", "completed"), "Invalid validationStatus value"

    finally:
        if doc_id:
            try:
                delete_document(token, doc_id)
            except Exception as e:
                print(f"Cleanup failed: {e}")


test_update_document_details()
