# DataMapr

**AI-Powered Data Integration Complexity Scorer**

DataMapr is a web application that helps teams assess and quantify the complexity of integrating multiple data sources into a unified system. It combines a non-linear compound scoring engine with AI-powered deep analysis (via Azure OpenAI GPT-4.1) to produce actionable integration assessments including complexity scores, risk levels, effort estimations, timeline projections, and cost ranges.

Unlike simple linear scorers, DataMapr models real-world integration dynamics: compound risk factors that amplify each other, diminishing returns on volume scaling, interaction effects between attributes, and AI reasoning that draws on knowledge of specific platforms and technologies.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Data Model](#data-model)
- [Scoring Engine](#scoring-engine)
- [AI Agent](#ai-agent)
- [Insights Engine](#insights-engine)
- [Effort Estimation](#effort-estimation)
- [Frontend UI](#frontend-ui)
- [Configuration and Customization](#configuration-and-customization)

---

## Features

- **13-attribute data source profiling** — 7 core characteristics + 6 integration signals
- **Non-linear compound scoring** — multiplicative risk factors, diminishing returns, interaction effects
- **Dual analysis modes** — Quick (static scoring) and Deep (AI-powered via Azure OpenAI)
- **AI deep analysis** — connector discovery, integration strategy with phased rollout, risk heuristics with mitigations, AI-generated timeline and cost estimates
- **Effort estimation** — algorithmic timeline, team size, and cost range with volatility and compound multipliers
- **Per-source scoring breakdown** — linear score, nonlinear score, extended signal average, and triggered compound factors
- **Actionable insights** — 9 rule-based insight triggers across all attributes
- **Full CRUD REST API** with server-side validation
- **Expandable source detail rows** — compact table with on-demand integration signal details
- **Persistent SQLite storage** with automatic schema migration for new fields
- **Graceful AI fallback** — app is fully functional without Azure OpenAI credentials

---

## Tech Stack

| Layer      | Technology                          | Purpose                          |
| ---------- | ----------------------------------- | -------------------------------- |
| Backend    | Python 3.12+, Flask 3.1, Flask-CORS | REST API, validation, routing    |
| AI         | Azure OpenAI (GPT-4.1 / GPT-4.1-mini) | Deep analysis, connector discovery, strategy |
| Scoring    | Custom Python (scoring.py)          | Non-linear compound scoring engine |
| Storage    | SQLite (via Python `sqlite3`)       | Persistent source storage        |
| Frontend   | React 18, Recharts 2.x             | Interactive dashboard            |
| Dev Tools  | react-scripts 5.0.1, python-dotenv | Build toolchain, env management  |

---

## Project Structure

```
datamapr/
├── .env                    # Azure OpenAI credentials (create manually, gitignored)
├── .gitignore
├── README.md
├── backend/
│   ├── app.py              # Flask application — routes, validation, dotenv loading
│   ├── models.py           # SQLite schema, migration logic, CRUD operations
│   ├── scoring.py          # Non-linear scoring engine, insights, effort estimation
│   ├── ai_agent.py         # Azure OpenAI integration — deep analysis agent
│   ├── requirements.txt    # Python dependencies
│   └── datamapr.db         # SQLite database (auto-created at runtime, gitignored)
├── frontend/
│   ├── public/
│   │   └── index.html      # HTML shell
│   ├── src/
│   │   ├── index.js        # React entry point
│   │   ├── App.js          # Main component — form, table, charts, AI insights
│   │   └── App.css         # All application styles
│   └── package.json        # Node dependencies, scripts, proxy config
```

---

## Getting Started

### Prerequisites

- Python 3.12+ with `pip`
- Node.js 18+ with `npm`
- (Optional) Azure OpenAI resource for deep analysis mode

### 1. Configure Environment

Create a `.env` file in the project root:

```bash
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your-key-here
AZURE_OPENAI_DEPLOYMENT_4_1=gpt-4.1
AZURE_OPENAI_DEPLOYMENT_4_1_MINI=gpt-4.1-mini
```

This is optional. Without it, Quick Analysis works fully; Deep Analysis will show a fallback message.

### 2. Start the Backend

```bash
cd backend
pip install -r requirements.txt
python app.py
```

The Flask server starts on **http://localhost:5000**. On first run it creates `datamapr.db` and runs any necessary schema migrations automatically.

### 3. Start the Frontend

```bash
cd frontend
npm install
npm start
```

The React dev server starts on **http://localhost:3000** and proxies `/api/*` requests to the Flask backend.

### 4. Use the App

1. Open http://localhost:3000
2. Fill in the **Source Characteristics** (type, schema, quality, access, connector, volume)
3. Fill in the **Integration Signals** (auth type, rate limits, API reliability, null %, schema drift, validation coverage)
4. Click **Add Source** — repeat for all sources
5. Choose **Quick Analysis** or **Deep Analysis (AI)**
6. Click **Analyze**
7. Review: complexity score, risk level, effort estimation, bar chart, score breakdown, insights, and (if deep) AI strategy/connector discovery/risk heuristics

---

## Environment Variables

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `AZURE_OPENAI_ENDPOINT` | For AI mode | Azure OpenAI resource endpoint URL |
| `AZURE_OPENAI_API_KEY` | For AI mode | API key for the Azure OpenAI resource |
| `AZURE_OPENAI_DEPLOYMENT_4_1` | For AI mode | Deployment name for GPT-4.1 (primary model) |
| `AZURE_OPENAI_DEPLOYMENT_4_1_MINI` | For AI mode | Deployment name for GPT-4.1-mini (fallback model) |
| `AZURE_OPENAI_API_VERSION` | No | API version string (defaults to `2024-12-01-preview`) |

The backend loads `.env` from the project root directory (one level above `backend/`).

---

## API Reference

All endpoints are prefixed with `/api`. Request and response bodies are JSON.

### Sources CRUD

| Method   | Endpoint              | Description              | Body |
| -------- | --------------------- | ------------------------ | ---- |
| `GET`    | `/api/sources`        | List all sources         | — |
| `POST`   | `/api/sources`        | Create a new source      | Source JSON |
| `PUT`    | `/api/sources/<id>`   | Update an existing source | Source JSON |
| `DELETE` | `/api/sources/<id>`   | Delete a single source   | — |
| `DELETE` | `/api/sources`        | Delete all sources       | — |

### Analysis

| Method | Endpoint       | Description |
| ------ | -------------- | ----------- |
| `GET`  | `/api/analyze` | Quick analysis — static non-linear scoring + estimation |
| `POST` | `/api/analyze` | Deep analysis — static scoring + AI agent. Body: `{"mode": "deep"}` |

### Options

| Method | Endpoint       | Description |
| ------ | -------------- | ----------- |
| `GET`  | `/api/options` | Returns all valid dropdown values for all 13 fields |

### Source JSON Shape

```json
{
  "name": "Salesforce CRM",
  "type": "SaaS API",
  "schema_complexity": "Complex",
  "data_quality": "Medium",
  "access": "Easy",
  "connector": "Native",
  "volume": "Large",
  "auth_type": "OAuth",
  "rate_limits": "Moderate",
  "api_reliability": "99%",
  "null_percentage": "5-20%",
  "schema_drift": "Occasional",
  "validation_coverage": "Partial"
}
```

The last 6 fields (integration signals) are optional on create/update — they default to the least-risky values.

### Analysis Response Shape (Quick)

```json
{
  "total_score": 71.9,
  "risk_level": "High",
  "source_scores": [
    {
      "id": 1,
      "name": "Salesforce CRM",
      "linear_score": 5.1,
      "nonlinear_score": 4.37,
      "normalized_score": 43.7,
      "risk_level": "Medium",
      "extended_signal_score": 5.0,
      "compound_factors": []
    }
  ],
  "insights": [
    { "source": "Legacy ERP", "type": "critical", "message": "..." }
  ],
  "estimation": {
    "estimated_weeks": 8.6,
    "engineer_count": 2,
    "cost_range": { "low": 25800, "high": 47300 },
    "volatility_factor": 1.15,
    "compound_multiplier": 1.0,
    "breakdown": [
      { "source": "Salesforce CRM", "weeks": 2.5, "risk": "Medium" }
    ]
  }
}
```

### Analysis Response Shape (Deep) — additional fields

When `POST` with `{"mode": "deep"}`, the response includes everything above plus:

```json
{
  "ai_insights": {
    "executive_summary": "...",
    "connector_discovery": [
      {
        "source": "Salesforce CRM",
        "suggested_connector": "Official REST API v58+",
        "integration_method": "Real-time streaming via Platform Events",
        "complexity_notes": "OAuth 2.0 flow required, moderate rate limits"
      }
    ],
    "integration_strategy": {
      "approach": "Phased rollout",
      "rationale": "...",
      "phases": [
        {
          "name": "Phase 1: Low-risk sources",
          "sources": ["Salesforce CRM"],
          "duration_weeks": 3,
          "rationale": "..."
        }
      ]
    },
    "risk_heuristics": [
      {
        "risk": "Legacy ERP has no documented API",
        "severity": "critical",
        "affected_sources": ["Legacy ERP"],
        "mitigation": "Engage vendor for API access or build custom CDC pipeline"
      }
    ],
    "ai_timeline": {
      "total_weeks": 12,
      "team_composition": "2 data engineers, 1 architect",
      "assumptions": "..."
    },
    "ai_cost_estimate": {
      "low_usd": 36000,
      "high_usd": 66000,
      "assumptions": "..."
    }
  }
}
```

If AI is unavailable, `ai_insights` is `null` and `ai_error` contains a fallback message.

### Validation

All `POST` and `PUT` requests are validated server-side. The 7 core fields are required; the 6 integration signal fields are validated only if present. Invalid requests return `400`:

```json
{
  "errors": ["name is required.", "type must be one of: SaaS API, Database, File, Legacy"]
}
```

---

## Data Model

Each data source is stored in a single `sources` SQLite table:

### Core Fields (required)

| Column             | Type    | Valid Values |
| ------------------ | ------- | ------------ |
| `id`               | INTEGER | PK, auto-increment |
| `name`             | TEXT    | Free-text |
| `type`             | TEXT    | `SaaS API`, `Database`, `File`, `Legacy` |
| `schema_complexity`| TEXT    | `Simple`, `Medium`, `Complex` |
| `data_quality`     | TEXT    | `High`, `Medium`, `Low` |
| `access`           | TEXT    | `Easy`, `Medium`, `Hard` |
| `connector`        | TEXT    | `Native`, `Custom`, `None` |
| `volume`           | TEXT    | `Small`, `Medium`, `Large` |

### Integration Signal Fields (added via migration, with defaults)

| Column               | Type | Default     | Valid Values |
| -------------------- | ---- | ----------- | ------------ |
| `auth_type`          | TEXT | `None`      | `OAuth`, `API Key`, `Custom`, `None` |
| `rate_limits`        | TEXT | `Generous`  | `Unlimited`, `Generous`, `Moderate`, `Strict` |
| `api_reliability`    | TEXT | `Unknown`   | `99.9%`, `99%`, `95%`, `Unknown` |
| `null_percentage`    | TEXT | `0-5%`      | `0-5%`, `5-20%`, `20%+` |
| `schema_drift`       | TEXT | `Stable`    | `Stable`, `Occasional`, `Frequent` |
| `validation_coverage`| TEXT | `Full`      | `Full`, `Partial`, `None` |

The `init_db()` function uses `PRAGMA table_info` to detect existing columns and runs `ALTER TABLE ADD COLUMN` for any missing fields. This ensures backward compatibility — existing databases are migrated automatically on server startup.

---

## Scoring Engine

The scoring engine (`backend/scoring.py`) uses a multi-stage non-linear approach:

### Stage 1: Linear Baseline

The original weighted linear score across the 7 core attributes (see `WEIGHTS` and `SCORE_MAPS`):

| Attribute          | Weight | Score Range |
| ------------------ | ------ | ----------- |
| Type               | 20%    | File(2) → Legacy(9) |
| Schema Complexity  | 20%    | Simple(2) → Complex(9) |
| Data Quality       | 20%    | High(1) → Low(9) |
| Access             | 15%    | Easy(1) → Hard(9) |
| Connector          | 15%    | Native(1) → None(9) |
| Volume             | 10%    | Small(2) → Large(8) |

### Stage 2: Extended Signal Score

Average complexity across the 6 integration signal fields (0-10 scale):

| Signal              | Score Range |
| ------------------- | ----------- |
| Auth Type           | None(1) → Custom(9) |
| Rate Limits         | Unlimited(1) → Strict(9) |
| API Reliability     | 99.9%(1) → Unknown(8) |
| Null Percentage     | 0-5%(1) → 20%+(9) |
| Schema Drift        | Stable(1) → Frequent(9) |
| Validation Coverage | Full(1) → None(9) |

### Stage 3: Compound Risk Multipliers

When specific high-risk attribute combinations co-occur, multiplicative penalties apply:

| Rule | Condition | Multiplier |
| ---- | --------- | ---------- |
| Legacy + No Connector | `type=Legacy AND connector=None` | ×1.4 |
| Low Quality + Frequent Drift | `data_quality=Low AND schema_drift=Frequent` | ×1.3 |
| Strict Rate Limits + Custom Auth | `rate_limits=Strict AND auth_type=Custom` | ×1.2 |
| Hard Access + Unknown Reliability | `access=Hard AND api_reliability∈{95%, Unknown}` | ×1.2 |
| No Validation + High Nulls | `validation_coverage=None AND null_percentage=20%+` | ×1.25 |
| Complex Schema + Legacy | `schema_complexity=Complex AND type=Legacy` | ×1.15 |

Compound multipliers stack multiplicatively (e.g., a source triggering 3 rules gets all 3 multiplied together).

### Stage 4: Diminishing Returns

Volume uses logarithmic scaling instead of linear:

```
dim_volume = (log2(raw_volume_score + 1) / log2(11)) * 10
```

This reflects real-world dynamics where going from Small→Medium matters more than Medium→Large.

### Stage 5: Systemic Risk

If 3 or more extended signal fields score above 6, a flat +0.5 systemic risk penalty is added to capture "death by a thousand cuts" scenarios.

### Stage 6: Blending

```
blended = 0.55 × adjusted_linear + 0.30 × extended_signal_avg + 0.15 × compound_adjustments
nonlinear = blended × (1 + (compound_multiplier - 1) × 0.5)
```

The final score is capped at 0-10, then normalized to 0-100.

### Risk Classification

| Normalized Score | Risk Level |
| ---------------- | ---------- |
| 0 – 35           | Low        |
| 36 – 65          | Medium     |
| 66 – 100         | High       |

### Overall Score

The overall project score is the **average** of all individual nonlinear scores, normalized to 0-100.

---

## AI Agent

The AI agent (`backend/ai_agent.py`) provides deep analysis by sending all source data and static scoring results to Azure OpenAI GPT-4.1.

### How It Works

1. The user clicks **Deep Analysis (AI)** and then **Analyze**
2. The frontend sends `POST /api/analyze` with `{"mode": "deep"}`
3. The backend runs the full static analysis first (scoring + estimation + insights)
4. The static results plus all source data are sent to GPT-4.1 via Azure OpenAI
5. The LLM returns structured JSON with deep analysis
6. The response combines both static and AI results

### What the AI Produces

| Section | Description |
| ------- | ----------- |
| **Executive Summary** | 2-3 sentence overview of the integration landscape |
| **Connector Discovery** | Per-source: suggested connector type, integration method, complexity notes |
| **Integration Strategy** | Recommended approach (e.g., phased rollout) with phases, source grouping, and rationale |
| **Risk Heuristics** | Specific risks with severity, affected sources, and mitigation strategies |
| **AI Timeline** | Total weeks, team composition, and key assumptions |
| **AI Cost Estimate** | Low/high USD range with cost assumptions |

### Fallback Behavior

- **Primary model:** GPT-4.1 (via `AZURE_OPENAI_DEPLOYMENT_4_1`)
- **Fallback model:** GPT-4.1-mini (via `AZURE_OPENAI_DEPLOYMENT_4_1_MINI`)
- **If both fail:** Returns `ai_insights: null` with `ai_error` message; static analysis is still shown
- **If no credentials configured:** AI is silently skipped

### LLM Parameters

- `temperature: 0.3` (focused, deterministic output)
- `max_tokens: 4000`
- `response_format: json_object` (enforced structured output)
- Timeout: 45 seconds per call

---

## Insights Engine

The insights engine (in `scoring.py`) scans all sources and generates rule-based flags:

### Original Rules

| Condition | Severity | Message |
| --------- | -------- | ------- |
| `connector == "None"` | Warning | No native connector — custom integration required |
| `data_quality == "Low"` | Warning | Low data quality — data cleansing and validation needed |
| `type == "Legacy"` | Critical | Legacy system — expect higher integration effort and risk |

### Extended Signal Rules

| Condition | Severity | Message |
| --------- | -------- | ------- |
| `rate_limits == "Strict"` | Warning | Strict rate limits — throttling and batching strategy required |
| `schema_drift == "Frequent"` | Warning | Frequent schema drift — schema versioning and monitoring recommended |
| `validation_coverage == "None"` | Warning | No validation coverage — data integrity at risk |
| `null_percentage == "20%+"` | Warning | >20% null values — significant data imputation needed |
| `auth_type == "Custom"` | Warning | Custom authentication — additional security review and engineering effort |
| `api_reliability ∈ {"95%", "Unknown"}` | Warning | Low/unknown API reliability — build retry logic and circuit breakers |

---

## Effort Estimation

The estimation engine (`estimate_effort()` in `scoring.py`) produces timeline, team size, and cost projections:

### Base Calculation

Each source contributes base weeks by risk level:

| Risk Level | Base Weeks |
| ---------- | ---------- |
| Low        | 1.0        |
| Medium     | 2.5        |
| High       | 5.0        |

### Non-linear Adjustments

**Volatility factor:** For each source with `schema_drift=Frequent` OR `api_reliability∈{95%, Unknown}`, the total is multiplied by an additional 15%:

```
volatility_factor = 1 + 0.15 × volatile_source_count
```

**Compound multiplier:** When more than 2 sources are High risk, effort grows non-linearly:

```
compound_multiplier = 1 + 0.1 × (high_risk_count - 2)    // only if > 2
```

### Final Outputs

```
total_weeks = SUM(base_weeks) × volatility_factor × compound_multiplier
engineer_count = ceil(total_weeks / 6)
cost_low = total_weeks × $3,000/week
cost_high = total_weeks × $5,500/week
```

---

## Frontend UI

The React frontend (`frontend/src/App.js`) is a single-page application:

1. **Header** — App title and tagline
2. **Source Form** — Two-section grid form:
   - *Source Characteristics*: name, type, schema complexity, data quality, access, connector, volume
   - *Integration Signals*: auth type, rate limits, API reliability, null %, schema drift, validation coverage
3. **Sources Table** — Compact table with expandable rows showing integration signal details
4. **Analysis Mode Toggle** — Pill buttons to switch between Quick Analysis and Deep Analysis (AI)
5. **Score Banner** — Large color-coded complexity score and risk level
6. **Effort Estimation Card** — Weeks, engineer count, cost range, with volatility/compound factor badges
7. **Bar Chart** — Recharts bar chart with color-coded bars by risk level
8. **Source Scores Table** — Linear score, nonlinear score, signal average, normalized score, risk badge, and compound factor tags
9. **Insights Panel** — Rule-based insight cards with color-coded severity
10. **AI Deep Analysis** (when available):
    - Executive summary
    - Connector discovery table
    - Integration strategy with phased plan cards
    - Risk heuristics with severity badges and mitigations
    - AI timeline and cost estimates with assumptions

Loading states show a spinner during analysis. AI errors display a yellow fallback banner.

---

## Configuration and Customization

### Adjusting Linear Weights

Edit `WEIGHTS` in `backend/scoring.py`. Weights must sum to 1.0:

```python
WEIGHTS = {
    "type": 0.20,
    "schema_complexity": 0.20,
    "data_quality": 0.20,
    "access": 0.15,
    "connector": 0.15,
    "volume": 0.10,
}
```

### Adjusting Score Mappings

Edit `SCORE_MAPS` and `EXTENDED_SCORE_MAPS` in `backend/scoring.py` to change how attribute values map to 0-10 complexity scores.

### Adding Compound Risk Rules

Add entries to the `COMPOUND_RULES` list in `backend/scoring.py`:

```python
{
    "name": "Descriptive Rule Name",
    "condition": lambda s: s.get("field1") == "X" and s.get("field2") == "Y",
    "multiplier": 1.25,
}
```

### Adjusting Risk Thresholds

Edit `assign_risk_level()` in `backend/scoring.py`.

### Adjusting Cost Parameters

Edit the constants in `backend/scoring.py`:

```python
BASE_WEEKS = {"Low": 1.0, "Medium": 2.5, "High": 5.0}
WEEKLY_RATE_LOW = 3000
WEEKLY_RATE_HIGH = 5500
```

### Modifying the AI System Prompt

Edit `SYSTEM_PROMPT` in `backend/ai_agent.py` to change what the AI agent focuses on or how it structures its output.

### Adding New Source Attributes

1. Add valid values list to `backend/models.py`
2. Add the column to `_NEW_COLUMNS` list in `models.py` (migration handles the rest)
3. Add the attribute to `EXTENDED_SCORE_MAPS` in `backend/scoring.py`
4. Add the field to validators in `backend/app.py`
5. Optionally add compound rules in `scoring.py`
6. Optionally add insight rules in `generate_insights()`
7. Add the dropdown to the form in `frontend/src/App.js`
