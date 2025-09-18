import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

# Replace these with valid credentials for an authorized user with permission to delete documents
USERNAME = "testuser"
PASSWORD = "testpassword"
TENANT = "testtenant"

def authenticate():
    url = f"{BASE_URL}/api/auth/login"
    payload = {
        "username": USERNAME,
        "password": PASSWORD,
        "tenant": TENANT
    }
    headers = {
        "Content-Type": "application/json"
    }
    response = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
    response.raise_for_status()
    if not response.content:
        assert False, "Empty response received from login endpoint"
    try:
        data = response.json()
    except ValueError:
        assert False, "Response from login endpoint is not valid JSON"
    token = data.get("token") or data.get("accessToken")
    assert token, "Authentication token not found in login response"
    return token

def upload_document(token):
    url = f"{BASE_URL}/api/documents/upload"
    headers = {
        "Authorization": f"Bearer {token}"
    }
    files = {
        'file': ('testdoc.txt', b'Test document content for deletion test', 'text/plain')
    }
    response = requests.post(url, headers=headers, files=files, timeout=TIMEOUT)
    response.raise_for_status()
    try:
        data = response.json()
    except ValueError:
        assert False, "Response from document upload endpoint is not valid JSON"
    document_id = data.get("id") or data.get("documentId")
    assert document_id, "Document ID not found in upload response"
    return document_id

def delete_document(token, document_id):
    url = f"{BASE_URL}/api/documents/{document_id}"
    headers = {
        "Authorization": f"Bearer {token}"
    }
    response = requests.delete(url, headers=headers, timeout=TIMEOUT)
    return response

def get_document(token, document_id):
    url = f"{BASE_URL}/api/documents"
    headers = {
        "Authorization": f"Bearer {token}"
    }
    params = {
        "id": document_id
    }
    response = requests.get(url, headers=headers, params=params, timeout=TIMEOUT)
    return response

def test_delete_document_by_id():
    token = authenticate()
    document_id = None
    try:
        document_id = upload_document(token)
        del_response = delete_document(token, document_id)
        assert del_response.status_code == 200 or del_response.status_code == 204, f"Unexpected status code on delete: {del_response.status_code}"
        get_response = get_document(token, document_id)
        if get_response.status_code == 200:
            try:
                documents = get_response.json()
            except ValueError:
                assert False, "Response from get document endpoint is not valid JSON"
            assert isinstance(documents, list), "Get document endpoint should return a list"
            assert not any(doc.get("id") == document_id for doc in documents), "Document still exists after deletion"
        else:
            assert get_response.status_code == 404 or get_response.status_code == 200, f"Unexpected status code when verifying deletion: {get_response.status_code}"
    finally:
        if document_id:
            delete_document(token, document_id)

test_delete_document_by_id()
