"""Flask API for DataMapr."""

import os
from dotenv import load_dotenv
from flask import Flask, request, jsonify
from flask_cors import CORS

# Load .env from project root (one level up from backend/)
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

from models import (
    init_db, add_source, get_all_sources, get_source,
    update_source, delete_source, delete_all_sources,
    VALID_TYPES, VALID_SCHEMA_COMPLEXITY, VALID_DATA_QUALITY,
    VALID_ACCESS, VALID_CONNECTOR, VALID_VOLUME,
    VALID_AUTH_TYPE, VALID_RATE_LIMITS, VALID_API_RELIABILITY,
    VALID_NULL_PERCENTAGE, VALID_SCHEMA_DRIFT, VALID_VALIDATION_COVERAGE,
)
from scoring import analyze
from ai_agent import run_ai_analysis

app = Flask(__name__)
CORS(app)

# Required fields (original) — must always be present
REQUIRED_VALIDATORS = {
    "type": VALID_TYPES,
    "schema_complexity": VALID_SCHEMA_COMPLEXITY,
    "data_quality": VALID_DATA_QUALITY,
    "access": VALID_ACCESS,
    "connector": VALID_CONNECTOR,
    "volume": VALID_VOLUME,
}

# Optional fields (enhanced signals) — validated only if present
OPTIONAL_VALIDATORS = {
    "auth_type": VALID_AUTH_TYPE,
    "rate_limits": VALID_RATE_LIMITS,
    "api_reliability": VALID_API_RELIABILITY,
    "null_percentage": VALID_NULL_PERCENTAGE,
    "schema_drift": VALID_SCHEMA_DRIFT,
    "validation_coverage": VALID_VALIDATION_COVERAGE,
}


def validate_source_data(data: dict) -> list[str]:
    errors = []
    if not data.get("name", "").strip():
        errors.append("name is required.")
    for field, valid_values in REQUIRED_VALIDATORS.items():
        val = data.get(field)
        if val not in valid_values:
            errors.append(f"{field} must be one of: {', '.join(valid_values)}")
    for field, valid_values in OPTIONAL_VALIDATORS.items():
        val = data.get(field)
        if val is not None and val not in valid_values:
            errors.append(f"{field} must be one of: {', '.join(valid_values)}")
    return errors


@app.route("/api/sources", methods=["GET"])
def list_sources():
    return jsonify(get_all_sources())


@app.route("/api/sources", methods=["POST"])
def create_source():
    data = request.get_json()
    errors = validate_source_data(data)
    if errors:
        return jsonify({"errors": errors}), 400

    source_id = add_source(
        name=data["name"].strip(),
        type_=data["type"],
        schema_complexity=data["schema_complexity"],
        data_quality=data["data_quality"],
        access=data["access"],
        connector=data["connector"],
        volume=data["volume"],
        auth_type=data.get("auth_type", "None"),
        rate_limits=data.get("rate_limits", "Generous"),
        api_reliability=data.get("api_reliability", "Unknown"),
        null_percentage=data.get("null_percentage", "0-5%"),
        schema_drift=data.get("schema_drift", "Stable"),
        validation_coverage=data.get("validation_coverage", "Full"),
    )
    return jsonify({"id": source_id}), 201


@app.route("/api/sources/<int:source_id>", methods=["PUT"])
def edit_source(source_id):
    if not get_source(source_id):
        return jsonify({"error": "Source not found"}), 404

    data = request.get_json()
    errors = validate_source_data(data)
    if errors:
        return jsonify({"errors": errors}), 400

    update_source(
        source_id,
        name=data["name"].strip(),
        type=data["type"],
        schema_complexity=data["schema_complexity"],
        data_quality=data["data_quality"],
        access=data["access"],
        connector=data["connector"],
        volume=data["volume"],
        auth_type=data.get("auth_type", "None"),
        rate_limits=data.get("rate_limits", "Generous"),
        api_reliability=data.get("api_reliability", "Unknown"),
        null_percentage=data.get("null_percentage", "0-5%"),
        schema_drift=data.get("schema_drift", "Stable"),
        validation_coverage=data.get("validation_coverage", "Full"),
    )
    return jsonify({"ok": True})


@app.route("/api/sources/<int:source_id>", methods=["DELETE"])
def remove_source(source_id):
    if not get_source(source_id):
        return jsonify({"error": "Source not found"}), 404
    delete_source(source_id)
    return jsonify({"ok": True})


@app.route("/api/sources", methods=["DELETE"])
def clear_sources():
    delete_all_sources()
    return jsonify({"ok": True})


@app.route("/api/analyze", methods=["GET", "POST"])
def run_analysis():
    sources = get_all_sources()
    result = analyze(sources)

    # Deep AI analysis if POST with mode=deep
    deep = False
    if request.method == "POST":
        body = request.get_json(silent=True) or {}
        deep = body.get("mode") == "deep"

    if deep:
        ai_result = run_ai_analysis(sources, result)
        if ai_result:
            result["ai_insights"] = ai_result
        else:
            result["ai_insights"] = None
            result["ai_error"] = "AI analysis unavailable. Showing static analysis only."

    return jsonify(result)


@app.route("/api/options", methods=["GET"])
def get_options():
    return jsonify({
        "types": VALID_TYPES,
        "schema_complexity": VALID_SCHEMA_COMPLEXITY,
        "data_quality": VALID_DATA_QUALITY,
        "access": VALID_ACCESS,
        "connector": VALID_CONNECTOR,
        "volume": VALID_VOLUME,
        "auth_type": VALID_AUTH_TYPE,
        "rate_limits": VALID_RATE_LIMITS,
        "api_reliability": VALID_API_RELIABILITY,
        "null_percentage": VALID_NULL_PERCENTAGE,
        "schema_drift": VALID_SCHEMA_DRIFT,
        "validation_coverage": VALID_VALIDATION_COVERAGE,
    })


if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=5000)
