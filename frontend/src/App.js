import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import './App.css';

const API = '/api';

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
  if (level === 'Low') return '#2ec4b6';
  if (level === 'Medium') return '#f4a261';
  return '#e63946';
}

function formatUSD(n) {
  return '$' + n.toLocaleString();
}

export default function App() {
  const [sources, setSources] = useState([]);
  const [form, setForm] = useState({ ...DEFAULTS });
  const [editId, setEditId] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState('');
  const [analysisMode, setAnalysisMode] = useState('quick');
  const [loading, setLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});

  const fetchSources = useCallback(async () => {
    const res = await fetch(`${API}/sources`);
    setSources(await res.json());
  }, []);

  useEffect(() => { fetchSources(); }, [fetchSources]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

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

  const toggleRow = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const ai = analysis?.ai_insights;

  return (
    <div className="app">
      <header>
        <h1>DataMapr</h1>
        <p>Data Integration Complexity Scorer</p>
      </header>

      {/* ── Source Form ── */}
      <div className="card">
        <h2>{editId ? 'Edit Source' : 'Add Data Source'}</h2>
        {error && <p style={{ color: '#e63946', marginBottom: 12 }}>{error}</p>}

        <h3 className="form-section-title">Source Characteristics</h3>
        <div className="form-grid">
          <div className="form-group">
            <label>Name</label>
            <input name="name" value={form.name} onChange={handleChange} placeholder="e.g. Salesforce CRM" />
          </div>
          <SelectField label="Type" name="type" value={form.type} options={OPTIONS.types} onChange={handleChange} />
          <SelectField label="Schema Complexity" name="schema_complexity" value={form.schema_complexity} options={OPTIONS.schema_complexity} onChange={handleChange} />
          <SelectField label="Data Quality" name="data_quality" value={form.data_quality} options={OPTIONS.data_quality} onChange={handleChange} />
          <SelectField label="Access" name="access" value={form.access} options={OPTIONS.access} onChange={handleChange} />
          <SelectField label="Connector" name="connector" value={form.connector} options={OPTIONS.connector} onChange={handleChange} />
          <SelectField label="Volume" name="volume" value={form.volume} options={OPTIONS.volume} onChange={handleChange} />
        </div>

        <h3 className="form-section-title">Integration Signals</h3>
        <div className="form-grid">
          <SelectField label="Auth Type" name="auth_type" value={form.auth_type} options={OPTIONS.auth_type} onChange={handleChange} />
          <SelectField label="Rate Limits" name="rate_limits" value={form.rate_limits} options={OPTIONS.rate_limits} onChange={handleChange} />
          <SelectField label="API Reliability" name="api_reliability" value={form.api_reliability} options={OPTIONS.api_reliability} onChange={handleChange} />
          <SelectField label="Null %" name="null_percentage" value={form.null_percentage} options={OPTIONS.null_percentage} onChange={handleChange} />
          <SelectField label="Schema Drift" name="schema_drift" value={form.schema_drift} options={OPTIONS.schema_drift} onChange={handleChange} />
          <SelectField label="Validation Coverage" name="validation_coverage" value={form.validation_coverage} options={OPTIONS.validation_coverage} onChange={handleChange} />
        </div>

        <div className="btn-row">
          <button className="btn-primary" onClick={handleSubmit}>
            {editId ? 'Update Source' : 'Add Source'}
          </button>
          {editId && <button className="btn-secondary" onClick={cancelEdit}>Cancel</button>}
        </div>
      </div>

      {/* ── Sources Table ── */}
      {sources.length > 0 && (
        <div className="card">
          <h2>Data Sources ({sources.length})</h2>
          <div style={{ overflowX: 'auto' }}>
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
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <React.Fragment key={s.id}>
                    <tr>
                      <td>
                        <button className="btn-expand" onClick={() => toggleRow(s.id)}>
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
                          <button className="btn-primary btn-sm" onClick={() => handleEdit(s)}>Edit</button>
                          <button className="btn-danger btn-sm" onClick={() => handleDelete(s.id)}>Del</button>
                        </div>
                      </td>
                    </tr>
                    {expandedRows[s.id] && (
                      <tr className="expand-row">
                        <td colSpan={8}>
                          <div className="expand-content">
                            <span><strong>Auth:</strong> {s.auth_type}</span>
                            <span><strong>Rate Limits:</strong> {s.rate_limits}</span>
                            <span><strong>Reliability:</strong> {s.api_reliability}</span>
                            <span><strong>Nulls:</strong> {s.null_percentage}</span>
                            <span><strong>Schema Drift:</strong> {s.schema_drift}</span>
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

          <div className="btn-row" style={{ marginTop: 16 }}>
            <div className="toggle-group">
              <button className={analysisMode === 'quick' ? 'btn-primary' : 'btn-secondary'} onClick={() => setAnalysisMode('quick')}>
                Quick Analysis
              </button>
              <button className={analysisMode === 'deep' ? 'btn-accent' : 'btn-secondary'} onClick={() => setAnalysisMode('deep')}>
                Deep Analysis (AI)
              </button>
            </div>
            <button className="btn-success" onClick={handleAnalyze} disabled={loading}>
              {loading ? 'Analyzing...' : 'Analyze'}
            </button>
            <button className="btn-danger" onClick={handleClearAll}>Clear All</button>
          </div>
        </div>
      )}

      {/* ── Loading Overlay ── */}
      {loading && (
        <div className="card loading-card">
          <div className="spinner" />
          <p>{analysisMode === 'deep' ? 'Running AI-powered deep analysis...' : 'Computing scores...'}</p>
        </div>
      )}

      {/* ── Analysis Results ── */}
      {analysis && !loading && (
        <>
          {/* Score Banner */}
          <div className="card">
            <h2>Analysis Results</h2>
            <div className="score-banner">
              <div className="score-item">
                <div className="value" style={{ color: riskColor(analysis.risk_level) }}>
                  {analysis.total_score}
                </div>
                <div className="label">Complexity Score</div>
              </div>
              <div className="score-item">
                <div className="value" style={{ color: riskColor(analysis.risk_level) }}>
                  {analysis.risk_level}
                </div>
                <div className="label">Risk Level</div>
              </div>
            </div>
          </div>

          {/* Time & Cost Estimation */}
          {analysis.estimation && (
            <div className="card">
              <h2>Effort Estimation</h2>
              <div className="estimation-grid">
                <div className="est-item">
                  <div className="est-value">{analysis.estimation.estimated_weeks}</div>
                  <div className="est-label">Weeks</div>
                </div>
                <div className="est-item">
                  <div className="est-value">{analysis.estimation.engineer_count}</div>
                  <div className="est-label">Engineers</div>
                </div>
                <div className="est-item">
                  <div className="est-value">
                    {formatUSD(analysis.estimation.cost_range.low)} – {formatUSD(analysis.estimation.cost_range.high)}
                  </div>
                  <div className="est-label">Estimated Cost (USD)</div>
                </div>
              </div>
              {(analysis.estimation.volatility_factor > 1 || analysis.estimation.compound_multiplier > 1) && (
                <div className="est-factors">
                  {analysis.estimation.volatility_factor > 1 && (
                    <span className="factor-badge">Volatility: ×{analysis.estimation.volatility_factor}</span>
                  )}
                  {analysis.estimation.compound_multiplier > 1 && (
                    <span className="factor-badge">Compound risk: ×{analysis.estimation.compound_multiplier}</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Bar Chart */}
          <div className="card">
            <h2>Scores by Source</h2>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analysis.source_scores} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip
                    formatter={(val, name) => {
                      if (name === 'Nonlinear') return [`${val} / 100`, 'Nonlinear Score'];
                      return [`${val} / 100`, 'Linear Score'];
                    }}
                  />
                  <Bar dataKey="normalized_score" name="Nonlinear" radius={[6, 6, 0, 0]}>
                    {analysis.source_scores.map((entry, idx) => (
                      <Cell key={idx} fill={riskColor(entry.risk_level)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Per-source scores table */}
          <div className="card">
            <h2>Source Scores</h2>
            <table className="source-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Linear</th>
                  <th>Nonlinear</th>
                  <th>Signal Avg</th>
                  <th>Score</th>
                  <th>Risk</th>
                  <th>Compound Factors</th>
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
                        ? s.compound_factors.map((f, i) => (
                            <span key={i} className="compound-tag">{f}</span>
                          ))
                        : <span style={{ color: '#aaa' }}>—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Static Insights */}
          {analysis.insights.length > 0 && (
            <div className="card">
              <h2>Insights</h2>
              {analysis.insights.map((ins, i) => (
                <div key={i} className={`insight insight-${ins.type}`}>
                  {ins.message}
                </div>
              ))}
            </div>
          )}

          {/* AI Error Banner */}
          {analysis.ai_error && (
            <div className="card ai-error-card">
              <p>{analysis.ai_error}</p>
            </div>
          )}

          {/* ── AI Deep Insights ── */}
          {ai && (
            <>
              <div className="card ai-card">
                <h2>AI Deep Analysis</h2>

                {/* Executive Summary */}
                {ai.executive_summary && (
                  <div className="ai-summary">
                    <p>{ai.executive_summary}</p>
                  </div>
                )}
              </div>

              {/* Connector Discovery */}
              {ai.connector_discovery?.length > 0 && (
                <div className="card ai-card">
                  <h2>Connector Discovery</h2>
                  <table className="source-table">
                    <thead>
                      <tr>
                        <th>Source</th>
                        <th>Suggested Connector</th>
                        <th>Integration Method</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ai.connector_discovery.map((c, i) => (
                        <tr key={i}>
                          <td><strong>{c.source}</strong></td>
                          <td>{c.suggested_connector}</td>
                          <td>{c.integration_method}</td>
                          <td>{c.complexity_notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Integration Strategy */}
              {ai.integration_strategy && (
                <div className="card ai-card">
                  <h2>Integration Strategy</h2>
                  <div className="strategy-header">
                    <strong>Approach:</strong> {ai.integration_strategy.approach}
                  </div>
                  <p className="strategy-rationale">{ai.integration_strategy.rationale}</p>
                  {ai.integration_strategy.phases?.length > 0 && (
                    <div className="phases">
                      {ai.integration_strategy.phases.map((p, i) => (
                        <div key={i} className="phase-card">
                          <div className="phase-header">
                            <strong>Phase {i + 1}: {p.name}</strong>
                            <span className="phase-duration">{p.duration_weeks} weeks</span>
                          </div>
                          <div className="phase-sources">
                            {p.sources?.map((s, j) => <span key={j} className="source-tag">{s}</span>)}
                          </div>
                          <p className="phase-rationale">{p.rationale}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Risk Heuristics */}
              {ai.risk_heuristics?.length > 0 && (
                <div className="card ai-card">
                  <h2>AI Risk Heuristics</h2>
                  {ai.risk_heuristics.map((r, i) => (
                    <div key={i} className={`insight insight-ai-${r.severity}`}>
                      <div className="risk-header">
                        <span className={`badge badge-${r.severity}`}>{r.severity}</span>
                        <strong>{r.risk}</strong>
                      </div>
                      {r.affected_sources?.length > 0 && (
                        <div className="risk-sources">
                          Affects: {r.affected_sources.join(', ')}
                        </div>
                      )}
                      <div className="risk-mitigation">
                        <em>Mitigation:</em> {r.mitigation}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* AI Timeline & Cost */}
              {(ai.ai_timeline || ai.ai_cost_estimate) && (
                <div className="card ai-card">
                  <h2>AI Estimate</h2>
                  <div className="estimation-grid">
                    {ai.ai_timeline && (
                      <>
                        <div className="est-item">
                          <div className="est-value">{ai.ai_timeline.total_weeks}</div>
                          <div className="est-label">Weeks (AI)</div>
                        </div>
                        <div className="est-item">
                          <div className="est-value-sm">{ai.ai_timeline.team_composition}</div>
                          <div className="est-label">Team</div>
                        </div>
                      </>
                    )}
                    {ai.ai_cost_estimate && (
                      <div className="est-item">
                        <div className="est-value">
                          {formatUSD(ai.ai_cost_estimate.low_usd)} – {formatUSD(ai.ai_cost_estimate.high_usd)}
                        </div>
                        <div className="est-label">Cost (AI)</div>
                      </div>
                    )}
                  </div>
                  {ai.ai_timeline?.assumptions && (
                    <p className="est-assumptions"><em>Assumptions:</em> {ai.ai_timeline.assumptions}</p>
                  )}
                  {ai.ai_cost_estimate?.assumptions && (
                    <p className="est-assumptions"><em>Cost assumptions:</em> {ai.ai_cost_estimate.assumptions}</p>
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

function SelectField({ label, name, value, options, onChange }) {
  return (
    <div className="form-group">
      <label>{label}</label>
      <select name={name} value={value} onChange={onChange}>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}
