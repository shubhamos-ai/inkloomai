import os
import urllib.request
import json
import base64
from dotenv import load_dotenv
from PIL import Image, ImageDraw
import io

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
api_key = os.getenv("NVIDIA_API_KEY")

img = Image.new("RGB", (400, 200), color=(255, 255, 255))
d = ImageDraw.Draw(img)
d.text((20, 30), "ICE CREAM BRAND", fill=(0, 0, 0))
d.text((20, 70), "Mega-Tub Sale 75% OFF!", fill=(229, 9, 20))
d.text((20, 120), "Family tubs today only!", fill=(50, 50, 50))

buf = io.BytesIO()
img.save(buf, format="PNG")
b64_ad = base64.b64encode(buf.getvalue()).decode("ascii")

system_prompt = (
    "You are an expert AI Advertising Compliance & Brand Governance Inspector. "
    "You analyze advertising images thoroughly and evaluate them against company brand rules.\n\n"
    "Respond in STRICT JSON format with keys:\n"
    "- extracted_text (string)\n"
    "- detected_company_name (string or null)\n"
    "- detected_offers (list of strings)\n"
    "- detected_discounts (list of strings)\n"
    "- detected_pricing (list of strings)\n"
    "- branding_elements (list of strings)\n"
    "- spelling_grammar_issues (list of strings)\n"
    "- missing_required_info (list of strings)\n"
    "- inconsistencies (list of strings)\n"
    "- rule_evaluations: list of objects with [rule_id, rule_text, status (PASS|FAIL|UNCERTAIN), explanation, evidence, severity (CRITICAL|MAJOR|MINOR|INFO)]\n"
    "- final_decision: APPROVED | REJECTED | NEEDS REVIEW\n"
    "- compliance_score: integer from 0 to 100\n"
    "- summary: string\n"
    "- recommendations: list of strings\n"
    "Return JSON ONLY."
)

rules = [
    {"rule_id": "BR001", "rule": "Maximum promotional discount cannot exceed 50%", "severity": "CRITICAL"},
    {"rule_id": "BR002", "rule": "Must include dairy allergen disclaimer", "severity": "CRITICAL"}
]

user_prompt = (
    f"COMPANY: Ice Cream Brand\n"
    f"GOVERNING RULES:\n{json.dumps(rules, indent=2)}\n\n"
    "Inspect the provided advertisement image carefully and produce the complete verification assessment JSON."
)

payload = {
    "model": "nvidia/nemotron-3.5-super-vl-120b-a12b",
    "messages": [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": [
                {"type": "text", "text": user_prompt},
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64_ad}"}}
            ]
        }
    ],
    "max_tokens": 1200,
    "temperature": 0.1
}

req = urllib.request.Request(
    "https://integrate.api.nvidia.com/v1/chat/completions",
    headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json"
    },
    data=json.dumps(payload).encode("utf-8")
)

with urllib.request.urlopen(req, timeout=60) as resp:
    res = json.loads(resp.read().decode("utf-8"))
    msg = res["choices"][0]["message"]
    content = msg.get("content") or ""
    print("--- RAW CONTENT FROM MODEL ---")
    print(content)
