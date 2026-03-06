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

  // Parse bin location string to object
  const parseBinLocation = (binLocation) => {
    if (!binLocation) return null;
    const match = binLocation.match(/Aisle:?\s*(\d+),?\s*Bay:?\s*([A-Z]+),?\s*Position:?\s*(\d+)/i);
    if (match) {
      return {
        aisle: parseInt(match[1]),
        bay: match[2].toUpperCase(),
        position: parseInt(match[3])
      };
    }
    return null;
  };

  // Get products at specific location
  const getProductsAtLocation = (aisle, bay, position) => {
    return products.filter(p => {
      const loc = parseBinLocation(p.bin_location);
      return loc && loc.aisle === aisle && loc.bay === bay && loc.position === position;
    });
  };

  // Check if location has products
  const hasProducts = (aisle, bay, position) => {
    return getProductsAtLocation(aisle, bay, position).length > 0;
  };

  // Get location key
  const getLocationKey = (aisle, bay, position) => {
    return `${aisle}-${bay}-${position}`;
  };

  // Check if location is highlighted
  const isHighlighted = (aisle, bay, position) => {
    if (!highlightedProduct) return false;
    const loc = parseBinLocation(highlightedProduct.bin_location);
    return loc && loc.aisle === aisle && loc.bay === bay && loc.position === position;
  };

  // Search and highlight
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

  // Render bin position
  const renderBinPosition = (aisle, bay, positions) => {
    return positions.map(pos => {
      const key = getLocationKey(aisle, bay, pos);
      const hasProds = hasProducts(aisle, bay, pos);
      const highlighted = isHighlighted(aisle, bay, pos);
      const productsHere = getProductsAtLocation(aisle, bay, pos);

      return (
        <div
          key={key}
          onClick={() => setSelectedLocation({ aisle, bay, position: pos, products: productsHere })}
          style={{
            flex: 1,
            padding: '12px 8px',
            background: highlighted ? '#10b981' : hasProds ? '#3b82f6' : '#1f2937',
            border: `2px solid ${highlighted ? '#059669' : hasProds ? '#2563eb' : '#374151'}`,
            borderRadius: '8px',
            cursor: 'pointer',
            textAlign: 'center',
            transition: 'all 0.3s',
            animation: highlighted ? 'pulse 1.5s infinite' : 'none',
            boxShadow: highlighted ? '0 0 20px rgba(16, 185, 129, 0.6)' : 'none'
          }}
          title={`Click to see products`}
        >
          <div style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '4px' }}>
            Aisle: {aisle}
          </div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: 'white', marginBottom: '2px' }}>
            Bay: {bay}
          </div>
          <div style={{ fontSize: '10px', color: '#d1d5db' }}>
            Pos ({positions.join(',')})
          </div>
          {hasProds && (
            <div style={{ 
              marginTop: '6px', 
              padding: '2px 6px', 
              background: 'rgba(255,255,255,0.2)', 
              borderRadius: '4px',
              fontSize: '10px',
              color: 'white'
            }}>
              {productsHere.length} item{productsHere.length > 1 ? 's' : ''}
            </div>
          )}
        </div>
      );
    });
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

      {/* Search Bar */}
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

      {/* Cold Room Map */}
      <div className="card" style={{ background: '#064e3b', padding: '24px', position: 'relative' }}>
        <div style={{ 
          position: 'absolute', 
          top: '16px', 
          right: '16px', 
          background: '#1f2937',
          padding: '12px',
          borderRadius: '8px',
          fontSize: '12px',
          color: 'white'
        }}>
          <div style={{ fontWeight: '700', marginBottom: '8px' }}>Legend:</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <div style={{ width: '16px', height: '16px', background: '#1f2937', border: '2px solid #374151' }}></div>
            <span>Empty</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <div style={{ width: '16px', height: '16px', background: '#3b82f6', border: '2px solid #2563eb' }}></div>
            <span>Has Products</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '16px', height: '16px', background: '#10b981', border: '2px solid #059669' }}></div>
            <span>Highlighted</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px', minHeight: '600px' }}>
          {/* LEFT SIDE - Aisle 5 (Floor) */}
          <div style={{ width: '180px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div
              style={{
                padding: '20px',
                background: '#1e3a8a',
                border: '3px solid #1e40af',
                borderRadius: '12px',
                textAlign: 'center',
                color: 'white'
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '8px' }}>
                Aisle: 5
              </div>
              <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                Bay: Floor
              </div>
              <div style={{ fontSize: '11px', color: '#93c5fd' }}>
                Positions: Any
              </div>
            </div>
          </div>

          {/* CENTER AREA */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* TOP ROW - Aisle 4 (Bay E + D) */}
            <div style={{ 
              padding: '16px', 
              background: '#d97706', 
              borderRadius: '12px',
              border: '3px solid #b45309'
            }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                {renderBinPosition(4, 'E', [1, 2, 3])}
                {renderBinPosition(4, 'D', [10, 11, 12])}
                {renderBinPosition(4, 'D', [7, 8, 9])}
                {renderBinPosition(4, 'D', [4, 5, 6])}
                {renderBinPosition(4, 'D', [1, 2, 3])}
              </div>
            </div>

            {/* MIDDLE SECTION - Aisles 2 & 3 */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ 
                padding: '16px', 
                background: '#d97706', 
                borderRadius: '12px',
                border: '3px solid #b45309'
              }}>
                {/* Aisle 3 */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                  {renderBinPosition(3, 'C', [7, 8, 9])}
                  {renderBinPosition(3, 'C', [4, 5, 6])}
                  {renderBinPosition(3, 'C', [1, 2, 3])}
                </div>

                {/* Aisle 2 */}
                <div style={{ display: 'flex', gap: '12px' }}>
                  {renderBinPosition(2, 'B', [7, 8, 9])}
                  {renderBinPosition(2, 'B', [4, 5, 6])}
                  {renderBinPosition(2, 'B', [1, 2, 3])}
                </div>
              </div>
            </div>

            {/* BOTTOM ROW - Aisle 1 */}
            <div style={{ 
              padding: '16px', 
              background: '#d97706', 
              borderRadius: '12px',
              border: '3px solid #b45309'
            }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                {renderBinPosition(1, 'A', [13, 14, 15, 16])}
                {renderBinPosition(1, 'A', [9, 10, 11, 12])}
                {renderBinPosition(1, 'A', [5, 6, 7, 8])}
                {renderBinPosition(1, 'A', [1, 2, 3, 4])}
              </div>
            </div>
          </div>

          {/* RIGHT SIDE - Door */}
          <div style={{ width: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ 
              width: '100%',
              padding: '60px 20px',
              background: '#374151',
              border: '3px solid #4b5563',
              borderRadius: '12px',
              textAlign: 'center',
              color: 'white',
              fontSize: '14px',
              fontWeight: '700',
              writingMode: 'vertical-rl',
              textOrientation: 'mixed'
            }}>
              🚪 Cold Room Door →
            </div>
          </div>
        </div>
      </div>

      {/* Selected Location Details */}
      {selectedLocation && (
        <div className="card" style={{ marginTop: '24px', borderLeft: '4px solid #3b82f6' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>
            📍 Location Details
          </h3>
          <div style={{ marginBottom: '16px' }}>
            <strong>Aisle:</strong> {selectedLocation.aisle} | 
            <strong> Bay:</strong> {selectedLocation.bay} | 
            <strong> Position:</strong> {selectedLocation.position}
          </div>
          
          {selectedLocation.products.length > 0 ? (
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>
                Products at this location ({selectedLocation.products.length}):
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selectedLocation.products.map(product => (
                  <div 
                    key={product.id}
                    style={{ 
                      padding: '12px', 
                      background: '#f3f4f6', 
                      borderRadius: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: '700', marginBottom: '4px' }}>
                        {product.name}
                      </div>
                      <div style={{ fontSize: '13px', color: '#64748b' }}>
                        Code: {product.productCode} | Stock: {product.currentStock} {product.unit}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ color: '#64748b', fontStyle: 'italic' }}>
              No products at this location
            </div>
          )}
        </div>
      )}

      {/* Products Without Location */}
      {products.filter(p => !p.bin_location).length > 0 && (
        <div className="card" style={{ marginTop: '24px', borderLeft: '4px solid #ef4444' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>
            ⚠️ Products Without Bin Location ({products.filter(p => !p.bin_location).length})
          </h3>
          <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px' }}>
            These products need to be assigned a bin location
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {products.filter(p => !p.bin_location).slice(0, 10).map(product => (
              <div 
                key={product.id}
                style={{ 
                  padding: '8px 12px', 
                  background: '#fef2f2', 
                  borderRadius: '6px',
                  fontSize: '12px',
                  border: '1px solid #fecaca'
                }}
              >
                {product.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
