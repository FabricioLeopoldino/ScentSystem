________________________________________________________________________________________________________________________


ScentSystem — Inventory Management for Fragrance Operations

________________________________________________________________________________________________________________________


ScentSystem is a full-stack inventory management platform designed for fragrance and component tracking, with real-time stock control and Shopify order integration.
Built to handle products, raw materials, BOM recipes, and transaction history in a structured and scalable way.

________________________________________________________________________________________________________________________

Features
- Product & Component Management (oils, bottles, caps, materials)
- Real-time Inventory Tracking
- Shopify Order Webhook Integration
- Multi-user Authentication & Role System
- Bill of Materials (BOM) Support
- File & Document Attachments
- Full Transaction History & Audit Trail
- SKU Mapping with Shopify Products
- Excel Data Export
________________________________________________________________________________________________________________________

Tech Stack - Backend
- Node.js (Express)
- PostgreSQL
- Bcrypt (password hashing)
- Multer (file uploads)
________________________________________________________________________________________________________________________

Tech Stack - Frontend
- React 18
- Vite
- Wouter (lightweight routing)
- Lucide React (icons)
________________________________________________________________________________________________________________________

Infrastructure
Render (Hosting) > For Testing
PostgreSQL (Render / external) > For Testing
GitHub (Version Control)
________________________________________________________________________________________________________________________

# Free for Testing #
Quick Deployment (Render)
Prerequisites
A Render account
A PostgreSQL database
A GitHub repository
(Optional) Shopify store for webhook integration 
Deployment Steps
Create a PostgreSQL database on Render
Copy your internal DATABASE_URL
Upload this project to your GitHub repository
Create a new Web Service on Render and connect the repo
Configure the environment variables (see below)
Deploy and wait for the build to complete
After deployment, Render will provide a public URL for the application.

________________________________________________________________________________________________________________________

Environment Configuration (Security First)

This project uses environment variables for all sensitive data.
Never commit real credentials to the repository.

- - - - - - - - - - >  Create a .env file in the root directory:

|| DATABASE_URL=your_postgresql_connection_string ||
|| NODE_ENV=development ||
|| PORT=3000 ||
|| SESSION_SECRET=your_secure_random_secret ||

Important:
Do NOT expose database credentials in the README
Do NOT commit .env to GitHub
Always use a .env.example file for reference

- - - - - - - - - - >  Example .env.example:

|| DATABASE_URL=postgresql://user:password@host:5432/database ||
|| NODE_ENV=development ||
|| PORT=3000 ||
|| SESSION_SECRET=change_this_in_production ||

________________________________________________________________________________________________________________________

Authentication & Access

For security reasons, default credentials are not stored in the repository.
After initializing the database schema:
Create an admin user manually or via seed script
Change all initial credentials immediately in production

- - - - - - - - - - >  Best practice:

- - - - - - - - - - >  Use strong passwords

- - - - - - - - - - >  Rotate secrets regularly

- - - - - - - - - - >  Avoid hardcoding credentials in source files

________________________________________________________________________________________________________________________

Local Development
# Clone the repository
   git clone https://github.com/your-username/scentsystem.git
   cd scentsystem

# Install dependencies
   npm install

# Create environment file
   cp .env.example .env
# Then edit the values with your local credentials


# Start development server
npm run dev

Frontend will be available at:
   http://localhost:5173

________________________________________________________________________________________________________________________

Shopify Webhook Integration Setup

Go to Shopify Admin → Settings → Notifications → Webhooks
Create a new webhook:
   Event: Order Creation
   Format: JSON
   URL:
   https://your-app-domain.com/api/webhooks/shopify/orders/create

________________________________________________________________________________________________________________________

API Version: Latest

Workflow
Customer places an order on Shopify
        ↓
Shopify sends webhook payload
        ↓
System processes SKUs
        ↓
Stock quantities are automatically deducted
        ↓
Transaction record is created
        ↓
Inventory is updated in real time

________________________________________________________________________________________________________________________

Database Structure

Main tables:

users          - System users & roles
products       - Products and raw materials
transactions   - Inventory movement history
bom            - Bill of Materials (recipes)
attachments    - Uploaded files and documents

________________________________________________________________________________________________________________________

Project Structure

SA_ScentSystem-POSTGRES/
├── server/
│   └── index.js              # Express API + PostgreSQL logic
├── src/
│   ├── App.jsx               # Main application
│   ├── main.jsx              # Entry point
│   └── pages/                # Application pages
│       ├── Login.jsx
│       ├── Dashboard.jsx
│       ├── ProductManagement.jsx
│       ├── StockManagement.jsx
│       ├── SkuMapping.jsx
│       ├── BOMViewer.jsx
│       ├── TransactionHistory.jsx
│       ├── Attachments.jsx
│       └── UserManagement.jsx
├── public/
├── package.json
└── vite.config.js

________________________________________________________________________________________________________________________

Data Migration

If you previously used a JSON-based database:
   npm run migrate
This will safely migrate legacy data to PostgreSQL.

________________________________________________________________________________________________________________________

Performance Notes

PostgreSQL connection pooling
Indexed critical columns
ACID-compliant transactions
Optimized queries for inventory operations

________________________________________________________________________________________________________________________

Security Practices

Password hashing with bcrypt
Prepared statements (SQL injection protection)
Environment-based configuration
File type validation for uploads
CORS configuration
No hardcoded secrets in source code
Recommended for production:
Enable HTTPS
Use strong session secrets
Restrict database access by IP
Implement rate limiting (optional)

________________________________________________________________________________________________________________________

Troubleshooting

Database connection issues
   echo $DATABASE_URL
   psql $DATABASE_URL

Webhook not triggering
   curl -X POST https://your-app-domain.com/api/webhooks/shopify/orders/create \
     -H "Content-Type: application/json" \
     -d '{"id":123,"line_items":[]}'

Missing data in dashboard
   SELECT COUNT(*) FROM products;
   SELECT COUNT(*) FROM transactions;

Available Scripts
   npm run dev          # Development mode (frontend + backend)
   npm run build        # Production build
   npm start            # Start production server
   npm run migrate      # Migrate JSON data to PostgreSQL  < Script if need send me a Email
   npm run render-build # Render build process (Free) 

________________________________________________________________________________________________________________________

Roadmap

- Advanced analytics dashboard
- Low stock notifications
- Multi-warehouse support
- Cloud storage for attachments
- External API integrations
- Automated reporting system



________________________________________________________________________________________________________________________

License

Private use.
For internal inventory and operational management.

________________________________________________________________________________________________________________________

Author

Fabricio Leopoldino
   https://www.linkedin.com/in/fabricioleopoldino/
Brasil > Australia
sKp187Mv7kDkpWVtW0pHl1d6Au4sGivkf0LNjU6Po5acu24UiazZC9QWmTDTlTzeOjxkuECAfjBt_ICxeOXiVGPstfvJwjPCawrVnkPU-L7uMkg2gtO3p2n0uXCsgzxPC5Le-Lnuat7WPuLwLPDbkEVM9Wqjv4jG4vCCDl-L99dc2Kpod-ZCKx7ojgoVv0oLNFKkk_NLHoOzhDce4cMifpD-T2-GoBheJ92gg8_1G1IbcOeOCsPKHl8TSNw01yqWB2qD57mezJsXhf8JEHB4aAvEgDu9mAWYKX0QtFZnW_b49VUT6rhJR6N1nfQx1-38DCwwDTIfn3lB8Pz198YXS8F-TswZDuedDdxt_l7OU7RXVSy9E4YLgx_vZ_oDUPy_vl7Vo23gCl8BQqK27_LX1AEKVXKhvycbAPN1zaBgmc8fix7cm9StncAWKHxYuR78PHdUp0SlmoaycjAOYRFxrh7jdu91y-k7UthfH_GybP0


   Version: #Test to Production > Next Step Azure ! 
      Status: Testing 
         Last Updated: 20/02/2026 
            Deployment: Render + PostgreSQL #Free


________________________________________________________________________________________________________________________

PLUS ! 

uptimerobot.com/monitors


________________________________________________________________________________________________________________________
