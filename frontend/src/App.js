import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import './App.css';

const API = process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api` : '/api';

const DEFAULTS = {
  name: '',
  type: 'SaaS API',
  schema_complexity: 'Medium',
  data_quality: 'Medium',
  access: 'Medium',
  connector: 'Native',
  volume: 'Medium',
  auth_type: 'None',
  rate_limits: 'Generous',
  api_reliability: 'Unknown',
  null_percentage: '0-5%',
  schema_drift: 'Stable',
  validation_coverage: 'Full',
};

const FIELD_INFO = {
  name: {
    what: 'A human-readable label for this data source.',
    scoring: 'Not scored directly — used to identify the source in results, insights, and AI analysis.',
  },
  type: {
    what: 'The category of system this source belongs to.',
    scoring: 'Carries 20% weight. File (2) → Database (4) → SaaS API (6) → Legacy (9). Legacy scores highest due to poor documentation, brittle APIs, and change risk.',
  },
  schema_complexity: {
    what: 'How complex and nested the data structure is.',
    scoring: 'Carries 20% weight. Simple (2) → Medium (5) → Complex (9). Complex schemas require more mapping effort and are harder to maintain.',
  },
  data_quality: {
    what: 'How clean, consistent, and complete the data is.',
    scoring: 'Carries 20% weight. High (1) → Low (9). Low quality + Frequent drift triggers a ×1.3 compound multiplier.',
  },
  access: {
    what: 'How difficult it is to gain technical access to this source.',
    scoring: 'Carries 15% weight. Easy (1) → Hard (9). Hard access + Unknown reliability triggers a ×1.2 compound multiplier.',
  },
  connector: {
    what: 'Whether a pre-built integration connector exists.',
    scoring: 'Carries 15% weight. Native (1) → None (9). No connector + Legacy type triggers the highest compound multiplier at ×1.4.',
  },
  volume: {
    what: 'Approximate data volume this source produces.',
    scoring: 'Carries 10% weight with logarithmic scaling — Small→Medium matters more than Medium→Large.',
  },
  auth_type: {
    what: 'The authentication mechanism required to connect.',
    scoring: 'Part of the extended signal score (~30% of total). None (1) → Custom (9). Strict rate limits + Custom auth triggers ×1.2.',
  },
  rate_limits: {
    what: "How restrictive this source's API rate limits are.",
    scoring: 'Unlimited (1) → Strict (9). Strict limits force throttling and batching — significant engineering overhead.',
  },
  api_reliability: {
    what: "The uptime/SLA of this source's API.",
    scoring: '99.9% (1) → Unknown (8). Unknown scores nearly as high as 95% — it forces defensive design. Each unreliable source adds 15% to total timeline.',
  },
  null_percentage: {
    what: 'Approximate percentage of records with missing/null values.',
    scoring: '0–5% (1) → 20%+ (9). High nulls + No validation coverage triggers ×1.25.',
  },
  schema_drift: {
    what: "How often this source's data structure changes without notice.",
    scoring: 'Stable (1) → Frequent (9). Frequent drift adds 15% to timeline per volatile source. Pairs with Low quality for ×1.3.',
  },
  validation_coverage: {
    what: 'How much validation is enforced at the source before you receive data.',
    scoring: 'Full (1) → None (9). No validation + 20%+ nulls triggers ×1.25 — your pipeline absorbs all quality enforcement.',
  },
};

const OPTIONS = {
  types: ['SaaS API', 'Database', 'File', 'Legacy'],
  schema_complexity: ['Simple', 'Medium', 'Complex'],
  data_quality: ['High', 'Medium', 'Low'],
  access: ['Easy', 'Medium', 'Hard'],
  connector: ['Native', 'Custom', 'None'],
  volume: ['Small', 'Medium', 'Large'],
  auth_type: ['None', 'API Key', 'OAuth', 'Custom'],
  rate_limits: ['Unlimited', 'Generous', 'Moderate', 'Strict'],
  api_reliability: ['99.9%', '99%', '95%', 'Unknown'],
  null_percentage: ['0-5%', '5-20%', '20%+'],
  schema_drift: ['Stable', 'Occasional', 'Frequent'],
  validation_coverage: ['Full', 'Partial', 'None'],
};

function riskColor(level) {
  if (level === 'Low') return '#1a936f';
  if (level === 'Medium') return '#b96a0a';
  return '#c0392b';
}

function formatUSD(n) {
  if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return '$' + Math.round(n / 1000) + 'K';
  return '$' + n.toLocaleString();
}

function riskPillClass(level) {
  if (level === 'Low') return 'risk-pill risk-pill-low';
  if (level === 'Medium') return 'risk-pill risk-pill-medium';
  return 'risk-pill risk-pill-high';
}

function dotClass(level) {
  if (level === 'Low') return 'risk-dot dot-low';
  if (level === 'Medium') return 'risk-dot dot-medium';
  return 'risk-dot dot-high';
}

const SAMPLE_AI = {
  executive_summary: "This integration landscape spans four systems with meaningfully different risk profiles. Salesforce presents the lowest risk given its native connector and well-documented REST API, while the on-prem Oracle ERP represents the most significant challenge — no managed connector exists, the schema is complex, and data quality issues compound an already difficult access situation. The Kafka event stream introduces schema drift risk that will require ongoing monitoring. A phased approach is strongly recommended to contain blast radius and allow the team to build institutional knowledge before tackling the legacy system.",
  connector_discovery: [
    {
      source: "Salesforce CRM",
      suggested_connector: "Salesforce REST API v58+ (official)",
      integration_method: "Incremental sync via Change Data Capture (CDC)",
      complexity_notes: "OAuth 2.0 required. API limits at 100k calls/day on Enterprise tier — batch window scheduling recommended to stay within limits.",
    },
    {
      source: "Oracle ERP (on-prem)",
      suggested_connector: "Custom JDBC connector or Oracle GoldenGate CDC",
      integration_method: "Database-level CDC via redo log tailing",
      complexity_notes: "No SaaS connector available. Requires network-level access to the Oracle host and a dedicated integration server in the same VPC. GoldenGate licensing adds cost.",
    },
    {
      source: "Kafka Event Stream",
      suggested_connector: "Confluent Kafka Connect (managed) or custom consumer",
      integration_method: "Real-time streaming consumer with schema registry",
      complexity_notes: "Schema Registry integration is critical given frequent drift. Avro or Protobuf recommended over JSON to enforce contracts at the producer level.",
    },
    {
      source: "Google Analytics 4",
      suggested_connector: "GA4 Data API (official Google client library)",
      integration_method: "Daily batch export via BigQuery link or API pull",
      complexity_notes: "BigQuery export is the preferred path — avoids API quota constraints. Data freshness is 24–48 hours by design; real-time is not supported.",
    },
  ],
  integration_strategy: {
    approach: "Phased rollout",
    rationale: "Starting with low-risk, high-value sources lets the team validate infrastructure and build confidence before taking on the Oracle ERP, which carries the highest technical and coordination risk. Kafka is placed in Phase 2 rather than Phase 3 due to its business-critical event data, but its schema drift risk requires the schema registry work to be completed first.",
    phases: [
      {
        name: "Phase 1: Establish foundation",
        sources: ["Salesforce CRM", "Google Analytics 4"],
        duration_weeks: 10,
        rationale: "Both sources have documented APIs, managed connectors, and clear schemas. This phase validates the pipeline infrastructure, monitoring, and deployment process with manageable risk.",
      },
      {
        name: "Phase 2: Real-time stream",
        sources: ["Kafka Event Stream"],
        duration_weeks: 12,
        rationale: "Kafka requires schema registry setup and drift handling before it can be considered stable. Building on the infrastructure from Phase 1, this phase adds real-time capability while schema contracts are enforced.",
      },
      {
        name: "Phase 3: Legacy system",
        sources: ["Oracle ERP (on-prem)"],
        duration_weeks: 20,
        rationale: "Oracle ERP is intentionally last. The team will have a mature pipeline, proven monitoring, and operational experience before taking on the highest-risk source. Network access, GoldenGate licensing, and data quality remediation should begin during Phase 2.",
      },
    ],
  },
  risk_heuristics: [
    {
      risk: "Oracle ERP has no managed connector and requires direct database access",
      severity: "critical",
      affected_sources: ["Oracle ERP (on-prem)"],
      mitigation: "Engage the Oracle DBA team early to establish redo log access. Evaluate GoldenGate vs. a custom JDBC approach based on licensing budget. Plan for a 4–6 week access and security review before any development begins.",
    },
    {
      risk: "Kafka schema drift will silently break downstream consumers",
      severity: "high",
      affected_sources: ["Kafka Event Stream"],
      mitigation: "Enforce a schema registry (Confluent or AWS Glue) with compatibility mode set to BACKWARD. Add schema validation as a pipeline gate — reject messages that fail before they reach storage.",
    },
    {
      risk: "Salesforce API rate limits may cause pipeline delays at peak load",
      severity: "medium",
      affected_sources: ["Salesforce CRM"],
      mitigation: "Implement exponential backoff with jitter. Schedule bulk sync jobs outside business hours. Monitor daily API usage against the 100k call ceiling and alert at 80%.",
    },
    {
      risk: "Oracle data quality issues will propagate downstream without remediation",
      severity: "high",
      affected_sources: ["Oracle ERP (on-prem)"],
      mitigation: "Run a data profiling pass (Great Expectations or dbt tests) before go-live. Define null thresholds and deduplication rules as acceptance criteria — do not go live until these pass.",
    },
  ],
  ai_timeline: {
    total_weeks: 42,
    team_composition: "2 senior data engineers, 1 integration architect, 1 data quality analyst (Phase 3 only)",
    assumptions: "Assumes network access to Oracle host is granted within 2 weeks of project start. Schema registry decision is made before Phase 2 begins. No organizational change management scope included.",
  },
  ai_cost_estimate: {
    low_usd: 147000,
    high_usd: 315000,
    assumptions: "Low end assumes two W2 engineers at $3,500/wk fully-loaded. High end assumes contractor rates at $7,500/wk plus integration architect at a premium. Excludes GoldenGate licensing (~$15–40k/yr), infrastructure costs, and data quality tooling.",
  },
};

export default function App() {
  const [sources, setSources] = useState([]);
  const [form, setForm] = useState({ ...DEFAULTS });
  const [editId, setEditId] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState('');
  const [analysisMode, setAnalysisMode] = useState('quick');
  const [loading, setLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});
  const [showAiPreview, setShowAiPreview] = useState(false);

  const fetchSources = useCallback(async () => {
    const res = await fetch(`${API}/sources`);
    setSources(await res.json());
  }, []);

  useEffect(() => { fetchSources(); }, [fetchSources]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async () => {
    setError('');
    if (!form.name.trim()) { setError('Source name is required.'); return; }

    const url = editId ? `${API}/sources/${editId}` : `${API}/sources`;
    const method = editId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const data = await res.json();
      setError((data.errors || ['Request failed']).join(', '));
      return;
    }

    setForm({ ...DEFAULTS });
    setEditId(null);
    setAnalysis(null);
    fetchSources();
  };

  const handleEdit = (src) => {
    setEditId(src.id);
    setForm({
      name: src.name,
      type: src.type,
      schema_complexity: src.schema_complexity,
      data_quality: src.data_quality,
      access: src.access,
      connector: src.connector,
      volume: src.volume,
      auth_type: src.auth_type || 'None',
      rate_limits: src.rate_limits || 'Generous',
      api_reliability: src.api_reliability || 'Unknown',
      null_percentage: src.null_percentage || '0-5%',
      schema_drift: src.schema_drift || 'Stable',
      validation_coverage: src.validation_coverage || 'Full',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    await fetch(`${API}/sources/${id}`, { method: 'DELETE' });
    setAnalysis(null);
    fetchSources();
  };

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const options = analysisMode === 'deep'
        ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'deep' }) }
        : {};
      const res = await fetch(`${API}/analyze`, options);
      setAnalysis(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const handleClearAll = async () => {
    await fetch(`${API}/sources`, { method: 'DELETE' });
    setSources([]);
    setAnalysis(null);
  };

  const cancelEdit = () => { setEditId(null); setForm({ ...DEFAULTS }); };
  const toggleRow = (id) => setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));

  const ai = analysis?.ai_insights;
  const est = analysis?.estimation;

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="site-header">
        <div className="header-top">
          <h1>DataMapr</h1>
          <span className="header-version">beta</span>
        </div>
        <p>Data integration complexity scoring and effort estimation</p>
      </header>

      {/* ── Source Form ── */}
      <div className="card">
        <div className="card-title">{editId ? 'Editing source' : 'Add data source'}</div>
        {error && <div className="form-error">{error}</div>}

        <div className="form-section-label">Source characteristics</div>
        <div className="form-grid">
          <div className="form-group">
            <label>Name <InfoTooltip field="name" /></label>
            <input name="name" value={form.name} onChange={handleChange} placeholder="e.g. Salesforce CRM" />
          </div>
          <SelectField label="Type" name="type" value={form.type} options={OPTIONS.types} onChange={handleChange} />
          <SelectField label="Schema Complexity" name="schema_complexity" value={form.schema_complexity} options={OPTIONS.schema_complexity} onChange={handleChange} />
          <SelectField label="Data Quality" name="data_quality" value={form.data_quality} options={OPTIONS.data_quality} onChange={handleChange} />
          <SelectField label="Access" name="access" value={form.access} options={OPTIONS.access} onChange={handleChange} />
          <SelectField label="Connector" name="connector" value={form.connector} options={OPTIONS.connector} onChange={handleChange} />
          <SelectField label="Volume" name="volume" value={form.volume} options={OPTIONS.volume} onChange={handleChange} />
        </div>

        <div className="form-section-label" style={{ marginTop: 20 }}>Integration signals</div>
        <div className="form-grid">
          <SelectField label="Auth Type" name="auth_type" value={form.auth_type} options={OPTIONS.auth_type} onChange={handleChange} />
          <SelectField label="Rate Limits" name="rate_limits" value={form.rate_limits} options={OPTIONS.rate_limits} onChange={handleChange} />
          <SelectField label="API Reliability" name="api_reliability" value={form.api_reliability} options={OPTIONS.api_reliability} onChange={handleChange} />
          <SelectField label="Null %" name="null_percentage" value={form.null_percentage} options={OPTIONS.null_percentage} onChange={handleChange} />
          <SelectField label="Schema Drift" name="schema_drift" value={form.schema_drift} options={OPTIONS.schema_drift} onChange={handleChange} />
          <SelectField label="Validation Coverage" name="validation_coverage" value={form.validation_coverage} options={OPTIONS.validation_coverage} onChange={handleChange} />
        </div>

        <div className="form-actions">
          <button className="btn-primary" onClick={handleSubmit}>
            {editId ? 'Save changes' : 'Add source'}
          </button>
          {editId && <button className="btn-ghost" onClick={cancelEdit}>Cancel</button>}
        </div>
      </div>

      {/* ── Sources list ── */}
      {sources.length > 0 && (
        <div className="card">
          <div className="card-title">Sources ({sources.length})</div>
          <div className="table-wrap">
            <table className="source-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Schema</th>
                  <th>Quality</th>
                  <th>Connector</th>
                  <th>Volume</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <React.Fragment key={s.id}>
                    <tr>
                      <td>
                        <button className="btn-expand" onClick={() => toggleRow(s.id)} title="Show integration signals">
                          {expandedRows[s.id] ? '▾' : '▸'}
                        </button>
                      </td>
                      <td><strong>{s.name}</strong></td>
                      <td>{s.type}</td>
                      <td>{s.schema_complexity}</td>
                      <td>{s.data_quality}</td>
                      <td>{s.connector}</td>
                      <td>{s.volume}</td>
                      <td>
                        <div className="actions-cell">
                          <button className="btn-ghost btn-sm" onClick={() => handleEdit(s)}>Edit</button>
                          <button className="btn-danger btn-sm" onClick={() => handleDelete(s.id)}>Remove</button>
                        </div>
                      </td>
                    </tr>
                    {expandedRows[s.id] && (
                      <tr className="expand-row">
                        <td colSpan={8}>
                          <div className="expand-content">
                            <span><strong>Auth:</strong> {s.auth_type}</span>
                            <span><strong>Rate limits:</strong> {s.rate_limits}</span>
                            <span><strong>Reliability:</strong> {s.api_reliability}</span>
                            <span><strong>Nulls:</strong> {s.null_percentage}</span>
                            <span><strong>Schema drift:</strong> {s.schema_drift}</span>
                            <span><strong>Validation:</strong> {s.validation_coverage}</span>
                            <span><strong>Access:</strong> {s.access}</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="analysis-bar">
            <div className="mode-toggle">
              <button
                className={analysisMode === 'quick' ? 'active-quick' : ''}
                onClick={() => { setAnalysisMode('quick'); setShowAiPreview(false); }}
              >
                Quick
              </button>
              <button
                className="btn-deep-disabled"
                onClick={() => setShowAiPreview(true)}
                title="Disabled — click to see a real sample output"
              >
                Deep (AI) ↗
              </button>
            </div>
            <div className="spacer" />
            <button className="btn-ghost btn-sm" onClick={handleClearAll}>Clear all</button>
            <button className="btn-success" onClick={handleAnalyze} disabled={loading}>
              {loading ? 'Analyzing…' : 'Run analysis'}
            </button>
          </div>
        </div>
      )}

      {/* ── AI Preview Panel ── */}
      {showAiPreview && (
        <div className="card ai-preview-card">
          <div className="ai-preview-header">
            <div className="ai-section-label" style={{ marginBottom: 0 }}>
              <span className="ai-tag">AI</span>
              <span className="card-title" style={{ marginBottom: 0 }}>Deep analysis — sample output</span>
            </div>
            <button className="btn-ghost btn-sm" onClick={() => setShowAiPreview(false)}>Dismiss</button>
          </div>
          <p className="ai-preview-note">
            Deep Analysis runs against my own Azure OpenAI keys, so I've disabled open access to keep costs manageable.
            Below is real output from an actual run — same sources, same model, nothing edited.
          </p>

          <div className="ai-summary-text" style={{ marginBottom: 16 }}>{SAMPLE_AI.executive_summary}</div>

          <div className="card-title" style={{ marginTop: 16 }}>Connector discovery</div>
          <table className="source-table connector-table">
            <thead>
              <tr><th>Source</th><th>Connector</th><th>Method</th><th>Notes</th></tr>
            </thead>
            <tbody>
              {SAMPLE_AI.connector_discovery.map((c, i) => (
                <tr key={i}>
                  <td><strong>{c.source}</strong></td>
                  <td>{c.suggested_connector}</td>
                  <td>{c.integration_method}</td>
                  <td className="connector-notes">{c.complexity_notes}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="card-title" style={{ marginTop: 20 }}>Integration strategy</div>
          <div className="strategy-approach"><strong>Approach:</strong> {SAMPLE_AI.integration_strategy.approach}</div>
          <p className="strategy-rationale">{SAMPLE_AI.integration_strategy.rationale}</p>
          <div className="phases">
            {SAMPLE_AI.integration_strategy.phases.map((p, i) => (
              <div key={i} className="phase-card">
                <div className="phase-header">
                  <span className="phase-name">{p.name}</span>
                  <span className="phase-weeks">{p.duration_weeks} wks</span>
                </div>
                <div className="phase-sources">
                  {p.sources.map((s, j) => <span key={j} className="source-tag">{s}</span>)}
                </div>
                <p className="phase-rationale">{p.rationale}</p>
              </div>
            ))}
          </div>

          <div className="card-title" style={{ marginTop: 20 }}>Risk analysis</div>
          {SAMPLE_AI.risk_heuristics.map((r, i) => (
            <div key={i} className={`insight insight-ai-${r.severity}`}>
              <div className="risk-header">
                <span className={`badge badge-${r.severity}`}>{r.severity}</span>
                {r.risk}
              </div>
              {r.affected_sources?.length > 0 && (
                <div className="risk-sources">Affects: {r.affected_sources.join(', ')}</div>
              )}
              <div className="risk-mitigation"><strong>Mitigation:</strong> {r.mitigation}</div>
            </div>
          ))}

          <div className="card-title" style={{ marginTop: 20 }}>AI estimate</div>
          <div className="est-grid">
            <div className="est-cell">
              <div className="est-value">{SAMPLE_AI.ai_timeline.total_weeks} wks</div>
              <div className="est-label">Timeline</div>
            </div>
            <div className="est-cell">
              <div className="est-value" style={{ fontSize: '0.95rem', paddingTop: 4 }}>{SAMPLE_AI.ai_timeline.team_composition}</div>
              <div className="est-label">Team</div>
            </div>
            <div className="est-cell">
              <div className="est-value">{formatUSD(SAMPLE_AI.ai_cost_estimate.low_usd)}</div>
              <div className="est-label">Cost low</div>
            </div>
            <div className="est-cell">
              <div className="est-value">{formatUSD(SAMPLE_AI.ai_cost_estimate.high_usd)}</div>
              <div className="est-label">Cost high</div>
            </div>
          </div>
          <p className="est-assumptions"><strong>Assumptions:</strong> {SAMPLE_AI.ai_timeline.assumptions}</p>
          <p className="est-assumptions"><strong>Cost assumptions:</strong> {SAMPLE_AI.ai_cost_estimate.assumptions}</p>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="card loading-card">
          <div className="spinner" />
          <div className="loading-label">
            {analysisMode === 'deep' ? 'Running deep analysis via AI…' : 'Computing scores…'}
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {analysis && !loading && (
        <>
          {/* Score + risk */}
          <div className="card">
            <div className="card-title">Results</div>
            <div className="results-header">
              <div className="score-block">
                <span className="score-number" style={{ color: riskColor(analysis.risk_level) }}>
                  {analysis.total_score}
                </span>
                <span className="score-denom">/ 100</span>
              </div>
              <div className="score-meta">
                <div className={riskPillClass(analysis.risk_level)}>
                  <span className={dotClass(analysis.risk_level)} />
                  {analysis.risk_level} risk
                </div>
                <div className="score-subtext">
                  {analysis.source_scores?.length} source{analysis.source_scores?.length !== 1 ? 's' : ''} scored
                </div>
              </div>
            </div>
          </div>

          {/* Effort estimation */}
          {est && (
            <div className="card">
              <div className="card-title">Effort estimation</div>
              <div className="est-grid">
                <div className="est-cell">
                  <div className="est-value">{est.estimated_weeks} wks</div>
                  <div className="est-label">Timeline</div>
                </div>
                <div className="est-cell">
                  <div className="est-value">{est.engineer_count}</div>
                  <div className="est-label">Engineers</div>
                </div>
                <div className="est-cell">
                  <div className="est-value">{formatUSD(est.cost_range.low)}</div>
                  <div className="est-label">Cost low</div>
                </div>
                <div className="est-cell">
                  <div className="est-value">{formatUSD(est.cost_range.high)}</div>
                  <div className="est-label">Cost high</div>
                </div>
              </div>
              {(est.volatility_factor > 1 || est.compound_multiplier > 1) && (
                <div className="factor-row">
                  {est.volatility_factor > 1 && (
                    <span className="factor-chip">Volatility ×{est.volatility_factor}</span>
                  )}
                  {est.compound_multiplier > 1 && (
                    <span className="factor-chip">Compound risk ×{est.compound_multiplier}</span>
                  )}
                </div>
              )}
              <div className="est-note">
                Rates: $3,500–$7,500/wk per engineer (W2 fully-loaded to specialist contractor, US 2024–25)
              </div>
            </div>
          )}

          {/* Chart */}
          {analysis.source_scores?.length > 0 && (
            <div className="card">
              <div className="card-title">Score by source</div>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={analysis.source_scores} margin={{ top: 8, right: 16, left: -10, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#999' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#bbb' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ border: '1px solid #eee', borderRadius: 7, fontSize: 13 }}
                      formatter={(val) => [`${val} / 100`, 'Complexity score']}
                    />
                    <Bar dataKey="normalized_score" radius={[5, 5, 0, 0]} maxBarSize={60}>
                      {analysis.source_scores.map((entry, idx) => (
                        <Cell key={idx} fill={riskColor(entry.risk_level)} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Per-source scores */}
          <div className="card">
            <div className="card-title">Source breakdown</div>
            <table className="source-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Linear</th>
                  <th>Nonlinear</th>
                  <th>Signals avg</th>
                  <th>Score</th>
                  <th>Risk</th>
                  <th>Compound factors</th>
                </tr>
              </thead>
              <tbody>
                {analysis.source_scores.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.name}</strong></td>
                    <td>{s.linear_score} / 10</td>
                    <td>{s.nonlinear_score} / 10</td>
                    <td>{s.extended_signal_score} / 10</td>
                    <td>{s.normalized_score} / 100</td>
                    <td>
                      <span className={`badge badge-${s.risk_level.toLowerCase()}`}>
                        {s.risk_level}
                      </span>
                    </td>
                    <td>
                      {s.compound_factors.length > 0
                        ? s.compound_factors.map((f, i) => <span key={i} className="compound-tag">{f}</span>)
                        : <span style={{ color: '#ccc' }}>—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Insights */}
          {analysis.insights?.length > 0 && (
            <div className="card">
              <div className="card-title">Insights</div>
              {analysis.insights.map((ins, i) => (
                <div key={i} className={`insight insight-${ins.type}`}>
                  {ins.message}
                </div>
              ))}
            </div>
          )}

          {/* AI error */}
          {analysis.ai_error && (
            <div className="card ai-error-card">{analysis.ai_error}</div>
          )}

          {/* AI deep analysis */}
          {ai && (
            <>
              {/* Executive summary */}
              {ai.executive_summary && (
                <div className="card">
                  <div className="ai-section-label">
                    <span className="ai-tag">AI</span>
                    <span className="card-title" style={{ marginBottom: 0 }}>Summary</span>
                  </div>
                  <div className="ai-summary-text">{ai.executive_summary}</div>
                </div>
              )}

              {/* Connector discovery */}
              {ai.connector_discovery?.length > 0 && (
                <div className="card">
                  <div className="ai-section-label">
                    <span className="ai-tag">AI</span>
                    <span className="card-title" style={{ marginBottom: 0 }}>Connector discovery</span>
                  </div>
                  <table className="source-table connector-table">
                    <thead>
                      <tr>
                        <th>Source</th>
                        <th>Connector</th>
                        <th>Method</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ai.connector_discovery.map((c, i) => (
                        <tr key={i}>
                          <td><strong>{c.source}</strong></td>
                          <td>{c.suggested_connector}</td>
                          <td>{c.integration_method}</td>
                          <td className="connector-notes">{c.complexity_notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Integration strategy */}
              {ai.integration_strategy && (
                <div className="card">
                  <div className="ai-section-label">
                    <span className="ai-tag">AI</span>
                    <span className="card-title" style={{ marginBottom: 0 }}>Integration strategy</span>
                  </div>
                  <div className="strategy-approach">
                    <strong>Approach:</strong> {ai.integration_strategy.approach}
                  </div>
                  <p className="strategy-rationale">{ai.integration_strategy.rationale}</p>
                  {ai.integration_strategy.phases?.length > 0 && (
                    <div className="phases">
                      {ai.integration_strategy.phases.map((p, i) => (
                        <div key={i} className="phase-card">
                          <div className="phase-header">
                            <span className="phase-name">{p.name}</span>
                            <span className="phase-weeks">{p.duration_weeks} wks</span>
                          </div>
                          {p.sources?.length > 0 && (
                            <div className="phase-sources">
                              {p.sources.map((s, j) => <span key={j} className="source-tag">{s}</span>)}
                            </div>
                          )}
                          <p className="phase-rationale">{p.rationale}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Risk heuristics */}
              {ai.risk_heuristics?.length > 0 && (
                <div className="card">
                  <div className="ai-section-label">
                    <span className="ai-tag">AI</span>
                    <span className="card-title" style={{ marginBottom: 0 }}>Risk analysis</span>
                  </div>
                  {ai.risk_heuristics.map((r, i) => (
                    <div key={i} className={`insight insight-ai-${r.severity}`}>
                      <div className="risk-header">
                        <span className={`badge badge-${r.severity}`}>{r.severity}</span>
                        {r.risk}
                      </div>
                      {r.affected_sources?.length > 0 && (
                        <div className="risk-sources">Affects: {r.affected_sources.join(', ')}</div>
                      )}
                      <div className="risk-mitigation"><strong>Mitigation:</strong> {r.mitigation}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* AI timeline + cost */}
              {(ai.ai_timeline || ai.ai_cost_estimate) && (
                <div className="card">
                  <div className="ai-section-label">
                    <span className="ai-tag">AI</span>
                    <span className="card-title" style={{ marginBottom: 0 }}>AI estimate</span>
                  </div>
                  <div className="est-grid">
                    {ai.ai_timeline && (
                      <>
                        <div className="est-cell">
                          <div className="est-value">{ai.ai_timeline.total_weeks} wks</div>
                          <div className="est-label">Timeline</div>
                        </div>
                        <div className="est-cell">
                          <div className="est-value" style={{ fontSize: '1rem', paddingTop: 4 }}>
                            {ai.ai_timeline.team_composition}
                          </div>
                          <div className="est-label">Team</div>
                        </div>
                      </>
                    )}
                    {ai.ai_cost_estimate && (
                      <>
                        <div className="est-cell">
                          <div className="est-value">{formatUSD(ai.ai_cost_estimate.low_usd)}</div>
                          <div className="est-label">Cost low</div>
                        </div>
                        <div className="est-cell">
                          <div className="est-value">{formatUSD(ai.ai_cost_estimate.high_usd)}</div>
                          <div className="est-label">Cost high</div>
                        </div>
                      </>
                    )}
                  </div>
                  {ai.ai_timeline?.assumptions && (
                    <p className="est-assumptions"><strong>Assumptions:</strong> {ai.ai_timeline.assumptions}</p>
                  )}
                  {ai.ai_cost_estimate?.assumptions && (
                    <p className="est-assumptions"><strong>Cost assumptions:</strong> {ai.ai_cost_estimate.assumptions}</p>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function InfoTooltip({ field }) {
  const info = FIELD_INFO[field];
  if (!info) return null;
  return (
    <span className="info-icon" tabIndex={0}>
      i
      <span className="info-popup">
        <strong>{info.what}</strong>
        <hr className="info-divider" />
        <span className="info-scoring-label">Scoring</span>
        {info.scoring}
      </span>
    </span>
  );
}

function SelectField({ label, name, value, options, onChange }) {
  return (
    <div className="form-group">
      <label>
        {label}
        <InfoTooltip field={name} />
      </label>
      <select name={name} value={value} onChange={onChange}>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}
