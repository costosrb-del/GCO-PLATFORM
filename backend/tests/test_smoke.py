import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_read_main():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "GCO Platform V2 API is running", "status": "online"}

def test_inventory_unauthorized():
    response = client.get("/inventory/")
    # Should fail without token
    assert response.status_code in [401, 403]
