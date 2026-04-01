"""AI Agent for DataMapr — Azure OpenAI powered deep analysis.

Sends source data + static analysis to GPT-4.1 for connector discovery,
integration strategy, risk heuristics, and timeline/cost reasoning.
Falls back to mini model, then returns None if both fail.
"""

import json
import os
import logging

from openai import AzureOpenAI

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an expert data integration architect and consultant. You are part of DataMapr, a tool that scores the complexity of integrating multiple data sources.

You will receive:
1. A list of data sources with their attributes (type, schema complexity, data quality, access difficulty, connector availability, volume, auth type, rate limits, API reliability, null percentage, schema drift frequency, and validation coverage).
2. A static analysis with per-source scores, overall complexity score, risk level, and effort estimation.

Your job is to provide deep, actionable analysis that goes beyond the static scoring. Reason carefully about real-world integration challenges.

Return a JSON object with EXACTLY this structure:
{
  "connector_discovery": [
    {
      "source": "<source name>",
      "suggested_connector": "<e.g. official REST API, JDBC driver, ODBC, Fivetran connector, custom ETL>",
      "integration_method": "<e.g. real-time streaming, batch ETL, CDC, webhook>",
      "complexity_notes": "<specific challenges for this source>"
    }
  ],
  "integration_strategy": {
    "approach": "<overall recommended approach — e.g. phased rollout, big bang, strangler fig>",
    "rationale": "<why this approach>",
    "phases": [
      {
        "name": "<phase name>",
        "sources": ["<source names in this phase>"],
        "duration_weeks": <int>,
        "rationale": "<why these sources in this phase>"
      }
    ]
  },
  "risk_heuristics": [
    {
      "risk": "<description of a specific risk>",
      "severity": "<low|medium|high|critical>",
      "affected_sources": ["<source names>"],
      "mitigation": "<recommended mitigation strategy>"
    }
  ],
  "ai_timeline": {
    "total_weeks": <int>,
    "team_composition": "<e.g. 2 data engineers, 1 architect, 1 QA>",
    "assumptions": "<key assumptions behind the estimate>"
  },
  "ai_cost_estimate": {
    "low_usd": <int>,
    "high_usd": <int>,
    "assumptions": "<key cost assumptions>"
  },
  "executive_summary": "<2-3 sentence summary of the overall integration landscape and key recommendation>"
}

Be specific to the actual sources provided. Reference them by name. Do not use generic advice.
If a source name suggests a known system (e.g. 'Salesforce', 'SAP', 'MongoDB'), leverage your knowledge of that system's real integration characteristics."""


def _build_user_prompt(sources: list[dict], static_analysis: dict) -> str:
    """Build the user message containing source data and static results."""
    source_summary = []
    for s in sources:
        source_summary.append({
            "name": s["name"],
            "type": s["type"],
            "schema_complexity": s["schema_complexity"],
            "data_quality": s["data_quality"],
            "access": s["access"],
            "connector": s["connector"],
            "volume": s["volume"],
            "auth_type": s.get("auth_type", "None"),
            "rate_limits": s.get("rate_limits", "Generous"),
            "api_reliability": s.get("api_reliability", "Unknown"),
            "null_percentage": s.get("null_percentage", "0-5%"),
            "schema_drift": s.get("schema_drift", "Stable"),
            "validation_coverage": s.get("validation_coverage", "Full"),
        })

    return json.dumps({
        "sources": source_summary,
        "static_analysis": {
            "total_score": static_analysis.get("total_score"),
            "risk_level": static_analysis.get("risk_level"),
            "source_scores": static_analysis.get("source_scores"),
            "estimation": static_analysis.get("estimation"),
        }
    }, indent=2)


def _get_client():
    """Create an Azure OpenAI client from environment variables."""
    endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT")
    api_key = os.environ.get("AZURE_OPENAI_API_KEY")

    if not endpoint or not api_key:
        logger.warning("Azure OpenAI credentials not configured.")
        return None

    return AzureOpenAI(
        azure_endpoint=endpoint,
        api_key=api_key,
        api_version=os.environ.get("AZURE_OPENAI_API_VERSION", "2024-12-01-preview"),
    )


def _call_model(client: AzureOpenAI, deployment: str, messages: list[dict]) -> dict | None:
    """Call a specific Azure OpenAI deployment and parse the JSON response."""
    try:
        response = client.chat.completions.create(
            model=deployment,
            messages=messages,
            response_format={"type": "json_object"},
            temperature=0.3,
            max_tokens=4000,
            timeout=45,
        )
        content = response.choices[0].message.content
        return json.loads(content)
    except json.JSONDecodeError:
        logger.error("AI returned invalid JSON from deployment %s", deployment)
        return None
    except Exception as e:
        logger.error("AI call failed for deployment %s: %s", deployment, e)
        return None


def run_ai_analysis(sources: list[dict], static_analysis: dict) -> dict | None:
    """Run AI-powered deep analysis. Returns structured dict or None on failure.

    Tries the primary GPT-4.1 deployment first, falls back to mini.
    """
    client = _get_client()
    if client is None:
        return None

    primary = os.environ.get("AZURE_OPENAI_DEPLOYMENT_4_1", "gpt-4.1")
    fallback = os.environ.get("AZURE_OPENAI_DEPLOYMENT_4_1_MINI", "gpt-4.1-mini")

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": _build_user_prompt(sources, static_analysis)},
    ]

    # Try primary model
    result = _call_model(client, primary, messages)
    if result is not None:
        return result

    # Fallback to mini
    logger.info("Primary model failed, falling back to %s", fallback)
    result = _call_model(client, fallback, messages)
    return result
