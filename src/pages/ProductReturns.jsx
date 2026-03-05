import { useState, useEffect } from 'react';

export default function ProductReturns({ user }) {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProducts, setSelectedProducts] = useState(new Map()); // productId -> quantity
  const [notes, setNotes] = useState('');
  const [returnedBy, setReturnedBy] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      setProducts(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching products:', error);
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      p.name.toLowerCase().includes(searchLower) ||
      p.productCode.toLowerCase().includes(searchLower) ||
      p.tag.toLowerCase().includes(searchLower) ||
      Object.keys(p.shopifySkus || {}).some(sku => sku.toLowerCase().includes(searchLower))
    );
  });

  const handleToggleProduct = (product) => {
    const newSelected = new Map(selectedProducts);
    if (newSelected.has(product.id)) {
      newSelected.delete(product.id);
    } else {
      newSelected.set(product.id, 0);
    }
    setSelectedProducts(newSelected);
  };

  const handleQuantityChange = (productId, quantity) => {
    const newSelected = new Map(selectedProducts);
    const numQuantity = parseFloat(quantity) || 0;
    newSelected.set(productId, numQuantity);
    setSelectedProducts(newSelected);
  };

  const handleProcessReturns = async () => {
    // Validation
    if (selectedProducts.size === 0) {
      alert('Please select at least one product to return');
      return;
    }

    if (!returnedBy.trim()) {
      alert('Please enter the name of the person processing the return');
      return;
    }

    // Check all selected products have quantity > 0
    const invalidProducts = [];
    selectedProducts.forEach((quantity, productId) => {
      if (quantity <= 0) {
        const product = products.find(p => p.id === productId);
        invalidProducts.push(product?.name || productId);
      }
    });

    if (invalidProducts.length > 0) {
      alert(`Please enter valid quantities for: ${invalidProducts.join(', ')}`);
      return;
    }

    if (!confirm(`Process return for ${selectedProducts.size} product(s)?`)) {
      return;
    }

    setProcessing(true);

    try {
      const returnItems = Array.from(selectedProducts.entries()).map(([productId, quantity]) => ({
        productId,
        quantity
      }));

      const res = await fetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: returnItems,
          notes: notes.trim() || '',
          returnedBy: returnedBy.trim()
        })
      });

      if (res.ok) {
        const data = await res.json();
        alert(`Successfully processed return for ${data.processedCount} product(s)!`);
        
        // Reset form
        setSelectedProducts(new Map());
        setNotes('');
        setReturnedBy('');
        setSearchTerm('');
        
        // Refresh products
        fetchProducts();
      } else {
        const error = await res.json();
        alert(`Error: ${error.error || 'Failed to process returns'}`);
      }
    } catch (error) {
      console.error('Error processing returns:', error);
      alert('Error processing returns: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const getCategoryBadgeClass = (category) => {
    switch(category) {
      case 'OILS': return 'badge-primary';
      case 'RAW_MATERIALS': return 'badge-warning';
      case 'MACHINES_SPARES': return 'badge-secondary';
      case 'SCENT_MACHINES': return 'badge-info';
      default: return 'badge-secondary';
    }
  };

  const getCategoryLabel = (category) => {
    switch(category) {
      case 'OILS': return 'Oils';
      case 'RAW_MATERIALS': return 'Raw Materials';
      case 'MACHINES_SPARES': return 'Machines & Spares';
      case 'SCENT_MACHINES': return 'Machines';
      default: return category;
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: '40px' }}>
        <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>
          Loading products...
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: '40px' }}>
      <div className="page-header">
        <h2 className="page-title">Product Returns / Restock</h2>
        <p style={{ color: '#64748b', marginTop: '8px' }}>
          Return products to stock and add quantities back to inventory
        </p>
      </div>

      {/* Summary Card */}
      <div className="card" style={{ marginBottom: '24px', borderLeft: '4px solid #10b981' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ fontSize: '48px' }}>📦</div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#10b981', marginBottom: '4px' }}>
              {selectedProducts.size} Product(s) Selected
            </div>
            <div style={{ fontSize: '13px', color: '#64748b' }}>
              Select products below and enter quantities to return to stock
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            className="input"
            placeholder="🔍 Search by name, code, or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '12px' }}
            autoFocus
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '18px',
                color: '#9ca3af'
              }}
            >
              ×
            </button>
          )}
        </div>
        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
          Found {filteredProducts.length} product(s)
        </div>
      </div>

      {/* Products List */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>
          Select Products to Return
        </h3>
        
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {filteredProducts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
              No products found
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredProducts.map(product => {
                const isSelected = selectedProducts.has(product.id);
                const quantity = selectedProducts.get(product.id) || 0;
                
                return (
                  <div
                    key={product.id}
                    style={{
                      padding: '16px',
                      border: isSelected ? '2px solid #10b981' : '1px solid #e5e7eb',
                      borderRadius: '8px',
                      background: isSelected ? '#ecfdf5' : 'white',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleProduct(product)}
                        style={{
                          marginTop: '4px',
                          width: '18px',
                          height: '18px',
                          cursor: 'pointer'
                        }}
                      />

                      {/* Product Info */}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <span style={{ fontWeight: '700', fontSize: '15px' }}>
                            {product.name}
                          </span>
                          <span className={`badge ${getCategoryBadgeClass(product.category)}`} style={{ fontSize: '11px' }}>
                            {getCategoryLabel(product.category)}
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>
                          <span>Code: {product.productCode}</span>
                          <span>Tag: {product.tag}</span>
                          <span>Current: {product.currentStock} {product.unit}</span>
                        </div>

                        {Object.keys(product.shopifySkus || {}).length > 0 && (
                          <div style={{ fontSize: '12px', color: '#64748b' }}>
                            SKUs: {Object.keys(product.shopifySkus).join(', ')}
                          </div>
                        )}

                        {/* Quantity Input - Only show if selected */}
                        {isSelected && (
                          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #d1fae5' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <label style={{ fontWeight: '600', fontSize: '14px', color: '#065f46' }}>
                                Quantity to Return:
                              </label>
                              <input
                                type="number"
                                className="input"
                                value={quantity}
                                onChange={(e) => handleQuantityChange(product.id, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="0"
                                min="0"
                                step={product.category === 'OILS' ? '1' : '1'}
                                style={{ 
                                  width: '150px',
                                  fontWeight: '700',
                                  fontSize: '15px'
                                }}
                              />
                              <span style={{ fontWeight: '600', color: '#065f46' }}>
                                {product.unit}
                              </span>
                              <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '8px' }}>
                                New stock: {product.currentStock + quantity} {product.unit}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Return Details Form */}
      {selectedProducts.size > 0 && (
        <div className="card" style={{ marginBottom: '24px', borderLeft: '4px solid #10b981' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>
            Return Details
          </h3>

          {/* Notes */}
          <div className="form-group">
            <label>
              Notes / Reason for Return (Optional)
            </label>
            <textarea
              className="input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows="3"
              placeholder="e.g., Damaged units returned from customer, Excess inventory, Quality issue, etc."
            />
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
              This will be recorded in the transaction history
            </div>
          </div>

          {/* Returned By */}
          <div className="form-group">
            <label>
              Returned By * <span style={{ color: '#ef4444' }}>Required</span>
            </label>
            <input
              type="text"
              className="input"
              value={returnedBy}
              onChange={(e) => setReturnedBy(e.target.value)}
              placeholder="Enter your name"
              required
            />
          </div>

          {/* Summary */}
          <div style={{ 
            padding: '16px', 
            background: '#ecfdf5', 
            borderRadius: '8px',
            marginBottom: '20px',
            border: '1px solid #10b981'
          }}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#065f46', marginBottom: '8px' }}>
              Return Summary:
            </div>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#047857' }}>
              <li>{selectedProducts.size} product(s) will be returned to stock</li>
              <li>Stock quantities will be updated automatically</li>
              <li>Transactions will be recorded in History</li>
              <li>Date and time will be logged automatically</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              className="btn btn-secondary"
              onClick={() => {
                if (confirm('Cancel and clear all selections?')) {
                  setSelectedProducts(new Map());
                  setNotes('');
                  setReturnedBy('');
                }
              }}
              disabled={processing}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleProcessReturns}
              disabled={processing}
              style={{ 
                background: '#10b981',
                minWidth: '180px'
              }}
            >
              {processing ? 'Processing...' : `Process ${selectedProducts.size} Return(s)`}
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {selectedProducts.size === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '60px', color: '#9ca3af' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>📦</div>
          <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
            No Products Selected
          </div>
          <div style={{ fontSize: '14px' }}>
            Search and select products above to return them to stock
          </div>
        </div>
      )}
    </div>
  );
}
