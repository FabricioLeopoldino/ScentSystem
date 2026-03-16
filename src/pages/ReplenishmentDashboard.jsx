import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';

// ─── Tooltip ─────────────────────────────────────────────────────────────────
function Tooltip({ text, children }) {
  const [pos, setPos] = useState(null);
  const ref = useRef();

  const handleEnter = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos({ x: rect.left + rect.width / 2, y: rect.top - 8 });
    }
  };

  return (
    <span
      ref={ref}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'help' }}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setPos(null)}
    >
      {children}
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, borderRadius: '50%', background: '#94a3b8', color: 'white', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>?</span>
      {pos && (
        <div style={{
          position: 'fixed',
          left: pos.x,
          top: pos.y,
          transform: 'translateX(-50%) translateY(-100%)',
          background: '#1e293b',
          color: '#f1f5f9',
          padding: '8px 12px',
          borderRadius: 8,
          fontSize: 12,
          lineHeight: 1.5,
          whiteSpace: 'normal',
          maxWidth: 260,
          zIndex: 99999,
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          pointerEvents: 'none',
        }}>
          {text}
          <div style={{ position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)', width: 10, height: 10, background: '#1e293b', clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }} />
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
    Safe:      { background: '#f0fdf4', color: '#16a34a', border: '1px solid #86efac' },
  };
  return <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, ...styles[status] }}>{status}</span>;
}

// ─── Gap cell ─────────────────────────────────────────────────────────────────
function GapCell({ gap }) {
  if (gap === null || gap === undefined) return <span style={{ color: '#94a3b8' }}>—</span>;
  const isUp = gap < -10;
  const isDown = gap > 10;
  return (
    <span style={{ fontWeight: 600, color: isUp ? '#dc2626' : isDown ? '#16a34a' : '#374151', display: 'flex', alignItems: 'center', gap: 4 }}>
      {isUp && <span style={{ fontSize: 14 }}>↑</span>}
      {isDown && <span style={{ fontSize: 14 }}>↓</span>}
      {gap >= 9990 ? '0' : gap.toFixed(1)}
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

// ─── Data Confidence badge ───────────────────────────────────────────────────
function ConfidenceBadge({ confidence, spikesRemoved, cleanDays }) {
  const cfg = {
    high:               { bg: '#f0fdf4', color: '#16a34a', label: '●●●● High',        tip: `${cleanDays} clean days of history. Forecast 30% + History 70%.` },
    medium:             { bg: '#fffbeb', color: '#d97706', label: '●●●○ Medium',       tip: `${cleanDays} clean days of history. Forecast 50% + History 50%.` },
    low:                { bg: '#fff7ed', color: '#ea580c', label: '●●○○ Low',          tip: `${cleanDays} clean days of history. Forecast 70% + History 30%.` },
    very_low:           { bg: '#fef2f2', color: '#dc2626', label: '●○○○ Very Low',     tip: `${cleanDays} clean day(s) of history. Forecast 90% + History 10%.` },
    forecast_only:      { bg: '#eff6ff', color: '#2563eb', label: '◆ Forecast Only',   tip: 'No sales history. Using Salesforce forecast × 0.8 (conservative).' },
    no_data:            { bg: '#f9fafb', color: '#9ca3af', label: '○ No Data',         tip: 'No sales history and no forecast. Using minimum 0.1 L/d.' },
    high_no_forecast:   { bg: '#f0fdf4', color: '#16a34a', label: '●●●● History',     tip: `${cleanDays} clean days. No forecast imported yet.` },
    medium_no_forecast: { bg: '#fffbeb', color: '#d97706', label: '●●○○ History',     tip: `${cleanDays} clean days. No forecast imported yet.` },
    low_no_forecast:    { bg: '#fff7ed', color: '#ea580c', label: '●○○○ History',     tip: `${cleanDays} clean day(s). No forecast imported yet.` },
  };
  const c = cfg[confidence] || cfg.no_data;
  const spikeNote = spikesRemoved > 0 ? ` (${spikesRemoved} spike day${spikesRemoved > 1 ? 's' : ''} smoothed)` : '';
  return (
    <span title={c.tip + spikeNote} style={{ fontSize: 10, background: c.bg, color: c.color, padding: '2px 7px', borderRadius: 4, fontWeight: 700, whiteSpace: 'nowrap', cursor: 'help' }}>
      {c.label}{spikesRemoved > 0 ? ' ⚡' : ''}
    </span>
  );
}

// FIX 2: fmt — never shows ∞
const fmt = (v, decimals = 1) => {
  if (v === null || v === undefined) return '—';
  if (v >= 9990) return '0';
  return Number(v).toFixed(decimals);
};

const fmtDays = (v) => {
  if (v === null || v === undefined) return '—';
  if (v >= 9990) return '0';
  return Math.round(v).toString();
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
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
          Lead times are automatically applied to all products by supplier name. No manual override needed per product.
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
                    ? <input value={s.newName} onChange={e => setList(l => l.map(x => x.id === s.id ? { ...x, newName: e.target.value } : x))} style={{ border: '1px solid #93c5fd', borderRadius: 6, padding: '4px 8px', width: '100%', fontSize: 13 }} />
                    : <span style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</span>
                  }
                </td>
                <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                  {s.editing
                    ? <input type="number" value={s.newLeadTime} onChange={e => setList(l => l.map(x => x.id === s.id ? { ...x, newLeadTime: e.target.value } : x))} style={{ border: '1px solid #93c5fd', borderRadius: 6, padding: '4px 8px', width: 70, fontSize: 13, textAlign: 'center' }} />
                    : <span style={{ fontWeight: 700, fontSize: 14, color: s.lead_time > 30 ? '#d97706' : '#16a34a' }}>{s.lead_time}d</span>
                  }
                </td>
                <td style={{ padding: '8px 8px', textAlign: 'center', display: 'flex', gap: 6, justifyContent: 'center' }}>
                  {s.editing ? (
                    <>
                      <button onClick={() => save(s)} disabled={saving} style={{ padding: '4px 12px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Save</button>
                      <button onClick={() => setList(l => l.map(x => x.id === s.id ? { ...x, editing: false } : x))} style={{ padding: '4px 10px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Cancel</button>
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
  const [filterCategory, setFilterCategory] = useState('OILS'); // FIX 1: default OILS
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importedBy, setImportedBy] = useState('');
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const fileInputRef = useRef();

  const fetchData = async () => {
    setLoading(true); setError(null);
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

  // ── Export full replenishment report as professional Excel
  const handleExportReport = () => {
    if (!data?.products?.length) return alert('No data to export');

    const allProducts = data.products;
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
    const filterInfo = [
      filterCategory !== 'ALL' ? `Category: ${filterCategory}` : null,
      filterStatus !== 'ALL' ? `Status: ${filterStatus}` : null,
      search ? `Search: "${search}"` : null,
    ].filter(Boolean).join(' | ') || 'All Products';

    const wb = XLSX.utils.book_new();

    // Reusable sheet builder
    const buildSheet = (rows, title, subtitle) => {
      const ws = XLSX.utils.aoa_to_sheet([
        [title],
        [subtitle],
        [`Generated: ${dateStr} ${timeStr}   |   Products: ${rows.length}   |   Critical: ${rows.filter(p => p.safetyStatus === 'Critical').length}   |   Attention: ${rows.filter(p => p.safetyStatus === 'Attention').length}   |   Safe: ${rows.filter(p => p.safetyStatus === 'Safe').length}`],
        [],
        ['Product Code', 'Product Name', 'Category', 'Supplier', 'Real Stock (L)', 'Safety Stock (L)', 'Avg Daily (L/d)', 'Sold 30d (L)', 'Forecast 120d (L)', 'Forecast Daily (L/d)', 'Projected Daily (L/d)', 'Projected Days', 'Days of Stock', 'Gap (d)', 'Safety Status', 'Lead Time (d)'],
        ...rows.map(p => [
          p.productCode || '',
          p.name || '',
          p.category || '',
          p.supplier || '',
          p.realStock ?? 0,
          p.safetyStockLevel ?? 0,
          p.avgDailyDemand ?? 0,
          p.totalSold30d ?? 0,
          p.hasForecast ? (p.forecast120Days ?? '') : '',
          p.hasForecast ? (p.forecastDaily ?? '') : '',
          p.projectedDaily ?? 0,
          p.projectedDaysOfStock >= 9990 ? 0 : Math.round(p.projectedDaysOfStock ?? 0),
          p.daysOfStockActual >= 9990 ? 0 : Math.round(p.daysOfStockActual ?? 0),
          p.hasForecast ? (p.gap >= 9990 ? 0 : (p.gap ?? '')) : '',
          p.safetyStatus || '',
          p.leadTime ?? 30,
        ])
      ]);
      ws['!cols'] = [{ wch: 14 }, { wch: 36 }, { wch: 18 }, { wch: 20 }, { wch: 14 }, { wch: 15 }, { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 20 }, { wch: 15 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 13 }];
      ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 15 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 15 } }, { s: { r: 2, c: 0 }, e: { r: 2, c: 15 } }];
      return ws;
    };

    // Sheet 1: Current view (what you see on screen — respects active filters)
    XLSX.utils.book_append_sheet(wb, buildSheet(filtered, 'SCENT STOCK MANAGER — Replenishment Report', `Current View — ${filterInfo}`), 'Current View');

    // Sheet 2: Critical (all products)
    const criticalAll = allProducts.filter(p => p.safetyStatus === 'Critical');
    if (criticalAll.length > 0) XLSX.utils.book_append_sheet(wb, buildSheet(criticalAll, 'CRITICAL PRODUCTS — Action Required', `${criticalAll.length} products with Days of Stock < 45 days`), 'Critical');

    // Sheet 3: Attention (all products)
    const attentionAll = allProducts.filter(p => p.safetyStatus === 'Attention');
    if (attentionAll.length > 0) XLSX.utils.book_append_sheet(wb, buildSheet(attentionAll, 'ATTENTION — Monitor Closely', `${attentionAll.length} products with Days of Stock 45–90 days`), 'Attention');

    // Sheet 4: Full report (all products)
    XLSX.utils.book_append_sheet(wb, buildSheet(allProducts, 'SCENT STOCK MANAGER — Full Report', `All ${allProducts.length} products`), 'All Products');

    XLSX.writeFile(wb, `Replenishment_Report_${now.toISOString().split('T')[0]}.xlsx`);
  };

  // FIX 1: unique categories from data
  const allCategories = ['ALL', ...Array.from(new Set((data?.products || []).map(p => p.category).filter(Boolean))).sort()];

  const filtered = (data?.products || []).filter(p => {
    const matchCat    = filterCategory === 'ALL' || p.category === filterCategory;
    const matchStatus = filterStatus === 'ALL' || p.safetyStatus === filterStatus;
    const q = search.toLowerCase();
    const matchSearch = !q || p.productCode?.toLowerCase().includes(q) || p.name?.toLowerCase().includes(q) || p.supplier?.toLowerCase().includes(q);
    return matchCat && matchStatus && matchSearch;
  });

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
          First time? Run: <a href="/api/migrate-replenishment" target="_blank" style={{ color: '#2563eb' }}>/api/migrate-replenishment</a>
        </span>
      </div>
    </div>
  );

  const meta = data?.meta || {};
  const suppliers = meta.suppliers || [];
  const filteredForStats = filterCategory === 'ALL' ? (data?.products || []) : (data?.products || []).filter(p => p.category === filterCategory);

  return (
    // FIX 3: full width — no maxWidth constraint
    <div style={{ padding: '24px 32px' }}>

      {showSupplierModal && (
        <SupplierModal suppliers={suppliers} onClose={() => setShowSupplierModal(false)} onSaved={fetchData} />
      )}

      {/* ── Header ── */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontFamily: 'Archivo Black, sans-serif', color: '#1f2937', marginBottom: 4 }}>
            📦 Stock Risk & Replenishment Dashboard
          </h1>
          <p style={{ color: '#6b7280', fontSize: 13 }}>
            Planning tool — Stock coverage + Salesforce forecast
            {meta.calculatedAt && <span style={{ marginLeft: 12, color: '#94a3b8' }}>Updated: {new Date(meta.calculatedAt).toLocaleTimeString()}</span>}
          </p>
        </div>
        <button onClick={() => setShowSupplierModal(true)}
          style={{ padding: '10px 20px', background: 'white', border: '1px solid #d1d5db', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#374151', display: 'flex', alignItems: 'center', gap: 8 }}>
          🏭 Manage Suppliers & Lead Times
        </button>
      </div>

      {/* ── Supplier pills ── */}
      {suppliers.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {suppliers.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', border: '1px solid #e5e7eb', borderRadius: 20, padding: '4px 14px', fontSize: 12 }}>
              <span style={{ fontWeight: 600, color: '#374151' }}>{s.name}</span>
              <span style={{ fontWeight: 700, color: s.lead_time > 30 ? '#d97706' : '#16a34a' }}>{s.lead_time}d</span>
            </div>
          ))}
          <button onClick={() => setShowSupplierModal(true)} style={{ background: 'none', border: '1px dashed #d1d5db', borderRadius: 20, padding: '4px 14px', fontSize: 12, color: '#9ca3af', cursor: 'pointer' }}>+ Edit</button>
        </div>
      )}

      {/* ── Stat cards ── */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <StatCard label={filterCategory === 'ALL' ? 'Total Products' : `Total ${filterCategory}`} value={filteredForStats.length} color="blue" icon="📋" />
        <StatCard label="Critical (<45d)" value={filteredForStats.filter(d => d.safetyStatus === 'Critical').length} color="red" icon="🔴" />
        <StatCard label="Attention (45–90d)" value={filteredForStats.filter(d => d.safetyStatus === 'Attention').length} color="yellow" icon="🟡" />
        <StatCard label="Safe (>90d)" value={filteredForStats.filter(d => d.safetyStatus === 'Safe').length} color="green" icon="🟢" />
        {meta.lastForecastImport && (
          <div style={{ background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 12, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 22 }}>📁</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#2563eb' }}>Last Forecast Import</span>
            <span style={{ fontSize: 11, color: '#3b82f6' }}>{new Date(meta.lastForecastImport.import_date).toLocaleDateString()} by {meta.lastForecastImport.imported_by}</span>
          </div>
        )}
      </div>

      {/* ── Import panel ── */}
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
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

        {/* Export Report button */}
        <button
          onClick={handleExportReport}
          disabled={!data?.products?.length}
          style={{ padding: '9px 18px', background: '#f0fdf4', color: '#16a34a', border: '1px solid #86efac', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          📊 Export Report (.xlsx)
        </button>
        {importResult && (
          <div style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, background: importResult.type === 'success' ? '#f0fdf4' : '#fef2f2', color: importResult.type === 'success' ? '#16a34a' : '#dc2626', border: `1px solid ${importResult.type === 'success' ? '#86efac' : '#fca5a5'}` }}>
            {importResult.message}
          </div>
        )}
      </div>

      {/* ── Filters ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* FIX 1: Category filter */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7280' }}>Category:</span>
          {allCategories.map(cat => (
            <button key={cat} onClick={() => setFilterCategory(cat)} style={{
              padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: filterCategory === cat ? 'none' : '1px solid #e5e7eb',
              background: filterCategory === cat ? '#1f2937' : 'white',
              color: filterCategory === cat ? 'white' : '#374151'
            }}>{cat}</button>
          ))}
        </div>

        <div style={{ width: 1, height: 24, background: '#e5e7eb' }} />

        {/* Status filter */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7280' }}>Status:</span>
          {['ALL', 'Critical', 'Attention', 'Safe'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: filterStatus === s ? 'none' : '1px solid #e5e7eb',
              background: filterStatus === s ? (s === 'Critical' ? '#dc2626' : s === 'Attention' ? '#d97706' : s === 'Safe' ? '#16a34a' : '#2563eb') : 'white',
              color: filterStatus === s ? 'white' : '#374151'
            }}>{s}</button>
          ))}
        </div>

        <input type="text" placeholder="Search product, code or supplier..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '7px 14px', fontSize: 13, width: 280 }} />

        <span style={{ fontSize: 12, color: '#6b7280' }}>Showing {filtered.length} of {(data?.products || []).length} products</span>
      </div>

      {/* ── Legend ── */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: 11, color: '#6b7280', flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: '#fef2f2', border: '1px solid #fca5a5', display: 'inline-block', borderRadius: 2 }}></span>Critical &lt;45d</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: '#fffbeb', border: '1px solid #fcd34d', display: 'inline-block', borderRadius: 2 }}></span>Attention 45–90d</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: '#f0fdf4', border: '1px solid #86efac', display: 'inline-block', borderRadius: 2 }}></span>Safe &gt;90d</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: 'transparent', border: '3px solid #f97316', display: 'inline-block', borderRadius: 2 }}></span>Projected risk</span>
        <span style={{ color: '#94a3b8' }}>Lead time = automatic from supplier settings</span>
        <span style={{ color: '#94a3b8' }}>⚡ = spike days detected and smoothed | Data Confidence = blend of history + Salesforce forecast</span>
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
              <th style={{ ...thStyle, textAlign: 'right' }}><Tooltip text="Total litres sold (remove/Shopify) in last 30 days ÷ 30">Avg Daily (L/d)</Tooltip></th>
              <th style={{ ...thStyle, textAlign: 'right' }}><Tooltip text="Forecast volume for 120 days imported from Salesforce">Forecast 120d (L)</Tooltip></th>
              <th style={{ ...thStyle, textAlign: 'right' }}><Tooltip text="Forecast 120d ÷ 120 — daily rate from Salesforce">Forecast Daily (L/d)</Tooltip></th>
              <th style={{ ...thStyle, textAlign: 'right' }}><Tooltip text="MAX(Avg Daily, Forecast Daily) — uses the higher demand signal">Projected Daily (L/d)</Tooltip></th>
              <th style={{ ...thStyle, textAlign: 'right' }}><Tooltip text="Real Stock ÷ Projected Daily — worst-case days until stock-out">Projected Days</Tooltip></th>
              <th style={{ ...thStyle, textAlign: 'right' }}><Tooltip text="Real Stock ÷ Avg Daily — days based on historical consumption">Days of Stock</Tooltip></th>
              <th style={{ ...thStyle, textAlign: 'right' }}><Tooltip text="Projected Days − Days of Stock. ↑ red = forecast risk higher. ↓ green = safer than history.">Gap</Tooltip></th>
              <th style={thStyle}><Tooltip text="Critical = stock < 45d | Attention = 45–90d | Safe = >90d">Safety Status</Tooltip></th>
              <th style={{ ...thStyle, textAlign: 'right' }}><Tooltip text="Lead time in days — pulled automatically from supplier. Change via 🏭 Manage Suppliers.">Lead Time (d)</Tooltip></th>
              <th style={thStyle}>Supplier</th>
              <th style={thStyle}><Tooltip text="Data confidence shows how reliable the Avg Daily Demand is. High = 25+ clean days of history. ⚡ = spike days were detected and smoothed automatically.">Data Confidence</Tooltip></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={15} style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>No products found for the selected filters.</td></tr>
            ) : (
              filtered.map(p => (
                <tr key={p.id} style={{ background: rowBg(p), borderLeft: rowBorderLeft(p) }}>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 11, color: '#4b5563' }}>{p.productCode}</td>
                  <td style={{ ...tdStyle, fontWeight: 600, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
                    {fmtDays(p.projectedDaysOfStock)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: p.daysOfStockActual < 45 ? '#dc2626' : p.daysOfStockActual < 90 ? '#d97706' : '#16a34a' }}>
                    {fmtDays(p.daysOfStockActual)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <GapCell gap={p.hasForecast ? p.gap : null} />
                  </td>
                  <td style={tdStyle}><StatusBadge status={p.safetyStatus} /></td>
                  {/* FIX 4: read-only, from supplier */}
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: '#374151' }}>
                    {p.leadTime}
                  </td>
                  <td style={{ ...tdStyle, color: '#6b7280', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.supplier || '—'}</td>
                  <td style={tdStyle}>
                    <ConfidenceBadge confidence={p.dataConfidence} spikesRemoved={p.spikesRemoved || 0} cleanDays={p.cleanDays || 0} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 12, fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
        Demand = last 30 days of transactions (remove + Shopify). Min demand = 0.1 L/d when no sales. Lead time = supplier default (30d fallback if no match).
      </p>
    </div>
  );
}
