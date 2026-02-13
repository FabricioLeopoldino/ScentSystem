import * as XLSX from 'xlsx';

export function exportProductsToExcel(products) {
  // Prepare data for export
  const data = products.map(product => ({
    'Tag': product.tag,
    'Product Code': product.productCode,
    'Name': product.name,
    'Category': product.category,
    'Current Stock': product.currentStock,
    'Unit': product.unit,
    'Stock (Boxes)': product.stockBoxes || '-',
    'Units Per Box': product.unitPerBox || '-',
    'Min Stock Level': product.minStockLevel,
    'Supplier': product.supplier || '-',
    'Supplier Code': product.supplierCode || '-',
    'Shopify SKUs': JSON.stringify(product.shopifySkus || {}),
    'Created At': product.createdAt ? new Date(product.createdAt).toLocaleDateString() : '-'
  }));

  // Create worksheet
  const ws = XLSX.utils.json_to_sheet(data);
  
  // Set column widths
  ws['!cols'] = [
    { wch: 15 }, // Tag
    { wch: 15 }, // Product Code
    { wch: 40 }, // Name
    { wch: 15 }, // Category
    { wch: 12 }, // Current Stock
    { wch: 8 },  // Unit
    { wch: 12 }, // Stock (Boxes)
    { wch: 12 }, // Units Per Box
    { wch: 15 }, // Min Stock Level
    { wch: 20 }, // Supplier
    { wch: 15 }, // Supplier Code
    { wch: 30 }, // Shopify SKUs
    { wch: 12 }  // Created At
  ];

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Products');

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `Products_Export_${timestamp}.xlsx`;

  // Download file
  XLSX.writeFile(wb, filename);
}

export function exportTransactionsToExcel(transactions) {
  // Prepare data for export
  const data = transactions.map(tx => ({
    'Transaction ID': tx.id,
    'Date': new Date(tx.createdAt).toLocaleString(),
    'Product Code': tx.productCode,
    'Product Name': tx.productName,
    'Category': tx.category,
    'Type': tx.type === 'add' ? 'Add Stock' : 'Remove Stock',
    'Quantity': tx.quantity,
    'Unit': tx.unit,
    'Balance After': tx.balanceAfter,
    'Notes': tx.notes || '-',
    'Shopify Order': tx.shopifyOrderId || '-'
  }));

  // Create worksheet
  const ws = XLSX.utils.json_to_sheet(data);
  
  // Set column widths
  ws['!cols'] = [
    { wch: 12 }, // Transaction ID
    { wch: 18 }, // Date
    { wch: 15 }, // Product Code
    { wch: 30 }, // Product Name
    { wch: 15 }, // Category
    { wch: 12 }, // Type
    { wch: 10 }, // Quantity
    { wch: 8 },  // Unit
    { wch: 12 }, // Balance After
    { wch: 30 }, // Notes
    { wch: 15 }  // Shopify Order
  ];

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `Transactions_Export_${timestamp}.xlsx`;

  // Download file
  XLSX.writeFile(wb, filename);
}

export function exportFullDatabaseToExcel(products, transactions) {
  const wb = XLSX.utils.book_new();

  // Products sheet
  const productsData = products.map(product => ({
    'Tag': product.tag,
    'Product Code': product.productCode,
    'Name': product.name,
    'Category': product.category,
    'Current Stock': product.currentStock,
    'Unit': product.unit,
    'Stock (Boxes)': product.stockBoxes || '-',
    'Units Per Box': product.unitPerBox || '-',
    'Min Stock Level': product.minStockLevel,
    'Supplier': product.supplier || '-',
    'Supplier Code': product.supplierCode || '-'
  }));
  const wsProducts = XLSX.utils.json_to_sheet(productsData);
  XLSX.utils.book_append_sheet(wb, wsProducts, 'Products');

  // Transactions sheet
  const transactionsData = transactions.map(tx => ({
    'ID': tx.id,
    'Date': new Date(tx.createdAt).toLocaleString(),
    'Product Code': tx.productCode,
    'Product Name': tx.productName,
    'Category': tx.category,
    'Type': tx.type,
    'Quantity': tx.quantity,
    'Unit': tx.unit,
    'Balance After': tx.balanceAfter,
    'Notes': tx.notes || '-'
  }));
  const wsTransactions = XLSX.utils.json_to_sheet(transactionsData);
  XLSX.utils.book_append_sheet(wb, wsTransactions, 'Transactions');

  // SKU Mappings sheet
  const skuMappings = [];
  products.forEach(product => {
    if (product.shopifySkus) {
      Object.entries(product.shopifySkus).forEach(([variant, sku]) => {
        skuMappings.push({
          'Product Code': product.productCode,
          'Product Name': product.name,
          'Category': product.category,
          'Variant': variant,
          'Shopify SKU': sku
        });
      });
    }
  });
  const wsSKU = XLSX.utils.json_to_sheet(skuMappings);
  XLSX.utils.book_append_sheet(wb, wsSKU, 'SKU Mappings');

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `Full_Database_Export_${timestamp}.xlsx`;

  // Download file
  XLSX.writeFile(wb, filename);
}
