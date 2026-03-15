import { useState, useEffect, useRef } from 'react';

// ─── Tooltip component ────────────────────────────────────────────────────────
function Tooltip({ text, children }) {
  const [show, setShow] = useState(false);
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'help' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 14, height: 14, borderRadius: '50%', background: '#94a3b8',
        color: 'white', fontSize: 9, fontWeight: 700, flexShrink: 0
      }}>?</span>
      {show && (
        <div style={{
          position: 'absolute', bottom: '130%', left: '50%', transform: 'translateX(-50%)',
          background: '#1e293b', color: '#f1f5f9', padding: '8px 12px', borderRadius: 8,
          fontSize: 12, lineHeight: 1.5, whiteSpace: 'normal', maxWidth: 260,
          zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', pointerEvents: 'none'
        }}>
          {text}
        </div>
      )}
    </span>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const styles = {
    Critical: { background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5' },
    Attention: { background: '#fffbeb', color: '#d97706', border: '1px solid #fcd34d' },
    Safe:     { background: '#f0fdf4', color: '#16a34a', border: '1px solid #86efac' },
  };
  return (
    <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, ...styles[status] }}>
      {status}
    </span>
  );
}

// ─── Gap cell ────────────────────────────────────────────────────────────────
function GapCell({ gap }) {
  if (gap === null || gap === undefined) return <span style={{ color: '#94a3b8' }}>—</span>;
  const isUp = gap < -10;
  const isDown = gap > 10;
  return (
    <span style={{ fontWeight: 600, color: isUp ? '#dc2626' : isDown ? '#16a34a' : '#374151', display: 'flex', alignItems: 'center', gap: 4 }}>
      {isUp && <span style={{ fontSize: 14 }}>↑</span>}
      {isDown && <span style={{ fontSize: 14 }}>↓</span>}
      {gap >= 9990 ? '∞' : gap.toFixed(1)}
    </span>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, icon }) {
  const colors = {
    red:    { bg: '#fef2f2', text: '#dc2626', border: '#fca5a5' },
    yellow: { bg: '#fffbeb', text: '#d97706', border: '#fcd34d' },
    green:  { bg: '#f0fdf4', text: '#16a34a', border: '#86efac' },
    blue:   { bg: '#eff6ff', text: '#2563eb', border: '#93c5fd' },
  };
  const c = colors[color] || colors.blue;
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 12, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 130 }}>
      <span style={{ fontSize: 22 }}>{icon}</span>
      <span style={{ fontSize: 28, fontWeight: 900, color: c.text, fontFamily: 'Archivo Black, sans-serif' }}>{value}</span>
      <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>{label}</span>
    </div>
  );
}

// ─── Lead time source badge ───────────────────────────────────────────────────
function LeadTimeBadge({ source }) {
  if (source === 'product_override') return <span title="Custom override for this product" style={{ fontSize: 9, background: '#ede9fe', color: '#7c3aed', padding: '1px 5px', borderRadius: 4, marginLeft: 4, fontWeight: 700 }}>CUSTOM</span>;
  if (source === 'supplier_default') return <span title="Default from supplier settings" style={{ fontSize: 9, background: '#eff6ff', color: '#2563eb', padding: '1px 5px', borderRadius: 4, marginLeft: 4, fontWeight: 700 }}>SUPPLIER</span>;
  return <span title="No supplier match — using 30d fallback" style={{ fontSize: 9, background: '#f3f4f6', color: '#9ca3af', padding: '1px 5px', borderRadius: 4, marginLeft: 4, fontWeight: 700 }}>DEFAULT</span>;
}

const fmt = (v, decimals = 1) => {
  if (v === null || v === undefined) return '—';
  if (v >= 9990) return '∞';
  return Number(v).toFixed(decimals);
};

// ─── Supplier Management Modal ────────────────────────────────────────────────
function SupplierModal({ suppliers, onClose, onSaved }) {
  const [list, setList] = useState(suppliers.map(s => ({ ...s, editing: false, newLeadTime: s.lead_time, newName: s.name, newNotes: s.notes || '' })));
  const [newName, setNewName] = useState('');
  const [newLeadTime, setNewLeadTime] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const save = async (supplier) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/suppliers/${supplier.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: supplier.newName, lead_time: parseInt(supplier.newLeadTime), notes: supplier.newNotes })
      });
      if (!res.ok) throw new Error('Save failed');
      setList(l => l.map(s => s.id === supplier.id ? { ...s, name: supplier.newName, lead_time: parseInt(supplier.newLeadTime), notes: supplier.newNotes, editing: false } : s));
      setMsg({ type: 'success', text: 'Saved!' });
      onSaved();
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
    finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!confirm('Delete this supplier?')) return;
    try {
      await fetch(`/api/suppliers/${id}`, { method: 'DELETE' });
      setList(l => l.filter(s => s.id !== id));
      onSaved();
    } catch (e) { alert(e.message); }
  };

  const add = async () => {
    if (!newName.trim() || !newLeadTime) return alert('Name and lead time required');
    setSaving(true);
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), lead_time: parseInt(newLeadTime) })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setList(l => [...l, { ...json, editing: false, newLeadTime: json.lead_time, newName: json.name, newNotes: json.notes || '' }]);
      setNewName(''); setNewLeadTime('');
      setMsg({ type: 'success', text: `${json.name} added!` });
      onSaved();
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: 16, padding: 32, width: 560, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: 18, margin: 0 }}>🏭 Supplier Lead Times</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' }}>✕</button>
        </div>

        <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 20, background: '#f0fdf4', padding: '10px 14px', borderRadius: 8, border: '1px solid #86efac' }}>
          These lead times are automatically applied to all products matching each supplier name. You can still override individual products directly in the table.
        </p>

        {msg && (
          <div style={{ padding: '8px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, background: msg.type === 'success' ? '#f0fdf4' : '#fef2f2', color: msg.type === 'success' ? '#16a34a' : '#dc2626' }}>
            {msg.text}
          </div>
        )}

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>Supplier Name</th>
              <th style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#6b7280', padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>Lead Time (days)</th>
              <th style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#6b7280', padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map(s => (
              <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '8px 8px' }}>
                  {s.editing
                    ? <input value={s.newName} onChange={e => setList(l => l.map(x => x.id === s.id ? { ...x, newName: e.target.value } : x))}
                        style={{ border: '1px solid #93c5fd', borderRadius: 6, padding: '4px 8px', width: '100%', fontSize: 13 }} />
                    : <span style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</span>
                  }
                </td>
                <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                  {s.editing
                    ? <input type="number" value={s.newLeadTime} onChange={e => setList(l => l.map(x => x.id === s.id ? { ...x, newLeadTime: e.target.value } : x))}
                        style={{ border: '1px solid #93c5fd', borderRadius: 6, padding: '4px 8px', width: 70, fontSize: 13, textAlign: 'center' }} />
                    : <span style={{ fontWeight: 700, fontSize: 14, color: s.lead_time > 30 ? '#d97706' : '#16a34a' }}>{s.lead_time}d</span>
                  }
                </td>
                <td style={{ padding: '8px 8px', textAlign: 'center', display: 'flex', gap: 6, justifyContent: 'center' }}>
                  {s.editing ? (
                    <>
                      <button onClick={() => save(s)} disabled={saving} style={{ padding: '4px 12px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Save</button>
                      <button onClick={() => setList(l => l.map(x => x.id === s.id ? { ...x, editing: false, newLeadTime: x.lead_time, newName: x.name } : x))} style={{ padding: '4px 10px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setList(l => l.map(x => x.id === s.id ? { ...x, editing: true } : x))} style={{ padding: '4px 12px', background: '#eff6ff', color: '#2563eb', border: '1px solid #93c5fd', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Edit</button>
                      <button onClick={() => del(s.id)} style={{ padding: '4px 10px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Delete</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Add new supplier */}
        <div style={{ background: '#f8fafc', borderRadius: 10, padding: 16, border: '1px solid #e2e8f0' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 10 }}>Add New Supplier</p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Supplier name" style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 12px', fontSize: 13 }} />
            <input type="number" value={newLeadTime} onChange={e => setNewLeadTime(e.target.value)} placeholder="Days" style={{ width: 80, border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 12px', fontSize: 13, textAlign: 'center' }} />
            <button onClick={add} disabled={saving} style={{ padding: '8px 18px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Add</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReplenishmentDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importedBy, setImportedBy] = useState('');
  const [editingLeadTime, setEditingLeadTime] = useState(null);
  const [savingLeadTime, setSavingLeadTime] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const fileInputRef = useRef();

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/dashboard/replenishment');
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    const saved = localStorage.getItem('replenishment_imported_by');
    if (saved) setImportedBy(saved);
  }, []);

  useEffect(() => { fetch('/api/migrate-replenishment').catch(() => {}); }, []);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!importedBy.trim()) { alert('Please enter your name before uploading.'); e.target.value = ''; return; }
    setImporting(true); setImportResult(null);
    localStorage.setItem('replenishment_imported_by', importedBy);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('imported_by', importedBy);
    try {
      const res = await fetch('/api/forecast/import', { method: 'POST', body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Import failed');
      setImportResult({ type: 'success', message: `✅ Imported ${json.inserted} products (${json.skipped} skipped). Date: ${new Date(json.importDate).toLocaleDateString()}` });
      await fetchData();
    } catch (err) { setImportResult({ type: 'error', message: `❌ ${err.message}` }); }
    finally { setImporting(false); e.target.value = ''; }
  };

  const handleExportPrevious = async () => {
    try {
      const res = await fetch('/api/forecast/last');
      if (!res.ok) { alert((await res.json()).error || 'No previous forecast'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `forecast_backup_${new Date().toISOString().split('T')[0]}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { alert('Export failed: ' + err.message); }
  };

  const saveLeadTime = async () => {
    if (!editingLeadTime) return;
    const val = editingLeadTime.value === '' || editingLeadTime.value === null ? null : parseInt(editingLeadTime.value);
    if (val !== null && isNaN(val)) { alert('Lead time must be a number'); return; }
    setSavingLeadTime(true);
    try {
      const res = await fetch(`/api/products/${editingLeadTime.id}/lead-time`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_time: val })
      });
      if (!res.ok) throw new Error('Failed to save');
      setEditingLeadTime(null);
      await fetchData();
    } catch (err) { alert('Error saving lead time: ' + err.message); }
    finally { setSavingLeadTime(false); }
  };

  const filtered = data?.products?.filter(p => {
    const matchStatus = filterStatus === 'ALL' || p.safetyStatus === filterStatus;
    const q = search.toLowerCase();
    const matchSearch = !q || p.productCode?.toLowerCase().includes(q) || p.name?.toLowerCase().includes(q) || p.supplier?.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  }) || [];

  const thStyle = { padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#374151', background: '#f9fafb', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 10 };
  const tdStyle = { padding: '10px 12px', fontSize: 12, color: '#374151', borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap' };

  const rowBg = (p) => p.safetyStatus === 'Critical' ? '#fef2f2' : p.safetyStatus === 'Attention' ? '#fffbeb' : '#ffffff';
  const rowBorderLeft = (p) => {
    if (p.safetyStatus === 'Critical') return '3px solid #dc2626';
    if (p.projectedDaysOfStock < 45) return '3px solid #f97316';
    if (p.safetyStatus === 'Attention') return '3px solid #f59e0b';
    return '3px solid transparent';
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 48 }}>📊</div>
      <p style={{ color: '#6b7280' }}>Calculating replenishment data...</p>
    </div>
  );

  if (error) return (
    <div style={{ padding: 32 }}>
      <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, padding: 24, color: '#dc2626' }}>
        <strong>Error loading data:</strong> {error}<br /><br />
        <button onClick={fetchData} style={{ padding: '8px 16px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Retry</button>
        <span style={{ marginLeft: 12, fontSize: 12, color: '#6b7280' }}>
          First time? Run migration: <a href="/api/migrate-replenishment" target="_blank" style={{ color: '#2563eb' }}>/api/migrate-replenishment</a>
        </span>
      </div>
    </div>
  );

  const meta = data?.meta || {};
  const suppliers = meta.suppliers || [];

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1800, margin: '0 auto' }}>

      {showSupplierModal && (
        <SupplierModal
          suppliers={suppliers}
          onClose={() => setShowSupplierModal(false)}
          onSaved={fetchData}
        />
      )}

      {/* ── Header ── */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontFamily: 'Archivo Black, sans-serif', color: '#1f2937', marginBottom: 4 }}>
            📦 Stock Risk & Replenishment Dashboard
          </h1>
          <p style={{ color: '#6b7280', fontSize: 13 }}>
            Planning tool — Stock coverage analysis + Salesforce forecast integration
            {meta.calculatedAt && <span style={{ marginLeft: 12, color: '#94a3b8' }}>Updated: {new Date(meta.calculatedAt).toLocaleTimeString()}</span>}
          </p>
        </div>
        <button
          onClick={() => setShowSupplierModal(true)}
          style={{ padding: '10px 20px', background: 'white', border: '1px solid #d1d5db', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#374151', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          🏭 Manage Suppliers & Lead Times
        </button>
      </div>

      {/* ── Supplier quick-view pills ── */}
      {suppliers.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {suppliers.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', border: '1px solid #e5e7eb', borderRadius: 20, padding: '4px 14px', fontSize: 12 }}>
              <span style={{ fontWeight: 600, color: '#374151' }}>{s.name}</span>
              <span style={{ fontWeight: 700, color: s.lead_time > 30 ? '#d97706' : '#16a34a' }}>{s.lead_time}d</span>
            </div>
          ))}
          <button onClick={() => setShowSupplierModal(true)} style={{ background: 'none', border: '1px dashed #d1d5db', borderRadius: 20, padding: '4px 14px', fontSize: 12, color: '#9ca3af', cursor: 'pointer' }}>
            + Edit
          </button>
        </div>
      )}

      {/* ── Stat cards ── */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <StatCard label="Total Products" value={meta.totalProducts || 0} color="blue" icon="📋" />
        <StatCard label="Critical (<45d)" value={meta.critical || 0} color="red" icon="🔴" />
        <StatCard label="Attention (45–90d)" value={meta.attention || 0} color="yellow" icon="🟡" />
        <StatCard label="Safe (>90d)" value={meta.safe || 0} color="green" icon="🟢" />
        {meta.lastForecastImport && (
          <div style={{ background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 12, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 22 }}>📁</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#2563eb' }}>Last Forecast Import</span>
            <span style={{ fontSize: 11, color: '#3b82f6' }}>
              {new Date(meta.lastForecastImport.import_date).toLocaleDateString()} by {meta.lastForecastImport.imported_by}
            </span>
          </div>
        )}
      </div>

      {/* ── Import panel ── */}
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 24, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Your name (Imported by)</label>
          <input type="text" value={importedBy} onChange={e => setImportedBy(e.target.value)} placeholder="e.g. John Smith"
            style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 12px', fontSize: 13, width: 200 }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Salesforce Forecast (.xlsx)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => fileInputRef.current?.click()} disabled={importing}
              style={{ padding: '9px 18px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, cursor: importing ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: importing ? 0.7 : 1 }}>
              {importing ? '⏳ Importing...' : '⬆️ Import Forecast'}
            </button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileSelect} style={{ display: 'none' }} />
            <button onClick={handleExportPrevious}
              style={{ padding: '9px 18px', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              ⬇️ Export Previous
            </button>
          </div>
        </div>
        <button onClick={fetchData}
          style={{ padding: '9px 18px', background: '#f0fdf4', color: '#16a34a', border: '1px solid #86efac', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          🔄 Refresh
        </button>
        {importResult && (
          <div style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, background: importResult.type === 'success' ? '#f0fdf4' : '#fef2f2', color: importResult.type === 'success' ? '#16a34a' : '#dc2626', border: `1px solid ${importResult.type === 'success' ? '#86efac' : '#fca5a5'}` }}>
            {importResult.message}
          </div>
        )}
      </div>

      {/* ── Filters ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {['ALL', 'Critical', 'Attention', 'Safe'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: filterStatus === s ? 'none' : '1px solid #e5e7eb',
              background: filterStatus === s ? (s === 'Critical' ? '#dc2626' : s === 'Attention' ? '#d97706' : s === 'Safe' ? '#16a34a' : '#2563eb') : 'white',
              color: filterStatus === s ? 'white' : '#374151'
            }}>{s}</button>
          ))}
        </div>
        <input type="text" placeholder="Search product, code or supplier..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '7px 14px', fontSize: 13, width: 280 }} />
        <span style={{ fontSize: 12, color: '#6b7280' }}>Showing {filtered.length} of {data?.products?.length || 0} products</span>
      </div>

      {/* ── Legend ── */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 11, color: '#6b7280', flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: '#fef2f2', border: '1px solid #fca5a5', display: 'inline-block', borderRadius: 2 }}></span>Critical &lt; 45d</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: '#fffbeb', border: '1px solid #fcd34d', display: 'inline-block', borderRadius: 2 }}></span>Attention 45–90d</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: '#f0fdf4', border: '1px solid #86efac', display: 'inline-block', borderRadius: 2 }}></span>Safe &gt; 90d</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: 'transparent', border: '3px solid #f97316', display: 'inline-block', borderRadius: 2 }}></span>Projected risk</span>
        <span>Lead time: <span style={{ background: '#ede9fe', color: '#7c3aed', padding: '1px 5px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>CUSTOM</span> = product override &nbsp;|&nbsp; <span style={{ background: '#eff6ff', color: '#2563eb', padding: '1px 5px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>SUPPLIER</span> = supplier default &nbsp;|&nbsp; <span style={{ background: '#f3f4f6', color: '#9ca3af', padding: '1px 5px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>DEFAULT</span> = 30d fallback</span>
      </div>

      {/* ── Table ── */}
      <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
          <thead>
            <tr>
              <th style={thStyle}>Product Code</th>
              <th style={thStyle}>Product Name</th>
              <th style={{ ...thStyle, textAlign: 'right' }}><Tooltip text="Current physical stock in litres">Real Stock (L)</Tooltip></th>
              <th style={{ ...thStyle, textAlign: 'right' }}><Tooltip text="AvgDailyDemand × LeadTime × 1.5 — buffer to cover lead time with 50% safety margin">Safety Stock (L)</Tooltip></th>
              <th style={{ ...thStyle, textAlign: 'right' }}><Tooltip text="Total litres sold (remove/Shopify) in the last 30 days ÷ 30">Avg Daily (L/d)</Tooltip></th>
              <th style={{ ...thStyle, textAlign: 'right' }}><Tooltip text="Forecast volume for 120 days from Salesforce import">Forecast 120d (L)</Tooltip></th>
              <th style={{ ...thStyle, textAlign: 'right' }}><Tooltip text="Forecast 120d ÷ 120 — daily rate from Salesforce">Forecast Daily (L/d)</Tooltip></th>
              <th style={{ ...thStyle, textAlign: 'right' }}><Tooltip text="MAX(Avg Daily, Forecast Daily) — uses the higher demand signal for planning">Projected Daily (L/d)</Tooltip></th>
              <th style={{ ...thStyle, textAlign: 'right' }}><Tooltip text="Real Stock ÷ Projected Daily — worst-case days until stock-out">Projected Days</Tooltip></th>
              <th style={{ ...thStyle, textAlign: 'right' }}><Tooltip text="Real Stock ÷ Avg Daily — days based on historical consumption only">Days of Stock</Tooltip></th>
              <th style={{ ...thStyle, textAlign: 'right' }}><Tooltip text="Projected Days − Days of Stock. ↑ red = forecast demand is higher risk. ↓ green = safer than history suggests.">Gap</Tooltip></th>
              <th style={thStyle}><Tooltip text="Critical = stock < 45d | Attention = 45–90d | Safe = >90d (historical demand)">Safety Status</Tooltip></th>
              <th style={{ ...thStyle, textAlign: 'right' }}><Tooltip text="Supplier lead time. Pulled from Supplier settings, or overridden per product (click to edit). CUSTOM badge = product-level override.">Lead Time (d)</Tooltip></th>
              <th style={thStyle}>Supplier</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={14} style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>No products found for the selected filters.</td></tr>
            ) : (
              filtered.map(p => (
                <tr key={p.id} style={{ background: rowBg(p), borderLeft: rowBorderLeft(p) }}>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 11, color: '#4b5563' }}>{p.productCode}</td>
                  <td style={{ ...tdStyle, fontWeight: 600, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.name}
                    {p.noSalesData && <span title="No sales in last 30 days — using 0.1 L/d minimum" style={{ marginLeft: 6, fontSize: 10, color: '#94a3b8', fontWeight: 400 }}>(no sales)</span>}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{fmt(p.realStock, 1)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: '#6b7280' }}>{fmt(p.safetyStockLevel, 1)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(p.avgDailyDemand, 3)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: p.hasForecast ? '#2563eb' : '#d1d5db' }}>{p.hasForecast ? fmt(p.forecast120Days, 1) : '—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: p.hasForecast ? '#2563eb' : '#d1d5db' }}>{p.hasForecast ? fmt(p.forecastDaily, 3) : '—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{fmt(p.projectedDaily, 3)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: p.projectedDaysOfStock < 45 ? '#dc2626' : p.projectedDaysOfStock < 90 ? '#d97706' : '#16a34a' }}>
                    {p.projectedDaysOfStock >= 9990 ? '∞' : fmt(p.projectedDaysOfStock, 0)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: p.daysOfStockActual < 45 ? '#dc2626' : p.daysOfStockActual < 90 ? '#d97706' : '#16a34a' }}>
                    {p.daysOfStockActual >= 9990 ? '∞' : fmt(p.daysOfStockActual, 0)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <GapCell gap={p.hasForecast ? p.gap : null} />
                  </td>
                  <td style={tdStyle}><StatusBadge status={p.safetyStatus} /></td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {editingLeadTime?.id === p.id ? (
                      <span style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'flex-end' }}>
                        <input
                          type="number"
                          value={editingLeadTime.value ?? ''}
                          placeholder="auto"
                          onChange={e => setEditingLeadTime({ ...editingLeadTime, value: e.target.value })}
                          onKeyDown={e => { if (e.key === 'Enter') saveLeadTime(); if (e.key === 'Escape') setEditingLeadTime(null); }}
                          autoFocus
                          style={{ width: 65, border: '1px solid #3b82f6', borderRadius: 6, padding: '2px 6px', fontSize: 12, textAlign: 'right' }}
                        />
                        <button onClick={saveLeadTime} disabled={savingLeadTime} style={{ padding: '2px 8px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11 }}>✓</button>
                        <button onClick={() => setEditingLeadTime(null)} style={{ padding: '2px 8px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11 }}>✗</button>
                      </span>
                    ) : (
                      <span
                        onClick={() => setEditingLeadTime({ id: p.id, value: p.leadTimeSource === 'product_override' ? p.leadTime : '' })}
                        title={`Click to override. Current: ${p.leadTime}d (${p.leadTimeSource === 'product_override' ? 'custom override' : p.leadTimeSource === 'supplier_default' ? `from supplier "${p.supplier}"` : '30d fallback'}). Leave blank to reset to supplier default.`}
                        style={{ cursor: 'pointer', padding: '2px 8px', borderRadius: 6, display: 'inline-flex', alignItems: 'center' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        {p.leadTime}
                        <LeadTimeBadge source={p.leadTimeSource} />
                      </span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, color: '#6b7280', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.supplier || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 16, fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
        Demand = last 30 days of transactions (remove + Shopify). Min demand = 0.1 L/d when no sales. Lead time: product override &gt; supplier default &gt; 30d fallback.
      </p>
    </div>
  );
}


