import { useState, useEffect } from 'react';

export default function SkuMapping() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      setProducts(data);
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

  // Generate SKU mappings from products
  const generateMappings = () => {
    const mappings = [];
    
    products.forEach(product => {
      if (product.shopifySkus && typeof product.shopifySkus === 'object') {
        // Products with multiple SKUs (oils)
        Object.entries(product.shopifySkus).forEach(([variant, sku]) => {
          mappings.push({
            id: `${product.id}_${variant}`,
            shopifySku: sku,
            variant,
            productCode: product.productCode,
            productName: product.name,
            category: product.category,
            unit: product.unit
          });
        });
      }
    });
    
    return mappings;
  };

  const mappings = generateMappings();
  
  const filteredMappings = categoryFilter === 'ALL' 
    ? mappings 
    : mappings.filter(m => m.category === categoryFilter);

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: '40px' }}>
        <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>
          Loading SKU mappings...
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: '40px' }}>
      <div className="page-header">
        <div>
          <h2 className="page-title">SHOPIFY SKU MAPPING</h2>
          <p>View all Shopify SKU mappings across products</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', marginRight: '8px' }}>
            Filter by Category:
          </span>
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

      {/* Info Card */}
      <div className="card" style={{ marginBottom: '24px', background: '#eff6ff', borderLeft: '4px solid #3b82f6' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <div style={{ fontSize: '24px' }}>ℹ️</div>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '8px', color: '#1e40af' }}>
              About SKU Mappings
            </h3>
            <p style={{ fontSize: '13px', color: '#1e40af', lineHeight: '1.6', margin: 0 }}>
              SKU mappings are automatically generated from your products. Essential oils have 5 variants 
              (SA_CA, SA_HF, SA_CDIFF, SA_1L, SA_PRO), while machines/spares and raw materials have a single default SKU. 
              To edit SKUs, go to <strong>Product Management</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Mappings Table */}
      <div className="card">
        {filteredMappings.length === 0 ? (
          <p style={{ color: '#6b7280', textAlign: 'center', padding: '40px' }}>
            No SKU mappings found for this category.
          </p>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Shopify SKU</th>
                    <th>Variant</th>
                    <th>Product Code</th>
                    <th>Product Name</th>
                    <th>Category</th>
                    <th>Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMappings.map(mapping => (
                    <tr key={mapping.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: '700', color: '#2563eb' }}>
                        {mapping.shopifySku}
                      </td>
                      <td>
                        {mapping.variant ? (
                          <span className="badge badge-secondary" style={{ fontSize: '11px' }}>
                            {mapping.variant}
                          </span>
                        ) : (
                          <span style={{ color: '#9ca3af', fontSize: '12px' }}>Default</span>
                        )}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                        {mapping.productCode}
                      </td>
                      <td style={{ fontWeight: '600' }}>{mapping.productName}</td>
                      <td>
                        <span className="badge" style={{ fontSize: '11px' }}>
                          {getCategoryLabel(mapping.category)}
                        </span>
                      </td>
                      <td style={{ fontSize: '13px', color: '#64748b' }}>{mapping.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div style={{ marginTop: '16px', fontSize: '14px', color: '#64748b' }}>
              Showing {filteredMappings.length} of {mappings.length} SKU mappings
            </div>
          </>
        )}
      </div>

      {/* Statistics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '24px' }}>
        <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ fontSize: '32px', fontWeight: '900', color: '#3b82f6', marginBottom: '8px' }}>
            {mappings.filter(m => m.category === 'OILS').length}
          </div>
          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Oil SKUs</div>
        </div>
        
        <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ fontSize: '32px', fontWeight: '900', color: '#8b5cf6', marginBottom: '8px' }}>
            {mappings.filter(m => m.category === 'MACHINES_SPARES').length}
          </div>
          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Machines & Spares SKUs</div>
        </div>
        
        <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ fontSize: '32px', fontWeight: '900', color: '#f59e0b', marginBottom: '8px' }}>
            {mappings.filter(m => m.category === 'RAW_MATERIALS').length}
          </div>
          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Raw Materials SKUs</div>
        </div>
        
        <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ fontSize: '32px', fontWeight: '900', color: '#10b981', marginBottom: '8px' }}>
            {mappings.length}
          </div>
          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Total SKUs</div>
        </div>
      </div>
    </div>
  );
}
