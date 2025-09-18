import requests
from requests.exceptions import RequestException
from datetime import datetime, timedelta

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

AUTH_CREDENTIALS = {
    "username": "testuser",
    "password": "testpassword"
}


def login():
    url = f"{BASE_URL}/api/auth/login"
    s = requests.Session()
    try:
        login_resp = s.post(url, json=AUTH_CREDENTIALS, timeout=TIMEOUT)
        login_resp.raise_for_status()
        try:
            data = login_resp.json()
            token = data.get("token")
            if token:
                return {"Authorization": f"Bearer {token}"}
            else:
                # No token, assume session cookie based auth
                return s
        except Exception:
            # No JSON, assume session cookie based auth
            return s
    except RequestException as e:
        raise AssertionError(f"Login failed: {e}")


def test_list_documents_with_filters():
    auth = login()

    endpoint = f"{BASE_URL}/api/documents"

    filter_tests = [
        {"params": {"status": "RECEBIDO"}, "expected_status": 200},
        {
            "params": {
                "dateFrom": (datetime.utcnow() - timedelta(days=7)).strftime("%Y-%m-%d"),
                "dateTo": datetime.utcnow().strftime("%Y-%m-%d"),
            },
            "expected_status": 200,
        },
        {"params": {"category": "invoice"}, "expected_status": 200},
        {"params": {"status": "PAGO", "category": "receipt"}, "expected_status": 200},
    ]

    session = auth if isinstance(auth, requests.Session) else None
    headers = auth if isinstance(auth, dict) else {}

    for test_filter in filter_tests:
        params = test_filter["params"]
        expected_status = test_filter["expected_status"]
        try:
            if session:
                response = session.get(endpoint, params=params, timeout=TIMEOUT)
            else:
                response = requests.get(endpoint, params=params, headers=headers, timeout=TIMEOUT)
            assert response.status_code == expected_status, f"Expected status {expected_status} but got {response.status_code} for params={params}"
            data = response.json()
            assert isinstance(data, list), f"Response data is not a list for params={params}"
            for doc in data:
                assert isinstance(doc, dict), "Document item is not a dictionary"
                if "status" in params:
                    assert "status" in doc and doc["status"] == params["status"], f"Document status mismatch: expected {params['status']}, got {doc.get('status')}"
                if "category" in params:
                    assert "category" in doc and doc["category"] == params["category"], f"Document category mismatch: expected {params['category']}, got {doc.get('category')}"
                if "dateFrom" in params or "dateTo" in params:
                    doc_date_str = doc.get("date")
                    if doc_date_str:
                        try:
                            doc_date = datetime.strptime(doc_date_str[:10], "%Y-%m-%d")
                            date_from = datetime.strptime(params.get("dateFrom", "1970-01-01"), "%Y-%m-%d")
                            date_to = datetime.strptime(params.get("dateTo", "9999-12-31"), "%Y-%m-%d")
                            assert date_from <= doc_date <= date_to, f"Document date {doc_date} outside range {date_from} to {date_to}"
                        except Exception:
                            pass

        except (RequestException, AssertionError) as e:
            raise AssertionError(f"Filter test with params {params} failed: {e}")


test_list_documents_with_filters()
