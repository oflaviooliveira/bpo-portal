import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

# Replace this variable value with a valid bearer token before running the test
auth_token = "your_valid_bearer_token_here"

def test_create_new_supplier():
    url = f"{BASE_URL}/api/fornecedores"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    }

    supplier_data = {
        "name": "Teste Fornecedor XYZ",
        "document": "12345678000199",  # CNPJ valid format example
        "email": "contato@fornecedorexample.com",
        "phone": "+5511999999999",
        "address": {
            "street": "Rua das Flores",
            "number": "123",
            "complement": "Sala 1",
            "neighborhood": "Centro",
            "city": "São Paulo",
            "state": "SP",
            "zipCode": "01001000",
            "country": "Brasil"
        }
    }

    created_supplier_id = None

    try:
        response = requests.post(url, json=supplier_data, headers=headers, timeout=TIMEOUT)
        assert response.status_code == 201, f"Expected status code 201, got {response.status_code}"
        response_json = response.json()
        created_supplier_id = response_json.get("id")
        assert created_supplier_id is not None, "Response missing created supplier ID"
        assert response_json.get("name") == supplier_data["name"], "Supplier name mismatch"
        assert "tenantId" in response_json and response_json["tenantId"], "Supplier not associated with any tenant"

    finally:
        if created_supplier_id:
            delete_url = f"{BASE_URL}/api/fornecedores/{created_supplier_id}"
            try:
                delete_response = requests.delete(delete_url, headers=headers, timeout=TIMEOUT)
                assert delete_response.status_code in (200, 204), f"Failed to delete supplier, status code: {delete_response.status_code}"
            except Exception as e:
                print(f"Cleanup failed for supplier ID {created_supplier_id}: {e}")

test_create_new_supplier()
