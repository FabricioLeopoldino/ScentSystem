#  Scent Stock Manager

* Testing

A comprehensive inventory management system, designed to streamline stock control, bill of materials tracking, and Shopify integration.

---

## Overview

Scent Stock Manager helps manage product inventory across multiple categories including fragrance oils, raw materials, and machine parts. The system automates stock deductions through Shopify webhooks and provides complete visibility into incoming orders and transaction history.

---

## Key Features

### Inventory Management
- Real-time stock tracking across oils, raw materials, and machines & spares
- Low stock alerts and status monitoring
- Multi-unit support (mL, L, units, kg, g)
- Box-level tracking for bulk items

### Bill of Materials (BOM)
- Automatic component deduction for oil products (5 variants: SA_CA, SA_1L, SA_HF, SA_PRO, SA_CDIFF)
- Diffuser machine BOM visualization (5 machine types)
- Volume-based calculations with precision handling

### Purchase Orders
- Track incoming orders from suppliers
- Quick-receive functionality with full or partial quantity options
- Automatic stock updates and transaction logging
- Shopify Purchase Order workflow integration

### Shopify Integration
- Webhook automation for order fulfillment
- Automatic stock deduction when orders are fulfilled
- SKU mapping for different product variants
- Export capabilities for Shopify CSV format

### Audit & Reporting
- Complete transaction history with timestamps
- User activity tracking (who added/removed stock)
- Excel export for all products and transactions
- Search and filter across all data

### User Management
- Role-based access (Admin/User)
- Secure authentication with bcrypt
- Activity logging per user

---

## Tech Stack

**Frontend**
- React 18.2
- Vite 5.0
- Wouter (routing)
- Lucide React (icons)

**Backend**
- Node.js with Express 4.18
- PostgreSQL via Neon (serverless)
- CORS-enabled API
- Webhook handling

**Libraries**
- xlsx - Excel file generation
- multer - File uploads
- pg - PostgreSQL client
- bcryptjs - Password hashing

---

## Getting Started

### Prerequisites
```bash
Node.js 18.x or higher
PostgreSQL database (Neon recommended)
```

### Installation

1. Clone the repository
```bash
git clone https://github.com/your-username/scent-stock-manager.git
cd scent-stock-manager
```

2. Install dependencies
```bash
npm install
```

3. Configure environment variables

Create a `.env` file in the root directory:
```env
DATABASE_URL=your_postgresql_connection_string
PORT=3000
SHOPIFY_WEBHOOK_SECRET=your_shopify_secret
SHOPIFY_SYNC_ENABLED=false
```

4. Run database migrations
```bash
npm run migrate
```

5. Start development server
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

---

## Production Deployment

### Render Setup

**Build Command:**
```bash
npm install && npx vite build
```

**Start Command:**
```bash
node server/index.js
```

**Environment Variables:**
```
DATABASE_URL = your_neon_postgres_url
SHOPIFY_WEBHOOK_SECRET = your_webhook_secret
SHOPIFY_SYNC_ENABLED = false
```

### Database Schema

The system uses 6 main tables:
- `users` - Authentication and roles
- `products` - Inventory items
- `transactions` - Stock movement history
- `bom` - Bill of materials for oils
- `diffuser_bom` - Machine component lists
- `attachments` - File uploads

---

## Usage Guide

### Managing Products

Add products through the **Product Management** page. Each product requires:
- Name and category (Oils, Raw Materials, or Machines & Spares)
- Product code and tag
- Current stock and minimum level
- Supplier information

### Purchase Orders Workflow

1. Create PO in Shopify with supplier and quantities
2. Add same PO to Scent Stock Manager via `+ Incoming` button
3. Badge appears showing pending quantity
4. When goods arrive, click `✓ Received`
5. Confirm full or partial quantity received
6. System automatically updates stock and creates transaction
7. Badge is removed

### Shopify Integration

Enable webhooks in Shopify admin:
- Event: `orders/fulfilled`
- URL: `https://your-domain.com/shopify/webhook/orders-fulfilled`
- Format: JSON

The system will automatically deduct oil stock and BOM components when orders are fulfilled.

### BOM Configuration

Bill of materials can be edited in the **BOM** page. Each oil variant has specific component requirements that are automatically deducted when products are sold.

---

## API Endpoints

### Products
```
GET    /api/products
POST   /api/products
PUT    /api/products/:id
DELETE /api/products/:id
```

### Stock Management
```
POST   /api/stock/add
POST   /api/stock/remove
POST   /api/stock/adjust
```

### Purchase Orders
```
POST   /api/products/:id/incoming
DELETE /api/products/:id/incoming/:index
POST   /api/products/:id/incoming/:index/receive
```

### Transactions
```
GET    /api/transactions
GET    /api/transactions/product/:productId
```

---

## Troubleshooting

**Build fails with "vite: Permission denied"**
- Ensure `package.json` uses `npx vite build` in scripts
- Clear build cache in Render and redeploy

**Stock not updating after webhook**
- Verify `SHOPIFY_WEBHOOK_SECRET` matches Shopify settings
- Check webhook logs in Render for errors
- Ensure SKU mapping is configured correctly

**Database connection errors**
- Verify `DATABASE_URL` includes `?sslmode=require`
- Check Neon database is active and accessible
- Confirm connection string format is correct

**Login issues**
- Default admin credentials are set during migration
- Reset password through database if needed
- Check bcrypt is installed and working

---

## Project Structure

```
scent-stock-manager/
├── server/
│   └── index.js           # Express API server
├── src/
│   ├── pages/             # React page components
│   ├── utils/             # Helper functions
│   └── App.jsx            # Main app component
├── dist/                  # Production build
├── package.json
├── vite.config.js
└── README.md
```

---

## Contributing

This is a private internal tool for Scent Australia. For feature requests or bug reports, contact the development team.

---

## License

Proprietary - Fabricio Leopoldino © 2026

---

## Changelog

### v2.1.0 (Current)
- Added Purchase Orders tracking system
- Implemented receive workflow with full/partial quantities
- Enhanced incoming orders visibility with badges
- Automatic stock updates on PO receipt
- Complete transaction logging for received orders

### v2.0.0
- Migrated from SQLite to PostgreSQL (Neon)
- Redesigned UI with improved navigation
- Added Diffuser Machine BOM feature
- Enhanced Shopify webhook integration
- Implemented volume-based BOM calculations

### v1.0.0
- Initial release with basic inventory tracking
- User authentication system
- Product and stock management
- Transaction history

---

