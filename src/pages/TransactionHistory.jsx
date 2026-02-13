import { useState, useEffect } from 'react';
import { exportTransactionsToExcel } from '../utils/excelExport';

export default function TransactionHistory() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      const res = await fetch('/api/transactions');
      const data = await res.json();
      setTransactions(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryLabel = (category) => {
    const labels = {
      OILS: 'Oils',
      MACHINES_SPARES: 'Machines & Spares',
      RAW_MATERIALS: 'Raw Materials'
    };
    return labels[category] || category;
  };

  const filteredTransactions = transactions.filter(t => {
    const matchesType = filter === 'all' || t.type === filter;
    const matchesCategory = categoryFilter === 'ALL' || t.category === categoryFilter;
    return matchesType && matchesCategory;
  });

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: '40px' }}>
        <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>
          Loading transactions...
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: '40px' }}>
      <div className="page-header">
        <div>
          <h2 className="page-title">TRANSACTION HISTORY</h2>
          <p>Complete audit trail of all stock movements</p>
        </div>
        <button 
          className="btn btn-secondary"
          onClick={() => exportTransactionsToExcel(transactions)}
        >
          📊 Export to Excel
        </button>
      </div>

      <div className="card">
        {/* Filters */}
        <div style={{ marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '8px' }}>
              Transaction Type
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilter('all')}
                style={{ fontSize: '13px', padding: '8px 16px' }}
              >
                All
              </button>
              <button
                className={`btn ${filter === 'add' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilter('add')}
                style={{ fontSize: '13px', padding: '8px 16px' }}
              >
                Additions
              </button>
              <button
                className={`btn ${filter === 'remove' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilter('remove')}
                style={{ fontSize: '13px', padding: '8px 16px' }}
              >
                Removals
              </button>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '8px' }}>
              Category
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { value: 'ALL', label: 'All' },
                { value: 'OILS', label: 'Oils' },
                { value: 'MACHINES_SPARES', label: 'Machines & Spares' },
                { value: 'RAW_MATERIALS', label: 'Raw Materials' }
              ].map(cat => (
                <button
                  key={cat.value}
                  className={`btn ${categoryFilter === cat.value ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setCategoryFilter(cat.value)}
                  style={{ fontSize: '13px', padding: '8px 16px' }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        {filteredTransactions.length === 0 ? (
          <p style={{ color: '#6b7280', textAlign: 'center', padding: '40px' }}>
            No transactions found.
          </p>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Date/Time</th>
                    <th>Product Code</th>
                    <th>Product Name</th>
                    <th>Category</th>
                    <th>Type</th>
                    <th>Quantity</th>
                    <th>Balance After</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map(t => (
                    <tr key={t.id}>
                      <td style={{ fontSize: '12px', color: '#64748b' }}>
                        {new Date(t.createdAt).toLocaleString('en-US')}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                        {t.productCode}
                      </td>
                      <td style={{ fontWeight: '600' }}>{t.productName}</td>
                      <td>
                        <span className="badge" style={{ fontSize: '11px' }}>
                          {getCategoryLabel(t.category)}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${t.type === 'add' ? 'badge-success' : 'badge-danger'}`}>
                          {t.type === 'add' ? '+ Addition' : '- Removal'}
                        </span>
                      </td>
                      <td style={{ fontWeight: '700' }}>
                        {t.quantity} {t.unit}
                      </td>
                      <td style={{ fontWeight: '600' }}>
                        {t.balanceAfter} {t.unit}
                      </td>
                      <td style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px', color: '#64748b' }}>
                        {t.notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div style={{ marginTop: '16px', fontSize: '14px', color: '#64748b' }}>
              Showing {filteredTransactions.length} of {transactions.length} transactions
            </div>
          </>
        )}
      </div>
    </div>
  );
}
