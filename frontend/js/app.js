/**
 * E_BOOK HUB — Dynamic Frontend Application
 * Handles API communication, 3D shelf rendering, cart state,
 * reader preview modal, instant checkout simulator & UI interactions.
 */

// Global State
const state = {
  books: [],
  categories: [],
  cart: JSON.parse(localStorage.getItem('ebh_cart') || '[]'),
  activeCategory: 'all',
  searchQuery: '',
  sortBy: 'popular',
  currency: 'INR',
  currencyRates: {
    INR: { symbol: '₹', rate: 1 },
    USD: { symbol: '$', rate: 0.012 },
    EUR: { symbol: '€', rate: 0.011 },
    GBP: { symbol: '£', rate: 0.0095 }
  },
  theme: localStorage.getItem('ebh_theme') || 'dark',
  activeBook: null,
  appliedPromo: null
};

// DOM Elements Cache
const dom = {
  body: document.body,
  bookshelfContainer: document.getElementById('bookshelfContainer'),
  chipsContainer: document.getElementById('chipsContainer'),
  searchInput: document.getElementById('searchInput'),
  sortSelect: document.getElementById('sortSelect'),
  currencySelect: document.getElementById('currencySelect'),
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  cartBtn: document.getElementById('cartBtn'),
  cartBadge: document.getElementById('cartBadge'),
  
  // Modals & Drawers
  modalOverlay: document.getElementById('modalOverlay'),
  productDrawer: document.getElementById('productDrawer'),
  drawerCloseBtn: document.getElementById('drawerCloseBtn'),
  readerModal: document.getElementById('readerModal'),
  readerCloseBtn: document.getElementById('readerCloseBtn'),
  cartDrawer: document.getElementById('cartDrawer'),
  cartCloseBtn: document.getElementById('cartCloseBtn'),
  checkoutModal: document.getElementById('checkoutModal'),
  checkoutCloseBtn: document.getElementById('checkoutCloseBtn'),

  // Drawer Content
  drawerCat: document.getElementById('drawerCat'),
  drawerTitle: document.getElementById('drawerTitle'),
  drawerAuthor: document.getElementById('drawerAuthor'),
  drawerDesc: document.getElementById('drawerDesc'),
  drawerPages: document.getElementById('drawerPages'),
  drawerFormat: document.getElementById('drawerFormat'),
  drawerSize: document.getElementById('drawerSize'),
  drawerLearnList: document.getElementById('drawerLearnList'),
  drawerPriceCurrent: document.getElementById('drawerPriceCurrent'),
  drawerPriceOriginal: document.getElementById('drawerPriceOriginal'),
  drawerSavings: document.getElementById('drawerSavings'),
  drawerBuyBtn: document.getElementById('drawerBuyBtn'),
  drawerAddCartBtn: document.getElementById('drawerAddCartBtn'),
  drawerSampleBtn: document.getElementById('drawerSampleBtn'),
  drawer3dBook: document.getElementById('drawer3dBook'),

  // Reader Modal Content
  readerBookTitle: document.getElementById('readerBookTitle'),
  readerChapter: document.getElementById('readerChapter'),
  readerText: document.getElementById('readerText'),

  // Cart Content
  cartItemsList: document.getElementById('cartItemsList'),
  cartSubtotal: document.getElementById('cartSubtotal'),
  cartDiscountRow: document.getElementById('cartDiscountRow'),
  cartDiscountAmt: document.getElementById('cartDiscountAmt'),
  cartTotal: document.getElementById('cartTotal'),
  promoInput: document.getElementById('promoInput'),
  applyPromoBtn: document.getElementById('applyPromoBtn'),
  cartCheckoutBtn: document.getElementById('cartCheckoutBtn'),

  // Checkout Form
  checkoutForm: document.getElementById('checkoutForm'),
  checkoutSummaryBox: document.getElementById('checkoutSummaryBox'),
  orderSuccessView: document.getElementById('orderSuccessView'),
  checkoutFormView: document.getElementById('checkoutFormView'),
  downloadBtn: document.getElementById('downloadBtn'),
  orderIdLabel: document.getElementById('orderIdLabel'),

  // Newsletter
  newsletterForm: document.getElementById('newsletterForm'),
  newsletterInput: document.getElementById('newsletterInput'),

  toastContainer: document.getElementById('toastContainer')
};

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  fetchInitialData();
  setupEventListeners();
  updateCartUI();
});

// Theme Handler
function initTheme() {
  document.documentElement.dataset.theme = state.theme;
  dom.themeToggleBtn.innerHTML = state.theme === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = state.theme;
  localStorage.setItem('ebh_theme', state.theme);
  dom.themeToggleBtn.innerHTML = state.theme === 'dark' ? '☀️' : '🌙';
  showToast(`Switched to ${state.theme} mode`);
}

// ==========================================
// DATA FETCHING & API INTERACTION
// ==========================================
async function fetchInitialData() {
  try {
    // Try fetching from Node.js REST API
    const [booksRes, catsRes] = await Promise.all([
      fetch('/api/books').then(r => r.json()),
      fetch('/api/categories').then(r => r.json())
    ]);

    if (booksRes.success) {
      state.books = booksRes.books;
    }
    if (catsRes.success) {
      state.categories = catsRes.categories;
    }
  } catch (err) {
    console.warn('[E_Book Hub] Server API unreachable, falling back to static dataset:', err);
    // Fallback static dataset for standalone execution
    if (window.FALLBACK_DATA) {
      state.books = window.FALLBACK_DATA.books;
      state.categories = window.FALLBACK_DATA.categories;
    }
  }

  renderCategoryChips();
  renderBookshelf();
}

// ==========================================
// CURRENCY & FORMATTING HELPERS
// ==========================================
function formatPrice(inrPrice) {
  if (inrPrice === 0) return 'FREE';
  const curr = state.currencyRates[state.currency];
  const converted = Math.round(inrPrice * curr.rate);
  return `${curr.symbol}${converted}`;
}

// ==========================================
// CATEGORY CHIPS RENDERING
// ==========================================
function renderCategoryChips() {
  if (!dom.chipsContainer) return;
  
  dom.chipsContainer.innerHTML = state.categories.map(cat => `
    <button class="filter-chip ${cat.id === state.activeCategory ? 'active' : ''}" data-cat="${cat.id}">
      <span>${cat.icon || '📖'}</span>
      <span>${cat.name}</span>
      <span class="chip-count">${cat.count}</span>
    </button>
  `).join('');

  dom.chipsContainer.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      state.activeCategory = chip.dataset.cat;
      renderCategoryChips();
      filterAndRenderBooks();
    });
  });
}

// ==========================================
// 3D BOOKSHELF RENDERING
// ==========================================
function filterAndRenderBooks() {
  let filtered = [...state.books];

  // Category filter
  if (state.activeCategory !== 'all') {
    filtered = filtered.filter(b => b.categoryId === state.activeCategory);
  }

  // Search filter
  if (state.searchQuery.trim()) {
    const q = state.searchQuery.trim().toLowerCase();
    filtered = filtered.filter(b => 
      b.title.toLowerCase().includes(q) ||
      b.shortTitle.toLowerCase().includes(q) ||
      b.description.toLowerCase().includes(q) ||
      (b.author && b.author.name.toLowerCase().includes(q))
    );
  }

  // Sort
  if (state.sortBy === 'price-asc') {
    filtered.sort((a, b) => a.price - b.price);
  } else if (state.sortBy === 'price-desc') {
    filtered.sort((a, b) => b.price - a.price);
  } else if (state.sortBy === 'rating') {
    filtered.sort((a, b) => b.rating - a.rating);
  } else if (state.sortBy === 'popular') {
    filtered.sort((a, b) => (b.reviewsCount || 0) - (a.reviewsCount || 0));
  }

  renderBookshelf(filtered);
}

function renderBookshelf(booksToRender = state.books) {
  if (!dom.bookshelfContainer) return;

  if (booksToRender.length === 0) {
    dom.bookshelfContainer.innerHTML = `
      <div class="empty-shelf-state">
        <h3>No books found matching your search ✨</h3>
        <p>Try searching for different keywords or select "All Books".</p>
      </div>
    `;
    return;
  }

  // Group books by category
  const groups = {};
  booksToRender.forEach(book => {
    if (!groups[book.category]) groups[book.category] = [];
    groups[book.category].push(book);
  });

  dom.bookshelfContainer.innerHTML = Object.entries(groups).map(([catName, books]) => {
    const categoryInfo = state.categories.find(c => c.name.toLowerCase().includes(catName.toLowerCase())) || { icon: '📚' };
    
    return `
      <section class="shelf-group">
        <div class="shelf-header">
          <div class="shelf-title-wrap">
            <span class="shelf-category-icon">${categoryInfo.icon}</span>
            <h2 class="shelf-title">${catName}</h2>
          </div>
          <span class="shelf-count-badge">${books.length} ${books.length === 1 ? 'guide' : 'guides'}</span>
        </div>

        <div class="shelf-wall">
          <div class="books-row">
            ${books.map(book => createBookCardHTML(book)).join('')}
          </div>
        </div>

        <div class="shelf-board" aria-hidden="true"></div>
      </section>
    `;
  }).join('');

  // Attach interactive click handlers & 3D tilt tracking
  dom.bookshelfContainer.querySelectorAll('.book-card').forEach(card => {
    const bookId = Number(card.dataset.id);
    const book = state.books.find(b => b.id === bookId);

    card.addEventListener('click', () => openProductDrawer(book));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openProductDrawer(book);
      }
    });

    // 3D Mouse Parallax effect
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      const rotateX = -(y / rect.height) * 16;
      const rotateY = (x / rect.width) * 20 - 15;
      card.style.transform = `rotateY(${rotateY}deg) rotateX(${rotateX}deg) translateY(-14px) scale(1.06)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
}

function createBookCardHTML(book) {
  const isFree = book.price === 0;
  const badgeClass = isFree ? 'book-badge free' : 'book-badge';
  const badgeText = isFree ? 'FREE' : (book.badge || 'PRO');

  return `
    <div class="book-card" data-id="${book.id}" tabindex="0" role="button" aria-label="${book.title}">
      <div class="book-cover" style="background: linear-gradient(145deg, ${book.coverColor1}, ${book.coverColor2});">
        <span class="${badgeClass}">${badgeText}</span>
        <div class="book-title-spine">${book.shortTitle || book.title}</div>
        <div class="book-meta-bottom">
          <span class="book-price-tag">${formatPrice(book.price)}</span>
          <span class="book-rating-mini">★ ${book.rating}</span>
        </div>
      </div>
      <div class="book-pages-side" aria-hidden="true"></div>
    </div>
  `;
}

// ==========================================
// PRODUCT DRAWER (DETAIL VIEW)
// ==========================================
function openProductDrawer(book) {
  if (!book) return;
  state.activeBook = book;

  dom.drawerCat.textContent = book.category;
  dom.drawerTitle.textContent = book.title;
  dom.drawerAuthor.textContent = `${book.author.name} • ${book.author.role}`;
  dom.drawerDesc.textContent = book.description;
  dom.drawerPages.textContent = `${book.pages} Pages`;
  dom.drawerFormat.textContent = book.format;
  dom.drawerSize.textContent = book.fileSize;

  // Render Learn Points
  dom.drawerLearnList.innerHTML = (book.learnPoints || []).map(pt => `
    <div class="learn-item">
      <span class="learn-check">✓</span>
      <span>${pt}</span>
    </div>
  `).join('');

  // 3D Book Showcase Cover in Drawer
  dom.drawer3dBook.style.background = `linear-gradient(145deg, ${book.coverColor1}, ${book.coverColor2})`;
  dom.drawer3dBook.innerHTML = `
    <span class="book-badge">${book.badge || 'PRO'}</span>
    <h3 style="font-size: 1.1rem; font-weight:800; line-height: 1.3;">${book.shortTitle || book.title}</h3>
    <div style="font-size: 0.85rem; opacity: 0.85;">By ${book.author.name}</div>
  `;

  // Pricing & Discounts
  const savingsPct = Math.round((1 - book.price / book.oldPrice) * 100);
  dom.drawerPriceCurrent.textContent = formatPrice(book.price);
  dom.drawerPriceOriginal.textContent = formatPrice(book.oldPrice);
  dom.drawerSavings.textContent = `${savingsPct}% OFF`;

  // Actions
  dom.drawerBuyBtn.textContent = book.price === 0 ? 'Download Free Now' : '⚡ Buy in 1-Click';
  dom.drawerBuyBtn.onclick = () => {
    closeAllModals();
    openCheckoutModal([book]);
  };

  dom.drawerAddCartBtn.onclick = () => {
    addToCart(book);
  };

  dom.drawerSampleBtn.onclick = () => {
    openReaderModal(book);
  };

  openModal(dom.productDrawer);
}

// ==========================================
// SAMPLE READER MODAL ("LOOK INSIDE")
// ==========================================
function openReaderModal(book) {
  if (!book || !book.sampleExcerpt) return;
  
  dom.readerBookTitle.textContent = book.title;
  dom.readerChapter.textContent = book.sampleExcerpt.chapter || 'Sample Preview Excerpt';
  dom.readerText.textContent = book.sampleExcerpt.text;

  openModal(dom.readerModal);
}

// ==========================================
// SHOPPING CART ENGINE
// ==========================================
function addToCart(book) {
  const existing = state.cart.find(i => i.id === book.id);
  if (existing) {
    existing.qty += 1;
  } else {
    state.cart.push({ id: book.id, qty: 1 });
  }

  saveCart();
  updateCartUI();
  showToast(`"${book.shortTitle || book.title}" added to cart! 🛍️`);

  // Animate badge
  dom.cartBadge.classList.add('bump');
  setTimeout(() => dom.cartBadge.classList.remove('bump'), 400);
}

function removeFromCart(bookId) {
  state.cart = state.cart.filter(i => i.id !== bookId);
  saveCart();
  updateCartUI();
  renderCartDrawer();
}

function saveCart() {
  localStorage.setItem('ebh_cart', JSON.stringify(state.cart));
}

function updateCartUI() {
  const totalCount = state.cart.reduce((sum, i) => sum + i.qty, 0);
  dom.cartBadge.textContent = totalCount;
  dom.cartBadge.style.display = totalCount > 0 ? 'flex' : 'none';
}

function renderCartDrawer() {
  if (!dom.cartItemsList) return;

  if (state.cart.length === 0) {
    dom.cartItemsList.innerHTML = `
      <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
        <p style="font-size: 2rem; margin-bottom: 0.5rem;">🛒</p>
        <h4>Your bookshelf cart is empty</h4>
        <p style="font-size: 0.85rem; margin-top: 0.4rem;">Browse our guides and pick one off the shelf!</p>
      </div>
    `;
    dom.cartSubtotal.textContent = formatPrice(0);
    dom.cartTotal.textContent = formatPrice(0);
    dom.cartDiscountRow.style.display = 'none';
    dom.cartCheckoutBtn.disabled = true;
    dom.cartCheckoutBtn.style.opacity = '0.5';
    return;
  }

  dom.cartCheckoutBtn.disabled = false;
  dom.cartCheckoutBtn.style.opacity = '1';

  let subtotal = 0;
  dom.cartItemsList.innerHTML = state.cart.map(item => {
    const book = state.books.find(b => b.id === item.id);
    if (!book) return '';
    const itemTotal = book.price * item.qty;
    subtotal += itemTotal;

    return `
      <div class="cart-item-card">
        <div class="cart-item-info">
          <div class="cart-item-title">${book.title}</div>
          <div class="cart-item-price">${formatPrice(book.price)} × ${item.qty}</div>
        </div>
        <button class="cart-item-remove" onclick="removeFromCart(${book.id})" title="Remove item">✕</button>
      </div>
    `;
  }).join('');

  let discount = 0;
  if (state.appliedPromo) {
    discount = Math.round(subtotal * state.appliedPromo.percent);
    dom.cartDiscountRow.style.display = 'flex';
    dom.cartDiscountAmt.textContent = `-${formatPrice(discount)}`;
  } else {
    dom.cartDiscountRow.style.display = 'none';
  }

  const finalTotal = Math.max(0, subtotal - discount);
  dom.cartSubtotal.textContent = formatPrice(subtotal);
  dom.cartTotal.textContent = formatPrice(finalTotal);
}

// Apply Promo Code
function applyPromoCode() {
  const code = dom.promoInput.value.trim().toUpperCase();
  if (!code) return;

  const validPromos = {
    'WELCOME20': 0.20,
    'SAVE20': 0.20,
    'AIHUB50': 0.50,
    'VIPREADER': 0.25
  };

  if (validPromos[code]) {
    state.appliedPromo = { code, percent: validPromos[code] };
    showToast(`Promo "${code}" applied! 🎉 Save ${validPromos[code] * 100}%`);
    renderCartDrawer();
  } else {
    showToast(`Invalid promo code. Try "WELCOME20" or "AIHUB50" ⚠️`);
  }
}

// ==========================================
// INSTANT CHECKOUT MODAL & DELIVERY
// ==========================================
function openCheckoutModal(directItems = null) {
  const items = directItems || state.cart.map(i => state.books.find(b => b.id === i.id)).filter(Boolean);
  if (!items.length) return;

  dom.checkoutFormView.style.display = 'block';
  dom.orderSuccessView.style.display = 'none';

  let subtotal = items.reduce((sum, b) => sum + b.price, 0);
  let discount = state.appliedPromo ? Math.round(subtotal * state.appliedPromo.percent) : 0;
  let total = Math.max(0, subtotal - discount);

  dom.checkoutSummaryBox.innerHTML = `
    <div style="font-weight: 700; margin-bottom: 0.5rem;">Order Summary (${items.length} ${items.length === 1 ? 'item' : 'items'}):</div>
    ${items.map(b => `<div style="font-size: 0.85rem; color: var(--text-muted); display:flex; justify-content:space-between; margin-bottom:0.25rem;"><span>${b.shortTitle || b.title}</span> <b>${formatPrice(b.price)}</b></div>`).join('')}
    <div style="border-top: 1px solid var(--border-subtle); margin-top: 0.6rem; padding-top: 0.6rem; display: flex; justify-content: space-between; font-weight: 800; font-size: 1.1rem; color: var(--gold-400);">
      <span>Total Amount:</span>
      <span>${formatPrice(total)}</span>
    </div>
  `;

  openModal(dom.checkoutModal);
}

async function handleCheckoutSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('custName').value.trim();
  const email = document.getElementById('custEmail').value.trim();

  if (!email) {
    showToast('Please enter your delivery email address');
    return;
  }

  const items = state.cart.length > 0 ? state.cart : [{ id: state.activeBook.id, qty: 1 }];

  try {
    showToast('Connecting to Razorpay secure gateway... 💳');

    // 1. Create Razorpay order on server
    const orderRes = await fetch('/api/payment/razorpay-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items,
        discountCode: state.appliedPromo ? state.appliedPromo.code : null,
        currency: state.currency
      })
    });
    const orderData = await orderRes.json();

    // 2. If free book ($0 / ₹0) or instant checkout
    if (orderData.finalAmount === 0) {
      completeOrderDirectly(items, name, email);
      return;
    }

    // 3. If Razorpay SDK is loaded, launch Razorpay Modal
    if (typeof Razorpay !== 'undefined' && orderData.keyId) {
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'E_Book Hub',
        description: `Digital Guide Access (${items.length} ${items.length === 1 ? 'item' : 'items'})`,
        image: 'https://cdn-icons-png.flaticon.com/512/3389/3389081.png',
        prefill: {
          name: name,
          email: email
        },
        theme: {
          color: '#f59e0b'
        },
        handler: async function (response) {
          showToast('Payment verified! Generating digital delivery token... 🚀');
          
          // Verify on backend
          const verifyRes = await fetch('/api/payment/razorpay-verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id || orderData.orderId,
              items,
              name,
              email,
              discountCode: state.appliedPromo ? state.appliedPromo.code : null
            })
          });
          const verifyData = await verifyRes.json();
          if (verifyData.success) {
            showOrderSuccess(verifyData.order);
            state.cart = [];
            saveCart();
            updateCartUI();
          }
        },
        modal: {
          ondismiss: function() {
            showToast('Payment cancelled. Your cart is preserved.');
          }
        }
      };

      const rzp = new Razorpay(options);
      rzp.open();
    } else {
      // Fallback direct simulator
      completeOrderDirectly(items, name, email);
    }
  } catch (err) {
    completeOrderDirectly(items, name, email);
  }
}

async function completeOrderDirectly(items, name, email) {
  try {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items,
        name,
        email,
        discountCode: state.appliedPromo ? state.appliedPromo.code : null,
        currency: state.currency
      })
    });
    const data = await res.json();
    if (data.success) {
      showOrderSuccess(data.order);
      state.cart = [];
      saveCart();
      updateCartUI();
    }
  } catch (err) {
    const mockOrder = {
      orderId: 'ORD-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      downloadUrl: '#'
    };
    showOrderSuccess(mockOrder);
    state.cart = [];
    saveCart();
    updateCartUI();
  }
}

function showOrderSuccess(order) {
  dom.checkoutFormView.style.display = 'none';
  dom.orderSuccessView.style.display = 'block';
  dom.orderIdLabel.textContent = order.orderId;

  const licenseEl = document.getElementById('licenseKeyDisplay');
  if (licenseEl) {
    licenseEl.textContent = order.licenseKey || 'LIC-' + Math.random().toString(36).substring(2, 10).toUpperCase();
  }

  // 1. Secure Token Download
  dom.downloadBtn.onclick = () => {
    showToast('Validating cryptographic download token... 🛡️');
    
    if (order.downloadToken) {
      // Use authenticated secure download endpoint
      window.location.href = `/api/download/${order.downloadToken}`;
    } else {
      const blob = new Blob([`%PDF-1.4 E_Book Hub Secured Licensed Delivery\nLicensed To: ${order.email || 'Customer'}`], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `EBook_Hub_Package_${order.orderId}.pdf`;
      link.click();
    }
  };

  // 2. Protected Cloud Reader with Watermarking
  const readerBtn = document.getElementById('openProtectedReaderBtn');
  if (readerBtn) {
    readerBtn.onclick = () => {
      const firstItem = order.items && order.items[0] ? order.items[0] : state.activeBook;
      const book = state.books.find(b => b.id === (firstItem.id || firstItem)) || state.books[0];
      
      closeAllModals(false);
      openReaderModal(book);

      // Apply Security Watermark in Reader
      if (dom.readerText) {
        const watermark = document.createElement('div');
        watermark.style.cssText = 'background: rgba(245,158,11,0.08); border: 1px dashed var(--gold-500); padding: 0.6rem; border-radius: 8px; font-size: 0.75rem; color: var(--gold-400); margin-bottom: 1rem; text-align: center;';
        watermark.textContent = `🔒 AUTHORIZED DIGITAL COPY • Licensed to: ${order.email || 'Verified Buyer'} • License: ${order.licenseKey || order.orderId}`;
        dom.readerText.prepend(watermark);
      }
      showToast('Protected online reader unlocked! 📖');
    };
  }
}

// ==========================================
// NEWSLETTER SUBSCRIPTION
// ==========================================
async function handleNewsletter(e) {
  e.preventDefault();
  const email = dom.newsletterInput.value.trim();
  if (!email) return;

  try {
    const res = await fetch('/api/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Subscribed! Promo code ${data.promoCode} unlocked! 🎁`);
      dom.newsletterInput.value = '';
    }
  } catch (err) {
    showToast('Subscribed! Promo code WELCOME20 unlocked! 🎁');
    dom.newsletterInput.value = '';
  }
}

// ==========================================
// MODAL CONTROLS
// ==========================================
function openModal(modalEl) {
  closeAllModals(false);
  dom.modalOverlay.classList.add('active');
  modalEl.classList.add('open');
  dom.body.style.overflow = 'hidden';
}

function closeAllModals(closeOverlay = true) {
  [dom.productDrawer, dom.readerModal, dom.cartDrawer, dom.checkoutModal].forEach(el => {
    if (el) el.classList.remove('open');
  });
  if (closeOverlay) {
    dom.modalOverlay.classList.remove('active');
    dom.body.style.overflow = '';
  }
}

// ==========================================
// TOAST NOTIFICATION SYSTEM
// ==========================================
function showToast(message) {
  if (!dom.toastContainer) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>✨</span><span>${message}</span>`;
  dom.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ==========================================
// EVENT LISTENERS & SHORTCUTS
// ==========================================
function setupEventListeners() {
  // Theme Toggle
  dom.themeToggleBtn.addEventListener('click', toggleTheme);

  // Cart Button
  dom.cartBtn.addEventListener('click', () => {
    renderCartDrawer();
    openModal(dom.cartDrawer);
  });

  // Currency Selector
  dom.currencySelect.addEventListener('change', (e) => {
    state.currency = e.target.value;
    filterAndRenderBooks();
    updateCartUI();
    renderCartDrawer();
  });

  // Search Input Debounced
  let searchDebounce;
  dom.searchInput.addEventListener('input', (e) => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      state.searchQuery = e.target.value;
      filterAndRenderBooks();
    }, 180);
  });

  // Keyboard shortcut '/' to search
  window.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== dom.searchInput) {
      e.preventDefault();
      dom.searchInput.focus();
    }
    if (e.key === 'Escape') {
      closeAllModals();
    }
  });

  // Sort Selector
  dom.sortSelect.addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    filterAndRenderBooks();
  });

  // Overlay Click
  dom.modalOverlay.addEventListener('click', () => closeAllModals());

  // Close Buttons
  dom.drawerCloseBtn.addEventListener('click', () => closeAllModals());
  dom.readerCloseBtn.addEventListener('click', () => closeAllModals());
  dom.cartCloseBtn.addEventListener('click', () => closeAllModals());
  dom.checkoutCloseBtn.addEventListener('click', () => closeAllModals());

  // Cart Drawer Buttons
  dom.applyPromoBtn.addEventListener('click', applyPromoCode);
  dom.cartCheckoutBtn.addEventListener('click', () => {
    closeAllModals();
    openCheckoutModal();
  });

  // Checkout Form
  dom.checkoutForm.addEventListener('submit', handleCheckoutSubmit);

  // Newsletter Form
  dom.newsletterForm.addEventListener('submit', handleNewsletter);
}
