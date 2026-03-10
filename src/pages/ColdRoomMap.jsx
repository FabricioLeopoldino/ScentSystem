import { useState, useEffect } from 'react';

export default function ColdRoomMap({ user }) {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [highlightedProduct, setHighlightedProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products?category=OILS');
      const data = await res.json();
      setProducts(data);
      setLoading(false);
    } catch (error) {
      console.error('Error:', error);
      setLoading(false);
    }
  };

  const parseBinLocation = (binLocation) => {
    if (!binLocation) return null;
    const match = binLocation.match(/Aisle:?\s*(\d+),?\s*Bay:?\s*([A-Z]+|Floor),?\s*Position:?\s*(\d+)/i);
    if (match) {
      return {
        aisle: parseInt(match[1]),
        bay: match[2].toUpperCase(),
        position: parseInt(match[3])
      };
    }
    return null;
  };

  const getProductsAtLocation = (aisle, bay, position) => {
    return products.filter(p => {
      const loc = parseBinLocation(p.bin_location);
      return loc && loc.aisle === aisle && loc.bay === bay && loc.position === position;
    });
  };

  const isHighlighted = (aisle, bay, position) => {
    if (!highlightedProduct) return false;
    const loc = parseBinLocation(highlightedProduct.bin_location);
    return loc && loc.aisle === aisle && loc.bay === bay && loc.position === position;
  };

  const handleSearch = (term) => {
    setSearchTerm(term);
    if (!term.trim()) {
      setHighlightedProduct(null);
      return;
    }

    const found = products.find(p => 
      p.name.toLowerCase().includes(term.toLowerCase()) ||
      p.productCode.toLowerCase().includes(term.toLowerCase()) ||
      p.tag.toLowerCase().includes(term.toLowerCase())
    );

    setHighlightedProduct(found || null);
  };

  const renderPosition = (aisle, bay, position) => {
    const productsHere = getProductsAtLocation(aisle, bay, position);
    const hasProds = productsHere.length > 0;
    const highlighted = isHighlighted(aisle, bay, position);

    return (
      <div
        key={`${aisle}-${bay}-${position}`}
        onClick={() => setSelectedLocation({ aisle, bay, position, products: productsHere })}
        style={{
          padding: '10px 8px',
          background: highlighted ? '#10b981' : hasProds ? '#3b82f6' : '#2d3748',
          border: `2px solid ${highlighted ? '#059669' : hasProds ? '#2563eb' : '#4a5568'}`,
          borderRadius: '6px',
          cursor: 'pointer',
          textAlign: 'center',
          transition: 'all 0.3s',
          animation: highlighted ? 'pulse 1.5s infinite' : 'none',
          minWidth: '95px',
          boxShadow: highlighted ? '0 0 20px rgba(16, 185, 129, 0.6)' : 'none'
        }}
      >
        <div style={{ fontSize: '11px', fontWeight: '700', color: 'white', marginBottom: '4px' }}>
          BAY: {bay} Position: {position}
        </div>
        {hasProds && (
          <div style={{ 
            marginTop: '4px', 
            padding: '2px 6px', 
            background: 'rgba(255,255,255,0.25)', 
            borderRadius: '4px',
            fontSize: '9px',
            color: 'white',
            fontWeight: '600'
          }}>
            {productsHere.length} item{productsHere.length > 1 ? 's' : ''}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <div className="container" style={{ paddingTop: '40px', textAlign: 'center' }}>Loading...</div>;
  }

  return (
    <div className="container" style={{ paddingTop: '40px' }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 20px rgba(16, 185, 129, 0.6); }
          50% { transform: scale(1.05); box-shadow: 0 0 30px rgba(16, 185, 129, 0.9); }
        }
      `}</style>

      <div className="page-header">
        <h2 className="page-title">🗺️ Cold Room Map</h2>
        <p style={{ color: '#64748b', marginTop: '8px' }}>
          Visual warehouse location map for OILS products
        </p>
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <input
          type="text"
          className="input"
          placeholder="🔍 Search product to highlight location..."
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          style={{ fontSize: '16px' }}
          autoFocus
        />
        {highlightedProduct && (
          <div style={{ 
            marginTop: '12px', 
            padding: '12px', 
            background: '#ecfdf5', 
            borderRadius: '8px',
            border: '2px solid #10b981'
          }}>
            <div style={{ fontWeight: '700', color: '#065f46', marginBottom: '4px' }}>
              Found: {highlightedProduct.name}
            </div>
            <div style={{ fontSize: '13px', color: '#047857' }}>
              Location: {highlightedProduct.bin_location || 'Not set'}
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ background: '#1a202c', padding: '24px', position: 'relative' }}>
        <div style={{ 
          position: 'absolute', 
          bottom: '16px', 
          right: '16px', 
          background: '#2d3748',
          padding: '12px',
          borderRadius: '8px',
          fontSize: '11px',
          color: 'white',
          zIndex: 10
        }}>
          <div style={{ fontWeight: '700', marginBottom: '8px' }}>Legend:</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <div style={{ width: '14px', height: '14px', background: '#2d3748', border: '2px solid #4a5568' }}></div>
            <span>Empty</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <div style={{ width: '14px', height: '14px', background: '#3b82f6', border: '2px solid #2563eb' }}></div>
            <span>Has Products</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '14px', height: '14px', background: '#10b981', border: '2px solid #059669' }}></div>
            <span>Highlighted</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '20px' }}>
          <div style={{ width: '140px', display: 'flex', alignItems: 'center' }}>
            <div style={{
                padding: '30px 20px',
                background: '#2c5282',
                border: '3px solid #2b6cb0',
                borderRadius: '12px',
                textAlign: 'center',
                color: 'white',
                width: '100%'
              }}>
              <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Aisle: 5</div>
              <div style={{ fontSize: '12px', marginBottom: '4px' }}>Bay: Floor</div>
              <div style={{ fontSize: '10px', color: '#90cdf4' }}>Positions: Any</div>
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{ background: '#047857', color: 'white', padding: '8px 16px', borderRadius: '8px', fontWeight: '700', fontSize: '13px' }}>
                  Aisle 4
                </div>
                <div style={{ color: '#a0aec0', fontSize: '12px' }}>Bay D - Positions 1-15</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', padding: '16px', background: '#d97706', borderRadius: '12px', border: '3px solid #b45309' }}>
                <div></div>
                {renderPosition(3, 'D', 9)}
                {renderPosition(3, 'D', 5)}
                {renderPosition(3, 'D', 1)}
                {renderPosition(3, 'D', 10)}
                {renderPosition(3, 'D', 6)}
                {renderPosition(3, 'D', 2)}
                {renderPosition(3, 'D', 11)}
                {renderPosition(3, 'D', 7)}
                {renderPosition(3, 'D', 3)}
                {renderPosition(3, 'D', 12)}
                {renderPosition(3, 'D', 8)}
                {renderPosition(3, 'D', 4)}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{ background: '#047857', color: 'white', padding: '8px 16px', borderRadius: '8px', fontWeight: '700', fontSize: '13px' }}>
                  Aisle 3
                </div>
                <div style={{ color: '#a0aec0', fontSize: '12px' }}>Bay C - Positions 1-12</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', padding: '16px', background: '#d97706', borderRadius: '12px', border: '3px solid #b45309' }}>
                {renderPosition(3, 'C', 9)}
                {renderPosition(3, 'C', 5)}
                {renderPosition(3, 'C', 1)}
                {renderPosition(3, 'C', 10)}
                {renderPosition(3, 'C', 6)}
                {renderPosition(3, 'C', 2)}
                {renderPosition(3, 'C', 11)}
                {renderPosition(3, 'C', 7)}
                {renderPosition(3, 'C', 3)}
                {renderPosition(3, 'C', 12)}
                {renderPosition(3, 'C', 8)}
                {renderPosition(3, 'C', 4)}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{ background: '#047857', color: 'white', padding: '8px 16px', borderRadius: '8px', fontWeight: '700', fontSize: '13px' }}>
                  Aisle 2
                </div>
                <div style={{ color: '#a0aec0', fontSize: '12px' }}>Bay B - Positions 1-15</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', padding: '16px', background: '#d97706', borderRadius: '12px', border: '3px solid #b45309' }}>
                {renderPosition(1, 'D', 9)}
                {renderPosition(1, 'D', 5)}
                {renderPosition(1, 'D', 1)}
                {renderPosition(1, 'D', 13)}
                {renderPosition(1, 'D', 10)}
                {renderPosition(1, 'D', 6)}
                {renderPosition(1, 'D', 2)}
                {renderPosition(1, 'D', 14)}
                {renderPosition(1, 'D', 11)}
                {renderPosition(1, 'D', 7)}
                {renderPosition(1, 'D', 3)}
                {renderPosition(1, 'D', 15)}
                {renderPosition(1, 'D', 12)}
                {renderPosition(1, 'D', 8)}
                {renderPosition(1, 'D', 4)}
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{ background: '#047857', color: 'white', padding: '8px 16px', borderRadius: '8px', fontWeight: '700', fontSize: '13px' }}>
                  Aisle 1
                </div>
                <div style={{ color: '#a0aec0', fontSize: '12px' }}>Bay A - Positions 1-16</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', padding: '16px', background: '#d97706', borderRadius: '12px', border: '3px solid #b45309' }}>
                {renderPosition(1, 'A', 13)}
                {renderPosition(1, 'A', 9)}
                {renderPosition(1, 'A', 5)}
                {renderPosition(1, 'A', 1)}
                {renderPosition(1, 'A', 14)}
                {renderPosition(1, 'A', 10)}
                {renderPosition(1, 'A', 6)}
                {renderPosition(1, 'A', 2)}
                {renderPosition(1, 'A', 15)}
                {renderPosition(1, 'A', 11)}
                {renderPosition(1, 'A', 7)}
                {renderPosition(1, 'A', 3)}
                {renderPosition(1, 'A', 16)}
                {renderPosition(1, 'A', 12)}
                {renderPosition(1, 'A', 8)}
                {renderPosition(1, 'A', 4)}
              </div>
            </div>
          </div>

          <div style={{ width: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ padding: '80px 20px', background: '#975a16', border: '3px solid #744210', borderRadius: '12px', textAlign: 'center', color: 'white', fontSize: '13px', fontWeight: '700', writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
              ← Cold Room
            </div>
          </div>
        </div>
      </div>

      {selectedLocation && (
        <div className="card" style={{ marginTop: '24px', borderLeft: '4px solid #3b82f6' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>📍 Location Details</h3>
          <div style={{ marginBottom: '16px' }}>
            <strong>Aisle:</strong> {selectedLocation.aisle} | <strong> Bay:</strong> {selectedLocation.bay} | <strong> Position:</strong> {selectedLocation.position}
          </div>
          {selectedLocation.products.length > 0 ? (
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>
                Products at this location ({selectedLocation.products.length}):
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selectedLocation.products.map(product => (
                  <div key={product.id} style={{ padding: '12px', background: '#f3f4f6', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: '700', marginBottom: '4px' }}>{product.name}</div>
                      <div style={{ fontSize: '13px', color: '#64748b' }}>Code: {product.productCode} | Stock: {product.currentStock} {product.unit}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ color: '#64748b', fontStyle: 'italic' }}>No products at this location</div>
          )}
        </div>
      )}

      {products.filter(p => !p.bin_location).length > 0 && (
        <div className="card" style={{ marginTop: '24px', borderLeft: '4px solid #ef4444' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>
            ⚠️ Products Without Bin Location ({products.filter(p => !p.bin_location).length})
          </h3>
          <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px' }}>These products need to be assigned a bin location</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {products.filter(p => !p.bin_location).slice(0, 10).map(product => (
              <div key={product.id} style={{ padding: '8px 12px', background: '#fef2f2', borderRadius: '6px', fontSize: '12px', border: '1px solid #fecaca' }}>
                {product.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
