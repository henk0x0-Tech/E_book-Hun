# 📚 E_Book Hub — 3D Digital Bookshelf & Secure E-Commerce Store

> A modern, high-converting digital bookstore with **3D realistic book rendering**, **Admin Control Panel**, **Razorpay Payment Gateway Integration**, and **4-Layer Digital Rights & Access Security**.

---

## 🏗️ Project Architecture (Frontend & Backend Separated)

```
E_Book-Hub/
├── frontend/                     # 🌐 Client Web Interface
│   ├── index.html                # Public 3D Digital Bookshelf Store
│   ├── admin.html                # Protected Admin Control Panel
│   ├── css/
│   │   ├── style.css             # Luxury 3D Bookshelf & Store Styling
│   │   └── admin.css             # Control Center Glassmorphism Styling
│   └── js/
│       ├── app.js                # Dynamic Store, 3D Tilt, Cart & Razorpay Checkout
│       └── admin.js              # Admin Dashboard Controller & API Bindings
│
├── backend/                      # ⚙️ Node.js REST API & Digital Delivery Engine
│   ├── server.js                 # Native Node.js Server & Secure Download Gateway
│   ├── package.json              # Backend Package Config
│   ├── data/
│   │   ├── books.json            # E-Book Catalog & Learn Points Database
│   │   ├── settings.json         # Master Credentials & Razorpay Keys
│   │   └── orders.json           # Customer Purchases & Cryptographic Tokens
│   └── uploads/
│       └── ebooks/               # 🔒 Protected Digital Asset Storage
│
├── .gitignore
├── package.json                  # Root Monorepo Orchestration
└── README.md
```

---

## ✨ Features

### 🛍️ Frontend Store
- **Realistic 3D Perspective Books**: Embossed hardcover crease, gold foil badges, paper thickness edges, and dynamic 3D mouse parallax tilt.
- **Wooden Shelf UI**: Mahogany shelf boards with ambient LED lighting.
- **Instant Search & Filters**: Debounced search bar (with `/` keyboard shortcut) + scrollable category chips.
- **Interactive "Look Inside" Previewer**: Sample reader modal before buying.
- **Cart & Slide-over Drawer**: Dynamic multi-currency converter (`₹ INR`, `$ USD`, `€ EUR`, `£ GBP`), promo codes (`WELCOME20`, `AIHUB50`).
- **Razorpay Checkout SDK**: Seamless popup supporting **UPI / GPay / PhonePe / Cards / NetBanking**.

### 🔐 Admin Control Center (`/admin`)
- **Default Master Password**: `admin123` *(Customizable in Settings)*.
- **E-Book Creator & Drag-and-Drop Uploader**: Upload eBooks (PDF/EPUB up to 100MB), set prices, cover colors, author details, and sample excerpts.
- **Razorpay Manager**: Toggle between **Test Sandbox** and **Live Production**, configure API Key ID & Secret with one-click test validator.
- **Order & Access Management**: View real transactions, track token downloads (`x/5 dl`), and click **`🔄 Re-issue`** or **`🚫 Revoke`**.
- **Subscriber Leads**: Export 110+ reader emails to CSV.

### 🛡️ Digital Delivery & Anti-Piracy Security
1. **Raw Storage Protected**: Direct URLs to `uploads/ebooks/` are blocked (`403 Forbidden`).
2. **Cryptographic One-Time Tokens**: Generated upon verified purchase with **72-hour validity** and **5-download max limit**.
3. **Protected Cloud Reader**: Watermarked with buyer email (`Licensed to: customer@email.com`) to deter unauthorized redistribution.

---

## 🚀 Quick Start

### 1. Run with Node.js
```bash
# Clone the repository
git clone https://github.com/henk0x0-Tech/E_book-Hun.git
cd E_book-Hun

# Start the full stack application
npm start
```

### 2. Access the Application
- 🌐 **Storefront**: [http://localhost:5000](http://localhost:5000)
- 🔐 **Admin Dashboard**: [http://localhost:5000/admin](http://localhost:5000/admin) *(Password: `admin123`)*

---

## 💳 Razorpay Configuration

1. Log in to the **Admin Dashboard** at `http://localhost:5000/admin`.
2. Go to the **Razorpay Payments** tab.
3. Enter your **Key ID** and **Key Secret**.
4. Select **Test Mode** (for testing) or **Live Mode** (for real money transactions).
5. Click **Save Razorpay Settings**.

---

## 📜 License
MIT License • Built for high performance and secure digital product sales.
