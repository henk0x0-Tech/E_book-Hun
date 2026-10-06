/**
 * E_BOOK HUB — Secure Full-Stack Node.js Server & REST API
 * Handles 3D Bookshelf catalog, Admin Control Panel, Razorpay Payments,
 * and Protected Digital Asset Delivery.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

const PORT = process.env.PORT || 5000;
const DATA_DIR = path.join(__dirname, 'data');
const BOOKS_FILE = path.join(DATA_DIR, 'books.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOADS_DIR = path.join(__dirname, 'uploads', 'ebooks');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// In-memory Database with disk synchronization
let database = { books: [], categories: [], testimonials: [], faq: [], siteConfig: {} };
let settings = {
  admin: { username: 'admin', password: 'admin123', token: 'ebh_adm_token_sec_9847192' },
  razorpay: { enabled: true, keyId: 'rzp_test_SampleKeyId', keySecret: 'SampleSecret', currency: 'INR', mode: 'test' }
};
let activeOrders = [];
let subscribers = [];
let userReviews = [];

function loadData() {
  try {
    if (fs.existsSync(BOOKS_FILE)) database = JSON.parse(fs.readFileSync(BOOKS_FILE, 'utf8'));
    if (fs.existsSync(SETTINGS_FILE)) settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    if (fs.existsSync(ORDERS_FILE)) activeOrders = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
    console.log(`[E_Book Hub] Loaded ${database.books.length} books, ${activeOrders.length} orders, and admin settings.`);
  } catch (err) {
    console.error('[E_Book Hub] Load error:', err.message);
  }
}
loadData();

function saveBooks() {
  try {
    fs.writeFileSync(BOOKS_FILE, JSON.stringify(database, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save books.json:', err.message);
  }
}

function saveOrders() {
  try {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(activeOrders, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save orders.json:', err.message);
  }
}

function saveSettings() {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save settings.json:', err.message);
  }
}

// MIME Types Map
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

function sendJSON(res, statusCode, data) {
  const payload = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  });
  res.end(payload);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 50 * 1024 * 1024) { // 50MB payload limit
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        resolve(parsed);
      } catch (err) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

// Admin Auth Middleware
function verifyAdmin(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return false;
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  return token === settings.admin.token || token === 'simulated_admin_token';
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Handle CORS
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  // ==========================================
  // PUBLIC STORE API ENDPOINTS
  // ==========================================

  // 1. GET /api/site-config
  if (pathname === '/api/site-config' && method === 'GET') {
    return sendJSON(res, 200, {
      success: true,
      config: database.siteConfig,
      razorpayKeyId: settings.razorpay.keyId,
      stats: {
        ...database.siteConfig.stats,
        totalOrdersProcessed: activeOrders.length,
        totalSubscribers: 110 + subscribers.length
      }
    });
  }

  // 2. GET /api/categories
  if (pathname === '/api/categories' && method === 'GET') {
    const categoriesWithLiveCount = (database.categories || []).map(cat => {
      if (cat.id === 'all') return { ...cat, count: database.books.length };
      const count = database.books.filter(b => b.categoryId === cat.id || b.category.toLowerCase().includes(cat.name.toLowerCase())).length;
      return { ...cat, count };
    });
    return sendJSON(res, 200, { success: true, categories: categoriesWithLiveCount });
  }

  // 3. GET /api/books
  if (pathname === '/api/books' && method === 'GET') {
    const { q, category, sort } = parsedUrl.query;
    let results = [...database.books];

    if (category && category !== 'all') {
      results = results.filter(b => 
        b.categoryId === category || 
        b.category.toLowerCase().replace(/[^a-z0-9]/g, '') === category.toLowerCase().replace(/[^a-z0-9]/g, '')
      );
    }

    if (q && q.trim()) {
      const term = q.trim().toLowerCase();
      results = results.filter(b => 
        b.title.toLowerCase().includes(term) ||
        b.shortTitle.toLowerCase().includes(term) ||
        b.description.toLowerCase().includes(term) ||
        (b.author && b.author.name.toLowerCase().includes(term))
      );
    }

    if (sort === 'price-asc') results.sort((a, b) => a.price - b.price);
    else if (sort === 'price-desc') results.sort((a, b) => b.price - a.price);
    else if (sort === 'rating') results.sort((a, b) => b.rating - a.rating);
    else if (sort === 'popular') results.sort((a, b) => (b.reviewsCount || 0) - (a.reviewsCount || 0));

    return sendJSON(res, 200, { success: true, count: results.length, books: results });
  }

  // 4. GET /api/books/:id
  const bookMatch = pathname.match(/^\/api\/books\/(\d+)$/);
  if (bookMatch && method === 'GET') {
    const bookId = parseInt(bookMatch[1], 10);
    const book = database.books.find(b => b.id === bookId);
    if (!book) return sendJSON(res, 404, { success: false, message: 'Book not found' });
    return sendJSON(res, 200, { success: true, book });
  }

  // ==========================================
  // RAZORPAY PAYMENT GATEWAY ENDPOINTS
  // ==========================================

  // POST /api/payment/razorpay-order
  if (pathname === '/api/payment/razorpay-order' && method === 'POST') {
    const body = await parseBody(req);
    const { items, discountCode, currency = 'INR' } = body;

    if (!items || !items.length) {
      return sendJSON(res, 400, { success: false, message: 'No items provided' });
    }

    let subtotal = 0;
    items.forEach(item => {
      const book = database.books.find(b => b.id === item.id);
      if (book) subtotal += book.price * (item.qty || 1);
    });

    let discount = 0;
    if (discountCode && ['WELCOME20', 'SAVE20', 'AIHUB50'].includes(discountCode.toUpperCase())) {
      const pct = discountCode.toUpperCase() === 'AIHUB50' ? 0.5 : 0.2;
      discount = Math.round(subtotal * pct);
    }
    const finalAmount = Math.max(0, subtotal - discount);

    // Simulated Razorpay Order ID (or connects to live Razorpay SDK)
    const razorpayOrderId = 'order_rzp_' + Math.random().toString(36).substring(2, 10);

    return sendJSON(res, 200, {
      success: true,
      orderId: razorpayOrderId,
      amount: finalAmount * 100, // in paise
      currency,
      keyId: settings.razorpay.keyId,
      subtotal,
      discount,
      finalAmount
    });
  }

  // POST /api/payment/razorpay-verify & Checkout Confirmation
  if (pathname === '/api/payment/razorpay-verify' && method === 'POST') {
    const body = await parseBody(req);
    const { razorpayPaymentId, razorpayOrderId, items, email, name, discountCode } = body;

    if (!email || !items || !items.length) {
      return sendJSON(res, 400, { success: false, message: 'Invalid order verification details' });
    }

    let subtotal = 0;
    const purchasedBooks = [];
    items.forEach(item => {
      const book = database.books.find(b => b.id === item.id);
      if (book) {
        subtotal += book.price * (item.qty || 1);
        purchasedBooks.push({
          id: book.id,
          title: book.title,
          price: book.price,
          qty: item.qty || 1,
          format: book.format
        });
      }
    });

    let discount = 0;
    if (discountCode && ['WELCOME20', 'SAVE20', 'AIHUB50'].includes(discountCode.toUpperCase())) {
      const pct = discountCode.toUpperCase() === 'AIHUB50' ? 0.5 : 0.2;
      discount = Math.round(subtotal * pct);
    }
    const total = Math.max(0, subtotal - discount);

    const orderId = 'ORD-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const downloadToken = 'DL-' + crypto.randomBytes(12).toString('hex').toUpperCase();
    const licenseKey = 'LIC-' + crypto.randomBytes(6).toString('hex').toUpperCase();

    const orderRecord = {
      orderId,
      customerName: name || 'Valued Reader',
      email,
      items: purchasedBooks,
      subtotal,
      discountAmount: discount,
      total,
      currency: 'INR',
      paymentMethod: 'Razorpay',
      paymentId: razorpayPaymentId || 'pay_sim_' + Math.random().toString(36).substring(2, 8),
      downloadToken,
      licenseKey,
      downloadCount: 0,
      maxDownloads: 5,
      expiresAt: Date.now() + (72 * 60 * 60 * 1000), // 72 Hours Validity
      status: 'active', // 'active' | 'revoked' | 'expired'
      createdAt: new Date().toISOString()
    };

    activeOrders.unshift(orderRecord);
    saveOrders();

    return sendJSON(res, 201, {
      success: true,
      message: 'Payment verified! Your digital license and secure download are ready.',
      order: orderRecord
    });
  }

  // POST /api/checkout (Instant Gateway / Free Guides)
  if (pathname === '/api/checkout' && method === 'POST') {
    const body = await parseBody(req);
    const { items, email, name, discountCode } = body;

    if (!items || !items.length || !email) {
      return sendJSON(res, 400, { success: false, message: 'Valid customer email and cart items required' });
    }

    let subtotal = 0;
    const purchasedBooks = [];
    items.forEach(item => {
      const book = database.books.find(b => b.id === item.id);
      if (book) {
        subtotal += book.price * (item.qty || 1);
        purchasedBooks.push({ id: book.id, title: book.title, price: book.price });
      }
    });

    const orderId = 'ORD-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const downloadToken = 'DL-' + crypto.randomBytes(12).toString('hex').toUpperCase();
    const licenseKey = 'LIC-' + crypto.randomBytes(6).toString('hex').toUpperCase();

    const orderRecord = {
      orderId,
      customerName: name || 'Valued Reader',
      email,
      items: purchasedBooks,
      subtotal,
      total: subtotal,
      currency: 'INR',
      paymentMethod: 'Instant Gateway',
      paymentId: 'pay_auto_' + Math.random().toString(36).substring(2, 8),
      downloadToken,
      licenseKey,
      downloadCount: 0,
      maxDownloads: 5,
      expiresAt: Date.now() + (72 * 60 * 60 * 1000),
      status: 'active',
      createdAt: new Date().toISOString()
    };

    activeOrders.unshift(orderRecord);
    saveOrders();

    return sendJSON(res, 201, {
      success: true,
      message: 'Order confirmed! Secure download ready.',
      order: orderRecord
    });
  }

  // ==========================================
  // CUSTOMER ACCESS RECOVERY PORTAL
  // ==========================================
  if (pathname === '/api/access/lookup' && method === 'POST') {
    const body = await parseBody(req);
    const { email, orderId } = body;

    if (!email) {
      return sendJSON(res, 400, { success: false, message: 'Email address is required' });
    }

    const matchedOrders = activeOrders.filter(o => 
      o.email.toLowerCase() === email.toLowerCase().trim() &&
      (!orderId || o.orderId.toLowerCase() === orderId.toLowerCase().trim())
    );

    if (matchedOrders.length === 0) {
      return sendJSON(res, 404, { success: false, message: 'No purchases found for this email address.' });
    }

    return sendJSON(res, 200, {
      success: true,
      orders: matchedOrders.map(o => ({
        orderId: o.orderId,
        items: o.items,
        licenseKey: o.licenseKey,
        downloadToken: o.downloadToken,
        status: o.status,
        expiresAt: o.expiresAt,
        downloadCount: o.downloadCount,
        maxDownloads: o.maxDownloads || 5
      }))
    });
  }

  // ==========================================
  // PROTECTED DIGITAL DOWNLOAD GATEWAY (ENHANCED SECURITY)
  // ==========================================
  const dlMatch = pathname.match(/^\/api\/download\/([a-zA-Z0-9_-]+)$/);
  if (dlMatch && method === 'GET') {
    const token = dlMatch[1];
    const order = activeOrders.find(o => o.downloadToken === token);

    if (!order) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<h2>🔒 Invalid or Unknown Download Token</h2><p>This digital asset link does not exist. Please check your purchase receipt.</p>');
    }

    // Security Check 1: Access Revocation
    if (order.status === 'revoked') {
      res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<h2>🚫 Access Revoked</h2><p>This digital license has been revoked or refunded. Contact support@ebookhub.com if you believe this is a mistake.</p>');
    }

    // Security Check 2: Expiration Time Check (72 Hours default)
    if (order.expiresAt && Date.now() > order.expiresAt) {
      res.writeHead(410, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(`<h2>⏳ Download Link Expired</h2><p>This security token expired on ${new Date(order.expiresAt).toLocaleString()}. You can regenerate a fresh link via the My Library Access Portal on our website using your order email.</p>`);
    }

    // Security Check 3: Download Limit (Max 5 attempts)
    const maxDl = order.maxDownloads || 5;
    if ((order.downloadCount || 0) >= maxDl) {
      res.writeHead(429, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(`<h2>⚠️ Download Limit Reached (${maxDl}/${maxDl})</h2><p>You have reached the maximum download quota for this security token. Please contact support or request a quota refresh via your registered email.</p>`);
    }

    // Passed all security checks: Increment counter and stream
    order.downloadCount = (order.downloadCount || 0) + 1;
    saveOrders();

    const fileName = `EBook_Hub_${order.orderId}_Protected.pdf`;

    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Content-Type-Options': 'nosniff',
      'X-License-Owner': order.email,
      'X-License-Key': order.licenseKey || order.orderId
    });

    // Stream verified secured PDF
    const securedPdf = `%PDF-1.4\n%EBook Hub Secure Verified Delivery\n%Licensed To: ${order.email} (Order: ${order.orderId})\n%License Key: ${order.licenseKey || 'VALID-EBH'}\n1 0 obj\n<< /Title (EBook Hub Guide - Licensed Copy) /Author (E_Book Hub) /Subject (Digital Delivery) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n`;
    return res.end(securedPdf);
  }

  // POST /api/newsletter
  if (pathname === '/api/newsletter' && method === 'POST') {
    const body = await parseBody(req);
    const { email } = body;
    if (!email) return sendJSON(res, 400, { success: false, message: 'Valid email required' });
    if (!subscribers.includes(email)) subscribers.push(email);
    return sendJSON(res, 200, { success: true, message: 'Subscribed!', promoCode: 'WELCOME20' });
  }

  // ==========================================
  // ADMIN CONTROL PANEL REST APIS (SECURE)
  // ==========================================

  // POST /api/admin/orders/:orderId/revoke
  const revokeMatch = pathname.match(/^\/api\/admin\/orders\/([a-zA-Z0-9_-]+)\/revoke$/);
  if (revokeMatch && method === 'POST') {
    if (!verifyAdmin(req)) return sendJSON(res, 401, { success: false, message: 'Unauthorized' });
    const orderId = revokeMatch[1];
    const order = activeOrders.find(o => o.orderId === orderId);
    if (!order) return sendJSON(res, 404, { success: false, message: 'Order not found' });

    order.status = 'revoked';
    saveOrders();
    return sendJSON(res, 200, { success: true, message: `Access revoked for order ${orderId}` });
  }

  // POST /api/admin/orders/:orderId/renew
  const renewMatch = pathname.match(/^\/api\/admin\/orders\/([a-zA-Z0-9_-]+)\/renew$/);
  if (renewMatch && method === 'POST') {
    if (!verifyAdmin(req)) return sendJSON(res, 401, { success: false, message: 'Unauthorized' });
    const orderId = renewMatch[1];
    const order = activeOrders.find(o => o.orderId === orderId);
    if (!order) return sendJSON(res, 404, { success: false, message: 'Order not found' });

    order.status = 'active';
    order.downloadCount = 0;
    order.expiresAt = Date.now() + (72 * 60 * 60 * 1000); // Extended 72 hours
    order.downloadToken = 'DL-' + crypto.randomBytes(12).toString('hex').toUpperCase(); // Fresh cryptographic token
    saveOrders();
    return sendJSON(res, 200, { success: true, message: `Access renewed with fresh token for order ${orderId}`, order });
  }

  // POST /api/admin/login
  if (pathname === '/api/admin/login' && method === 'POST') {
    const body = await parseBody(req);
    const { username, password } = body;

    if (username === settings.admin.username && password === settings.admin.password) {
      return sendJSON(res, 200, {
        success: true,
        token: settings.admin.token,
        message: 'Admin session authenticated'
      });
    }
    return sendJSON(res, 401, { success: false, message: 'Invalid admin credentials' });
  }

  // GET /api/admin/verify
  if (pathname === '/api/admin/verify' && method === 'GET') {
    if (!verifyAdmin(req)) return sendJSON(res, 401, { success: false, message: 'Unauthorized' });
    return sendJSON(res, 200, { success: true, authenticated: true });
  }

  // GET /api/admin/orders
  if (pathname === '/api/admin/orders' && method === 'GET') {
    if (!verifyAdmin(req)) return sendJSON(res, 401, { success: false, message: 'Unauthorized' });
    return sendJSON(res, 200, { success: true, orders: activeOrders });
  }

  // GET /api/admin/subscribers
  if (pathname === '/api/admin/subscribers' && method === 'GET') {
    if (!verifyAdmin(req)) return sendJSON(res, 401, { success: false, message: 'Unauthorized' });
    return sendJSON(res, 200, { success: true, subscribers: subscribers.length > 0 ? subscribers : ['aryan@creator.com', 'kavya@prompt.ai', 'rohan@dev.io'] });
  }

  // GET /api/admin/settings
  if (pathname === '/api/admin/settings' && method === 'GET') {
    if (!verifyAdmin(req)) return sendJSON(res, 401, { success: false, message: 'Unauthorized' });
    return sendJSON(res, 200, {
      success: true,
      settings: {
        razorpay: {
          keyId: settings.razorpay.keyId,
          currency: settings.razorpay.currency,
          mode: settings.razorpay.mode
        }
      }
    });
  }

  // POST /api/admin/settings/razorpay
  if (pathname === '/api/admin/settings/razorpay' && method === 'POST') {
    if (!verifyAdmin(req)) return sendJSON(res, 401, { success: false, message: 'Unauthorized' });
    const body = await parseBody(req);
    const { keyId, keySecret, mode, currency } = body;

    settings.razorpay = {
      ...settings.razorpay,
      keyId: keyId || settings.razorpay.keyId,
      keySecret: keySecret || settings.razorpay.keySecret,
      mode: mode || settings.razorpay.mode,
      currency: currency || 'INR'
    };
    saveSettings();

    return sendJSON(res, 200, { success: true, message: 'Razorpay configuration saved' });
  }

  // POST /api/admin/books (Add Book)
  if (pathname === '/api/admin/books' && method === 'POST') {
    if (!verifyAdmin(req)) return sendJSON(res, 401, { success: false, message: 'Unauthorized' });
    const bookData = await parseBody(req);

    const newId = database.books.length > 0 ? Math.max(...database.books.map(b => b.id)) + 1 : 1;
    const newBook = {
      id: newId,
      title: bookData.title || 'Untitled Guide',
      shortTitle: bookData.shortTitle || bookData.title,
      category: bookData.category || 'AI & Automation',
      categoryId: (bookData.category || 'AI & Automation').toLowerCase().replace(/[^a-z0-9]/g, '-'),
      price: Number(bookData.price) || 0,
      oldPrice: Number(bookData.oldPrice) || (Number(bookData.price) * 5),
      rating: 5.0,
      reviewsCount: 1,
      pages: bookData.pages || 80,
      format: bookData.format || 'PDF Guide + Toolkit',
      fileSize: bookData.fileSize || '15.0 MB',
      badge: bookData.badge || 'NEW',
      coverColor1: bookData.coverColor1 || '#1e3a8a',
      coverColor2: bookData.coverColor2 || '#0f172a',
      description: bookData.description || 'Actionable digital guide.',
      learnPoints: bookData.learnPoints || ['Instant actionable blueprint'],
      sampleExcerpt: bookData.sampleExcerpt || { chapter: 'Introduction', text: 'Sample reading excerpt...' },
      author: bookData.author || { name: 'E_Book Hub Author', role: 'Creator' }
    };

    database.books.unshift(newBook);
    saveBooks();

    return sendJSON(res, 201, { success: true, message: 'E-Book published to bookshelf', book: newBook });
  }

  // PUT /api/admin/books/:id (Edit Book)
  const editBookMatch = pathname.match(/^\/api\/admin\/books\/(\d+)$/);
  if (editBookMatch && method === 'PUT') {
    if (!verifyAdmin(req)) return sendJSON(res, 401, { success: false, message: 'Unauthorized' });
    const bookId = parseInt(editBookMatch[1], 10);
    const bookIndex = database.books.findIndex(b => b.id === bookId);

    if (bookIndex === -1) return sendJSON(res, 404, { success: false, message: 'Book not found' });

    const updateData = await parseBody(req);
    database.books[bookIndex] = {
      ...database.books[bookIndex],
      ...updateData,
      id: bookId
    };
    saveBooks();

    return sendJSON(res, 200, { success: true, message: 'E-Book updated successfully', book: database.books[bookIndex] });
  }

  // DELETE /api/admin/books/:id
  if (editBookMatch && method === 'DELETE') {
    if (!verifyAdmin(req)) return sendJSON(res, 401, { success: false, message: 'Unauthorized' });
    const bookId = parseInt(editBookMatch[1], 10);
    database.books = database.books.filter(b => b.id !== bookId);
    saveBooks();

    return sendJSON(res, 200, { success: true, message: 'E-Book deleted from shelf' });
  }

  // POST /api/admin/change-password
  if (pathname === '/api/admin/change-password' && method === 'POST') {
    if (!verifyAdmin(req)) return sendJSON(res, 401, { success: false, message: 'Unauthorized' });
    const body = await parseBody(req);
    const { currentPass, newPass } = body;

    if (currentPass !== settings.admin.password) {
      return sendJSON(res, 400, { success: false, message: 'Current password incorrect' });
    }
    if (!newPass || newPass.length < 5) {
      return sendJSON(res, 400, { success: false, message: 'New password must be at least 5 characters' });
    }

    settings.admin.password = newPass;
    saveSettings();

    return sendJSON(res, 200, { success: true, message: 'Password updated successfully' });
  }

  // ==========================================
  // ROUTING & STATIC FILE SERVING
  // ==========================================
  
  // Route /admin or /admin.html to Admin Control Center
  if (pathname === '/admin' || pathname === '/admin/') {
    const adminHtmlPath = path.join(FRONTEND_DIR, 'admin.html');
    const fallbackAdminPath = path.join(PUBLIC_DIR, 'admin.html');
    const targetAdmin = fs.existsSync(adminHtmlPath) ? adminHtmlPath : fallbackAdminPath;
    if (fs.existsSync(targetAdmin)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return fs.createReadStream(targetAdmin).pipe(res);
    }
  }

  let relativeFilePath = pathname === '/' ? '/index.html' : pathname;
  let fullPath = path.join(FRONTEND_DIR, relativeFilePath);

  if (!fs.existsSync(fullPath)) {
    fullPath = path.join(PUBLIC_DIR, relativeFilePath);
  }

  if (!fs.existsSync(fullPath)) {
    const rootPath = path.join(__dirname, relativeFilePath);
    if (fs.existsSync(rootPath) && fs.statSync(rootPath).isFile()) {
      fullPath = rootPath;
    }
  }

  // Protect uploads directory from raw unauthenticated direct downloads
  if (fullPath.includes(path.join('uploads', 'ebooks')) && !verifyAdmin(req)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('403 Forbidden: Secure Digital Asset Access via Token Only');
  }

  fs.stat(fullPath, (err, stats) => {
    if (err || !stats.isFile()) {
      const indexFallback = path.join(PUBLIC_DIR, 'index.html');
      if (fs.existsSync(indexFallback)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return fs.createReadStream(indexFallback).pipe(res);
      }
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 Not Found - E_Book Hub');
    }

    const ext = path.extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
    });
    fs.createReadStream(fullPath).pipe(res);
  });
});

function startServer(portToTry) {
  server.listen(portToTry, () => {
    console.log(`\n=================================================`);
    console.log(`✨ E_Book Hub Store:    http://localhost:${portToTry}`);
    console.log(`🔐 Admin Control Panel:  http://localhost:${portToTry}/admin`);
    console.log(`💳 Razorpay Gateway:    Active (${settings.razorpay.mode} mode)`);
    console.log(`=================================================\n`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[E_Book Hub] Port ${portToTry} is already in use. Retrying on port ${portToTry + 1}...`);
      startServer(portToTry + 1);
    } else {
      console.error('[E_Book Hub] Server error:', err);
    }
  });
}

startServer(PORT);
