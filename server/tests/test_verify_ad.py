"""Test suite for Ad Compliance Verification Pipeline (/api/verify-ad and /api/v1/verify-ad)."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_ice_cream_brand_pass(client: TestClient):
    """Test Ad 1 (Pass): 40% off summer scoops with dairy disclosure -> COMPLIANT."""
    payload = {
        "company_name": "Ice Cream Brand",
        "rules": [
            "Maximum promotional discount cannot exceed 50%; must include dairy allergen disclaimer."
        ],
        "ad_headline": "Summer Scoops",
        "ad_copy": "Enjoy 40% off our handcrafted scoops! Contains dairy allergen information.",
    }

    # Test both /api/verify-ad and /api/v1/verify-ad
    for endpoint in ("/api/verify-ad", "/api/v1/verify-ad"):
        response = client.post(endpoint, json=payload)
        assert response.status_code == 200, f"Failed on endpoint {endpoint}: {response.text}"
        data = response.json()
        assert data["status"] == "COMPLIANT"
        assert data["total_violations"] == 0
        assert data["violations"] == []


def test_ice_cream_brand_fail(client: TestClient):
    """Test Ad 2 (Fail): 75% off mega-tub sale with no disclaimers -> NON_COMPLIANT."""
    payload = {
        "company_name": "Ice Cream Brand",
        "rules": [
            "Maximum promotional discount cannot exceed 50%; must include dairy allergen disclaimer."
        ],
        "ad_headline": "Mega-Tub Sale",
        "ad_copy": "Get 75% OFF all family tubs today only! Limited time mega sale.",
    }

    for endpoint in ("/api/verify-ad", "/api/v1/verify-ad"):
        response = client.post(endpoint, json=payload)
        assert response.status_code == 200, f"Failed on endpoint {endpoint}: {response.text}"
        data = response.json()
        assert data["status"] == "NON_COMPLIANT"
        assert data["total_violations"] >= 1

        violation_types = [v["violation_type"] for v in data["violations"]]
        assert "NUMERIC_LIMIT_EXCEEDED" in violation_types
        assert "MISSING_MANDATORY_DISCLOSURE" in violation_types

        # Verify specific violation explanations and severities
        numeric_v = next(v for v in data["violations"] if v["violation_type"] == "NUMERIC_LIMIT_EXCEEDED")
        assert numeric_v["severity"] == "CRITICAL"
        assert "75%" in numeric_v["explanation"]
        assert "50%" in numeric_v["explanation"]

        dairy_v = next(v for v in data["violations"] if v["violation_type"] == "MISSING_MANDATORY_DISCLOSURE")
        assert dairy_v["severity"] == "CRITICAL"
        assert "dairy" in dairy_v["explanation"].lower()


def test_financial_licensing_rule(client: TestClient):
    """Test financial licensing disclosure check."""
    rules = [
        "Maximum promotional discount cannot exceed 20%",
        "Must include financial licensing disclosure.",
    ]

    # Non-compliant: 30% discount and no licensing notice
    fail_res = client.post(
        "/api/verify-ad",
        json={
            "company_name": "Apex Fintech",
            "rules": rules,
            "ad_headline": "Invest Now",
            "ad_copy": "Save 30% on trading fees with instant returns!",
        },
    )
    assert fail_res.status_code == 200
    fail_data = fail_res.json()
    assert fail_data["status"] == "NON_COMPLIANT"
    assert fail_data["total_violations"] == 2

    # Compliant: 15% discount and licensing disclosure present
    pass_res = client.post(
        "/api/verify-ad",
        json={
            "company_name": "Apex Fintech",
            "rules": rules,
            "ad_headline": "Invest Smarter",
            "ad_copy": "Enjoy 15% off trading fees. Licensed and regulated broker, member FINRA/SIPC.",
        },
    )
    assert pass_res.status_code == 200
    pass_data = pass_res.json()
    assert pass_data["status"] == "COMPLIANT"
    assert pass_data["total_violations"] == 0
