"""Scoring engine for DataMapr — linear baseline, non-linear compound scoring,
and time/cost estimation."""

import math

# ── Linear baseline ─────────────────────────────────────────────────────────

WEIGHTS = {
    "type": 0.20,
    "schema_complexity": 0.20,
    "data_quality": 0.20,
    "access": 0.15,
    "connector": 0.15,
    "volume": 0.10,
}

SCORE_MAPS = {
    "type": {"File": 2, "Database": 4, "SaaS API": 6, "Legacy": 9},
    "schema_complexity": {"Simple": 2, "Medium": 5, "Complex": 9},
    "data_quality": {"High": 1, "Medium": 5, "Low": 9},
    "access": {"Easy": 1, "Medium": 5, "Hard": 9},
    "connector": {"Native": 1, "Custom": 5, "None": 9},
    "volume": {"Small": 2, "Medium": 5, "Large": 8},
}

# ── Extended signal maps (new fields) ───────────────────────────────────────

EXTENDED_SCORE_MAPS = {
    "auth_type": {"None": 1, "API Key": 3, "OAuth": 6, "Custom": 9},
    "rate_limits": {"Unlimited": 1, "Generous": 3, "Moderate": 6, "Strict": 9},
    "api_reliability": {"99.9%": 1, "99%": 3, "95%": 6, "Unknown": 8},
    "null_percentage": {"0-5%": 1, "5-20%": 5, "20%+": 9},
    "schema_drift": {"Stable": 1, "Occasional": 5, "Frequent": 9},
    "validation_coverage": {"Full": 1, "Partial": 5, "None": 9},
}

# ── Compound risk multiplier rules ──────────────────────────────────────────

COMPOUND_RULES = [
    {
        "name": "Legacy + No Connector",
        "condition": lambda s: s.get("type") == "Legacy" and s.get("connector") == "None",
        "multiplier": 1.4,
    },
    {
        "name": "Low Quality + Frequent Drift",
        "condition": lambda s: s.get("data_quality") == "Low" and s.get("schema_drift") == "Frequent",
        "multiplier": 1.3,
    },
    {
        "name": "Strict Rate Limits + Custom Auth",
        "condition": lambda s: s.get("rate_limits") == "Strict" and s.get("auth_type") == "Custom",
        "multiplier": 1.2,
    },
    {
        "name": "Hard Access + Unknown Reliability",
        "condition": lambda s: s.get("access") == "Hard" and s.get("api_reliability") in ("95%", "Unknown"),
        "multiplier": 1.2,
    },
    {
        "name": "No Validation + High Nulls",
        "condition": lambda s: s.get("validation_coverage") == "None" and s.get("null_percentage") == "20%+",
        "multiplier": 1.25,
    },
    {
        "name": "Complex Schema + Legacy",
        "condition": lambda s: s.get("schema_complexity") == "Complex" and s.get("type") == "Legacy",
        "multiplier": 1.15,
    },
]


# ── Core scoring functions ──────────────────────────────────────────────────

def score_source_linear(source: dict) -> float:
    """Compute a weighted linear complexity score for a single source (0-10)."""
    total = 0.0
    for attr, weight in WEIGHTS.items():
        value = source.get(attr, "")
        total += SCORE_MAPS.get(attr, {}).get(value, 5) * weight
    return round(total, 2)


def _extended_signal_score(source: dict) -> float:
    """Average complexity score across the six enhanced signal fields (0-10)."""
    scores = []
    for attr, score_map in EXTENDED_SCORE_MAPS.items():
        value = source.get(attr, "")
        scores.append(score_map.get(value, 5))
    return sum(scores) / len(scores) if scores else 5.0


def _apply_compound_rules(source: dict) -> tuple[float, list[str]]:
    """Apply compound risk multipliers. Returns (multiplier, list of triggered rule names)."""
    combined = 1.0
    triggered = []
    for rule in COMPOUND_RULES:
        if rule["condition"](source):
            combined *= rule["multiplier"]
            triggered.append(rule["name"])
    return combined, triggered


def _diminishing_volume(source: dict) -> float:
    """Apply logarithmic diminishing returns to volume score."""
    raw = SCORE_MAPS["volume"].get(source.get("volume", "Medium"), 5)
    # log2(x+1) / log2(11) maps 0-10 → 0-1, then scale back to 0-10
    return (math.log2(raw + 1) / math.log2(11)) * 10


def score_source_nonlinear(source: dict) -> dict:
    """Full non-linear scoring for a single source.

    Returns a dict with linear_score, nonlinear_score, normalized_score,
    risk_level, compound_factors, and extended_signal_score.
    """
    linear = score_source_linear(source)
    extended = _extended_signal_score(source)
    compound_mult, compound_factors = _apply_compound_rules(source)
    dim_volume = _diminishing_volume(source)

    # Count how many extended signal fields score above 6 (high-risk threshold)
    high_signal_count = sum(
        1 for attr, smap in EXTENDED_SCORE_MAPS.items()
        if smap.get(source.get(attr, ""), 5) > 6
    )
    systemic_penalty = 0.5 if high_signal_count >= 3 else 0.0

    # Replace the linear volume contribution with diminishing-returns version
    volume_weight = WEIGHTS["volume"]
    linear_volume = SCORE_MAPS["volume"].get(source.get("volume", "Medium"), 5) * volume_weight
    adjusted_linear = linear - linear_volume + (dim_volume * volume_weight)

    # Blend: 55% adjusted linear + 30% extended signals + 15% compound adjustments
    blended = (0.55 * adjusted_linear) + (0.30 * extended) + (0.15 * (adjusted_linear * (compound_mult - 1) * 10))
    blended += systemic_penalty

    # Apply compound multiplier to the blend
    nonlinear = min(blended * (1 + (compound_mult - 1) * 0.5), 10.0)
    nonlinear = max(nonlinear, 0.0)
    nonlinear = round(nonlinear, 2)

    normalized = normalize_score(nonlinear)
    risk = assign_risk_level(normalized)

    return {
        "linear_score": linear,
        "nonlinear_score": nonlinear,
        "normalized_score": normalized,
        "risk_level": risk,
        "extended_signal_score": round(extended, 2),
        "compound_factors": compound_factors,
    }


def normalize_score(raw_score: float, max_raw: float = 10.0) -> float:
    """Normalize a raw score to 0-100 scale."""
    return round((raw_score / max_raw) * 100, 1)


def assign_risk_level(normalized_score: float) -> str:
    """Assign a risk level based on the normalized score."""
    if normalized_score <= 35:
        return "Low"
    elif normalized_score <= 65:
        return "Medium"
    else:
        return "High"


# ── Insights engine ─────────────────────────────────────────────────────────

def generate_insights(sources: list[dict]) -> list[dict]:
    """Generate actionable insights from the list of sources."""
    insights = []
    for src in sources:
        name = src["name"]

        # Original insight rules
        if src.get("connector") == "None":
            insights.append({
                "source": name, "type": "warning",
                "message": f'"{name}" has no native connector — custom integration required.',
            })
        if src.get("data_quality") == "Low":
            insights.append({
                "source": name, "type": "warning",
                "message": f'"{name}" has low data quality — data cleansing and validation needed.',
            })
        if src.get("type") == "Legacy":
            insights.append({
                "source": name, "type": "critical",
                "message": f'"{name}" is a legacy system — expect higher integration effort and risk.',
            })

        # Extended signal insights
        if src.get("rate_limits") == "Strict":
            insights.append({
                "source": name, "type": "warning",
                "message": f'"{name}" has strict rate limits — throttling and batching strategy required.',
            })
        if src.get("schema_drift") == "Frequent":
            insights.append({
                "source": name, "type": "warning",
                "message": f'"{name}" has frequent schema drift — schema versioning and monitoring recommended.',
            })
        if src.get("validation_coverage") == "None":
            insights.append({
                "source": name, "type": "warning",
                "message": f'"{name}" has no validation coverage — data integrity at risk.',
            })
        if src.get("null_percentage") == "20%+":
            insights.append({
                "source": name, "type": "warning",
                "message": f'"{name}" has >20% null values — significant data imputation may be needed.',
            })
        if src.get("auth_type") == "Custom":
            insights.append({
                "source": name, "type": "warning",
                "message": f'"{name}" uses custom authentication — additional security review and engineering effort.',
            })
        if src.get("api_reliability") in ("95%", "Unknown"):
            insights.append({
                "source": name, "type": "warning",
                "message": f'"{name}" has low or unknown API reliability — build retry logic and circuit breakers.',
            })
    return insights


# ── Time and cost estimation ────────────────────────────────────────────────

# Industry benchmarks (2024-2025 US market):
# - Low: simple SaaS APIs / well-documented DBs with native connectors → 4-6 weeks per source
# - Medium: moderate schema complexity, custom auth, some drift → 8-12 weeks per source
# - High: legacy systems, no connector, frequent drift, poor quality → 16-24 weeks per source
# Rates: $3,500–$4,500/wk for a mid-senior data engineer (W2 fully-loaded);
#         up to $7,000–$8,000/wk for specialist contractors. Range below covers W2 to contractor.
# Source: Salary.com, Flexiple, SmartData Collective ETL estimation benchmarks (2024-2025).
BASE_WEEKS = {"Low": 5.0, "Medium": 10.0, "High": 20.0}
WEEKLY_RATE_LOW = 3500   # USD per engineer per week — mid-senior W2 fully-loaded
WEEKLY_RATE_HIGH = 7500  # USD per engineer per week — specialist contractor rate


def estimate_effort(sources: list[dict], source_scores: list[dict]) -> dict:
    """Estimate timeline, team size, and cost based on scored sources.

    Uses non-linear compound effects: multiple high-risk sources amplify
    each other, and volatile sources add schedule buffer.
    """
    if not source_scores:
        return {
            "estimated_weeks": 0,
            "engineer_count": 0,
            "cost_range": {"low": 0, "high": 0},
            "volatility_factor": 1.0,
            "compound_multiplier": 1.0,
            "breakdown": [],
        }

    total_weeks = 0.0
    high_risk_count = 0
    breakdown = []

    for ss in source_scores:
        risk = ss["risk_level"]
        base = BASE_WEEKS.get(risk, 2.5)
        total_weeks += base
        if risk == "High":
            high_risk_count += 1
        breakdown.append({"source": ss["name"], "weeks": base, "risk": risk})

    # Volatility factor: sources with frequent drift or low reliability add buffer
    volatile_count = sum(
        1 for s in sources
        if s.get("schema_drift") == "Frequent"
        or s.get("api_reliability") in ("95%", "Unknown")
    )
    volatility_factor = 1 + 0.15 * volatile_count

    # Compound effect: multiple high-risk sources amplify total effort non-linearly
    compound_multiplier = 1.0
    if high_risk_count > 2:
        compound_multiplier = 1 + 0.1 * (high_risk_count - 2)

    total_weeks *= volatility_factor * compound_multiplier
    total_weeks = round(total_weeks, 1)

    # 1 engineer handles ~10 source-weeks concurrently (industry norm for data integration teams)
    engineer_count = max(1, math.ceil(total_weeks / 10))

    cost_low = round(total_weeks * WEEKLY_RATE_LOW)
    cost_high = round(total_weeks * WEEKLY_RATE_HIGH)

    return {
        "estimated_weeks": total_weeks,
        "engineer_count": engineer_count,
        "cost_range": {"low": cost_low, "high": cost_high},
        "volatility_factor": round(volatility_factor, 2),
        "compound_multiplier": round(compound_multiplier, 2),
        "breakdown": breakdown,
    }


# ── Main analysis entry point ───────────────────────────────────────────────

def analyze(sources: list[dict]) -> dict:
    """Run full analysis on a list of sources — non-linear scoring,
    insights, and effort estimation."""
    if not sources:
        return {
            "total_score": 0,
            "risk_level": "Low",
            "source_scores": [],
            "insights": [],
            "estimation": estimate_effort([], []),
        }

    source_scores = []
    raw_total = 0.0

    for src in sources:
        result = score_source_nonlinear(src)
        source_scores.append({
            "id": src.get("id"),
            "name": src["name"],
            **result,
        })
        raw_total += result["nonlinear_score"]

    avg_raw = raw_total / len(sources)
    total_normalized = normalize_score(avg_raw)
    total_risk = assign_risk_level(total_normalized)

    insights = generate_insights(sources)
    estimation = estimate_effort(sources, source_scores)

    return {
        "total_score": total_normalized,
        "risk_level": total_risk,
        "source_scores": source_scores,
        "insights": insights,
        "estimation": estimation,
    }
