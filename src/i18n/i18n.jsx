// src/i18n/i18n.jsx
//
// Tiny i18n layer: English + Hindi. Only the UI is translated — all data saved
// to Firestore (item names, categories, sub-categories, suppliers, notes) stays
// in English. Category / sub-category / month names are translated for DISPLAY
// only, via lookup maps that fall back to the English string.
import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { ITEM_HI } from "./itemNames.js";

// ---- UI strings ------------------------------------------------------------
const STR = {
  en: {
    appName: "Stock Tracker",
    signOut: "Sign out",
    admin: "Admin",
    countApp: "Count app",
    save: "Save",
    saving: "Saving…",
    send: "Send",
    export: "Export",
    exportCsv: "Export CSV",
    retry: "Retry",
    language: "Language",

    // Login
    login_title: "Monthly Stock Tracker",
    login_subtitle: "Sign in to continue",
    email: "Email",
    password: "Password",
    showPassword: "Show password",
    signIn: "Sign in",
    signingIn: "Signing in...",
    err_both: "Please enter both email and password.",
    err_invalid_email: "That doesn't look like a valid email.",
    err_bad_credential: "Email or password is incorrect. Try again.",
    err_too_many: "Too many attempts. Please wait a moment and try again.",
    err_network: "Network problem. Check your connection.",
    err_generic: "Couldn't sign in. Please try again.",

    // Home chooser
    home_q: "What would you like to do?",
    home_sub: "Choose a task to get started",
    placeOrder: "Place an order",
    placeOrder_desc: "Build your supplier order, add items over several days",
    monthStock: "Month-end stock",
    monthStock_desc: "Record the closing count for each item",
    receive: "Receive order",
    receive_desc: "Log items received and their expiry dates",

    // Receiving
    findItem: "Search or browse for an item",
    addBatch: "Add",
    quantity: "Quantity",
    expiryDate: "Expiry date",
    received: "Received",
    recentlyReceived: "Recently received",
    receivedCount: "{n} received",
    batchesReceived: "batches received",
    noReceipts: "Nothing received yet.",
    expires: "expires",
    daysLeft: "{n} days left",
    expiresToday: "expires today",
    expiredAgo: "expired {n} days ago",
    addedReceipt: "Added {name} — {qty} {unit}, expires {date}.",
    removeReceipt: "Remove this batch?",

    // Expiry (admin)
    tab_expiry: "Expiry",
    win_expired: "Expired",
    win_thisMonth: "This month",
    win_next30: "Next 30 days",
    win_nextMonth: "Next month",
    win_next2Months: "Next 2 months",
    noExpiring: "Nothing in this window.",
    totalQty: "{qty} {unit}",

    // Offline banner
    offline: "Offline",
    offlineTail: "— {n} change(s) will sync when back online",
    syncing: "Syncing {n} saved change(s)…",

    // Statuses
    status_draft: "Draft",
    status_submitted: "Submitted",
    status_finalized: "Finalized",

    // Stock
    loadingItems: "Loading items…",
    loadItemsErr: "Couldn't load the item list.",
    noItemsStaff: "No items to count yet. Ask an admin to set up the item list.",
    endMonthCount: "End-of-month closing count",
    unsaved: "unsaved changes",
    loadingMonth: "Loading this month…",
    finalizedRO: "This month has been finalized by an admin and is now read-only.",
    prefillLast: "Pre-fill blanks with last month's closing",
    submitStockConfirm:
      "Submit the closing count for {month}? You can still edit it until an admin finalizes the month.",
    savedOffline: "Saved offline — it will sync when you're back online.",
    leftToCount: "{n} left to count",

    // Count navigator
    tapCategory: "Tap a category to start counting",
    submitStock: "Submit stock",
    stockSubmitted: "Stock submitted to admin.",
    countedOf: "{done} / {total} counted",
    allCounted: "All counted · {total}",
    onOrderCount: "{n} on order",

    // Order
    started: "Started {when}",
    newOrder: "New order",
    loadingOrder: "Loading your order…",
    itemsOnOrder: "items on this order",
    itemsOnOrderIn: "items on order in {cat}",
    onOrderN: "{n} on order",
    noneYet: "None yet",
    onThisOrder: "On this order",
    submittedOrders: "Submitted orders",
    onOrderLine: "On order: {qty} {unit}",
    submitOrder: "Submit order",
    add: "Add",
    update: "Update",
    nItems: "{n} item(s)",
    notePlaceholder: "Note — brand, size, urgency (optional)",
    orderSaved: "Order saved. You can keep adding to it another day.",
    orderSent: "Order sent to Admin.",
    addOneItem: "Add at least one item before submitting.",
    submitOrderConfirm:
      "Submit this order with {n} item(s)? It goes to the admin and a fresh order starts.",
    itemsShort: "{n} items",

    // Item row
    last: "last: {v}",

    // Admin
    dashboard: "Dashboard",
    manageItems: "Manage items",
    tab_stock: "Month-end stock",
    tab_orders: "Orders",
    setupItems_title: "Set up the item list",
    setupItems_desc:
      "Load the {n} items from your spreadsheet into the database. You only need to do this once.",
    seedFailed: "Seeding failed. Check your Firestore rules.",
    load260: "Load {n} items",
    reloadMaster: "Reload from master list",
    reloadConfirm:
      "Reload the item list from the master list ({n} items)? New items are added, existing ones updated, and removed ones deactivated. Suppliers are kept.",
    reloading: "Reloading…",
    reloadDone: "Items updated — {added} added, {updated} updated, {deactivated} deactivated.",
    loadingItemsShort: "Loading…",
    viewDetails: "View details",
    saveChanges: "Save changes",
    finalizeMonth: "Finalize month",
    finalizeConfirm: "Finalize {month}? It becomes read-only for staff.",
    reopenMonth: "Reopen month for editing",
    reopening: "Reopening…",

    // Orders admin
    loadingOrders: "Loading orders…",
    noOrders: "No orders yet.",
    onOrderItems: "{n} items on order",
    loadingOrderShort: "Loading order…",

    // Month details
    closingCountsTitle: "{month} — closing counts",
    counted: "Counted",
    remaining: "Remaining",
    items: "Items",
    noClosing: "No closing counts recorded for this month.",

    // Item manager
    newItemName: "New item name",
    hindiName: "Hindi name (optional)",
    addNewItem: "Add new item",
    all: "All",
    supplierOptional: "Supplier (optional)",
    addItem: "Add item",
    adding: "Adding…",
    searchItems: "Search items…",
    supplier: "Supplier",
    orderUnit: "Order unit",
    deactivate: "Deactivate",
    reactivate: "Reactivate",
    on: "On",
    off: "Off",
    edit: "Edit",
    cancel: "Cancel",
    noItemsFound: "No items found.",
  },

  hi: {
    appName: "स्टॉक ट्रैकर",
    signOut: "साइन आउट",
    admin: "एडमिन",
    countApp: "गिनती ऐप",
    save: "सेव करें",
    saving: "सेव हो रहा है…",
    send: "भेजें",
    export: "एक्सपोर्ट",
    exportCsv: "CSV एक्सपोर्ट",
    retry: "फिर से कोशिश करें",
    language: "भाषा",

    login_title: "मासिक स्टॉक ट्रैकर",
    login_subtitle: "जारी रखने के लिए साइन इन करें",
    email: "ईमेल",
    password: "पासवर्ड",
    showPassword: "पासवर्ड दिखाएँ",
    signIn: "साइन इन",
    signingIn: "साइन इन हो रहा है...",
    err_both: "कृपया ईमेल और पासवर्ड दोनों दर्ज करें।",
    err_invalid_email: "यह एक मान्य ईमेल नहीं लगता।",
    err_bad_credential: "ईमेल या पासवर्ड गलत है। फिर से कोशिश करें।",
    err_too_many: "बहुत अधिक प्रयास। कृपया थोड़ी देर बाद पुनः प्रयास करें।",
    err_network: "नेटवर्क समस्या। अपना कनेक्शन जाँचें।",
    err_generic: "साइन इन नहीं हो सका। कृपया फिर से कोशिश करें।",

    home_q: "आप क्या करना चाहेंगे?",
    home_sub: "शुरू करने के लिए एक कार्य चुनें",
    placeOrder: "ऑर्डर करें",
    placeOrder_desc: "अपना सप्लायर ऑर्डर बनाएँ, कई दिनों में आइटम जोड़ें",
    monthStock: "माह-अंत स्टॉक",
    monthStock_desc: "हर आइटम की क्लोज़िंग गिनती दर्ज करें",
    receive: "ऑर्डर प्राप्ति",
    receive_desc: "प्राप्त आइटम और उनकी एक्सपायरी तारीख़ दर्ज करें",

    findItem: "आइटम खोजें या ब्राउज़ करें",
    addBatch: "जोड़ें",
    quantity: "मात्रा",
    expiryDate: "एक्सपायरी तारीख़",
    received: "प्राप्त",
    recentlyReceived: "हाल में प्राप्त",
    receivedCount: "{n} प्राप्त",
    batchesReceived: "प्राप्त बैच",
    noReceipts: "अभी कुछ प्राप्त नहीं हुआ।",
    expires: "एक्सपायरी",
    daysLeft: "{n} दिन शेष",
    expiresToday: "आज एक्सपायरी",
    expiredAgo: "{n} दिन पहले एक्सपायर",
    addedReceipt: "{name} जोड़ा — {qty} {unit}, एक्सपायरी {date}।",
    removeReceipt: "यह बैच हटाएँ?",

    tab_expiry: "एक्सपायरी",
    win_expired: "एक्सपायर",
    win_thisMonth: "इस माह",
    win_next30: "अगले 30 दिन",
    win_nextMonth: "अगले माह",
    win_next2Months: "अगले 2 माह",
    noExpiring: "इस अवधि में कुछ नहीं।",
    totalQty: "{qty} {unit}",

    offline: "ऑफ़लाइन",
    offlineTail: "— {n} बदलाव ऑनलाइन होने पर सिंक होंगे",
    syncing: "{n} सहेजे गए बदलाव सिंक हो रहे हैं…",

    status_draft: "ड्राफ्ट",
    status_submitted: "जमा किया गया",
    status_finalized: "फ़ाइनल",

    loadingItems: "आइटम लोड हो रहे हैं…",
    loadItemsErr: "आइटम सूची लोड नहीं हो सकी।",
    noItemsStaff: "अभी गिनने के लिए कोई आइटम नहीं। एडमिन से आइटम सूची सेट करने को कहें।",
    endMonthCount: "माह-अंत क्लोज़िंग गिनती",
    unsaved: "असहेजे बदलाव",
    loadingMonth: "इस माह का डेटा लोड हो रहा है…",
    finalizedRO: "इस माह को एडमिन ने फ़ाइनल कर दिया है और अब यह केवल-पढ़ने के लिए है।",
    prefillLast: "खाली जगह पिछले माह की क्लोज़िंग से भरें",
    submitStockConfirm:
      "{month} की क्लोज़िंग गिनती जमा करें? एडमिन द्वारा माह फ़ाइनल करने तक आप इसे संपादित कर सकते हैं।",
    savedOffline: "ऑफ़लाइन सेव हुआ — ऑनलाइन होने पर सिंक होगा।",
    leftToCount: "{n} गिनना बाकी",

    tapCategory: "गिनती शुरू करने के लिए श्रेणी चुनें",
    submitStock: "स्टॉक सबमिट करें",
    stockSubmitted: "स्टॉक एडमिन को सबमिट किया गया।",
    countedOf: "{done} / {total} गिने गए",
    allCounted: "सभी गिने गए · {total}",
    onOrderCount: "{n} ऑर्डर में",

    started: "{when} को शुरू हुआ",
    newOrder: "नया ऑर्डर",
    loadingOrder: "आपका ऑर्डर लोड हो रहा है…",
    itemsOnOrder: "इस ऑर्डर में आइटम",
    itemsOnOrderIn: "{cat} में ऑर्डर के आइटम",
    onOrderN: "{n} ऑर्डर में",
    noneYet: "अभी कोई नहीं",
    onThisOrder: "इस ऑर्डर में",
    submittedOrders: "सबमिट किए गए ऑर्डर",
    onOrderLine: "ऑर्डर में: {qty} {unit}",
    submitOrder: "ऑर्डर सबमिट करें",
    add: "जोड़ें",
    update: "अपडेट",
    nItems: "{n} आइटम",
    notePlaceholder: "नोट — ब्रांड, आकार, आवश्यकता (वैकल्पिक)",
    orderSaved: "ऑर्डर सेव हुआ। आप इसे किसी और दिन जोड़ सकते हैं।",
    orderSent: "ऑर्डर एडमिन को भेज दिया गया।",
    addOneItem: "भेजने से पहले कम से कम एक आइटम जोड़ें।",
    submitOrderConfirm:
      "इस ऑर्डर को {n} आइटम के साथ भेजें? यह एडमिन को जाएगा और नया ऑर्डर शुरू होगा।",
    itemsShort: "{n} आइटम",

    last: "पिछला: {v}",

    dashboard: "डैशबोर्ड",
    manageItems: "आइटम प्रबंधित करें",
    tab_stock: "माह-अंत स्टॉक",
    tab_orders: "ऑर्डर",
    setupItems_title: "आइटम सूची सेट करें",
    setupItems_desc:
      "अपनी स्प्रेडशीट से {n} आइटम डेटाबेस में लोड करें। यह केवल एक बार करना है।",
    seedFailed: "सीडिंग विफल। अपने Firestore नियम जाँचें।",
    load260: "{n} आइटम लोड करें",
    reloadMaster: "मास्टर सूची से पुनः लोड करें",
    reloadConfirm:
      "मास्टर सूची ({n} आइटम) से आइटम सूची पुनः लोड करें? नए आइटम जुड़ेंगे, मौजूदा अपडेट होंगे, और हटाए गए निष्क्रिय होंगे। सप्लायर सुरक्षित रहेंगे।",
    reloading: "पुनः लोड हो रहा है…",
    reloadDone: "आइटम अपडेट — {added} जोड़े, {updated} अपडेट, {deactivated} निष्क्रिय।",
    loadingItemsShort: "लोड हो रहा है…",
    viewDetails: "विवरण देखें",
    saveChanges: "बदलाव सेव करें",
    finalizeMonth: "माह फ़ाइनल करें",
    finalizeConfirm: "{month} को फ़ाइनल करें? यह स्टाफ़ के लिए केवल-पढ़ने योग्य हो जाएगा।",
    reopenMonth: "संपादन के लिए माह फिर से खोलें",
    reopening: "फिर से खोल रहे हैं…",

    loadingOrders: "ऑर्डर लोड हो रहे हैं…",
    noOrders: "अभी कोई ऑर्डर नहीं।",
    onOrderItems: "{n} आइटम ऑर्डर में",
    loadingOrderShort: "ऑर्डर लोड हो रहा है…",

    closingCountsTitle: "{month} — क्लोज़िंग गिनती",
    counted: "गिने गए",
    remaining: "शेष",
    items: "आइटम",
    noClosing: "इस माह के लिए कोई क्लोज़िंग गिनती दर्ज नहीं है।",

    newItemName: "नए आइटम का नाम",
    hindiName: "हिंदी नाम (वैकल्पिक)",
    addNewItem: "नया आइटम जोड़ें",
    all: "सभी",
    supplierOptional: "सप्लायर (वैकल्पिक)",
    addItem: "आइटम जोड़ें",
    adding: "जोड़ रहे हैं…",
    searchItems: "आइटम खोजें…",
    supplier: "सप्लायर",
    orderUnit: "ऑर्डर इकाई",
    deactivate: "निष्क्रिय करें",
    reactivate: "पुनः सक्रिय करें",
    on: "चालू",
    off: "बंद",
    edit: "संपादित करें",
    cancel: "रद्द करें",
    noItemsFound: "कोई आइटम नहीं मिला।",
  },
};

// ---- Category / sub-category display labels (Hindi) -------------------------
const CAT_HI = {
  Bar: "बार",
  "Cleaning supplies": "सफ़ाई सामग्री",
  Kitchen: "रसोई",
  Miscellaneous: "विविध",
  Office: "कार्यालय",
  Operations: "संचालन",
  Packing: "पैकिंग",
};

const SUB_HI = {
  // Bar
  Beer: "बीयर",
  Ice: "बर्फ़",
  Juices: "जूस",
  "Other Items": "अन्य वस्तुएँ",
  "Soft Drinks": "शीतल पेय",
  "Straw & chopstick": "स्ट्रॉ और चॉपस्टिक",
  Syrups: "सिरप",
  Water: "पानी",
  "Wine & Prosecco": "वाइन और प्रोसेक्को",
  // Cleaning supplies
  "Bin liners": "बिन लाइनर",
  "Cleaning chemicals": "सफ़ाई रसायन",
  "Cleaning tools": "सफ़ाई उपकरण",
  "Paper & wipes": "कागज़ और वाइप्स",
  Washroom: "वॉशरूम",
  // Kitchen
  "Bakery & Bread": "बेकरी और ब्रेड",
  "Dairy & Eggs": "डेयरी और अंडे",
  "Fresh Vegetables & Herbs": "ताज़ी सब्ज़ियाँ और जड़ी-बूटी",
  "Frozen Foods": "फ्रोज़न खाद्य",
  "Kitchen sundries": "रसोई का फुटकर सामान",
  "Lentils & Pulses": "दालें",
  "Meat & Seafood": "मांस और समुद्री भोजन",
  "Oils & Ghee": "तेल और घी",
  "Rice, Flour & Grains": "चावल, आटा और अनाज",
  "Sauces, Cans & Pastes": "सॉस, कैन और पेस्ट",
  "Snacks & Nuts": "स्नैक्स और मेवे",
  "Spices & Masala": "मसाले",
  "Sugar & Salt": "चीनी और नमक",
  "Sweets & Desserts": "मिठाई और डेज़र्ट",
  "Tea & Coffee": "चाय और कॉफ़ी",
  // Miscellaneous
  "Staff wear & PPE": "स्टाफ़ वर्दी और PPE",
  // Office
  "Printer rolls": "प्रिंटर रोल",
  Stationery: "स्टेशनरी",
  // Operations
  Advertisement: "विज्ञापन",
  Deposits: "जमा",
  "Maintenance & Repairs": "रखरखाव और मरम्मत",
  "Online Portals & Delivery": "ऑनलाइन पोर्टल और डिलीवरी",
  "Professional Services": "पेशेवर सेवाएँ",
  Rent: "किराया",
  "Salaries & Payroll": "वेतन",
  "Taxes & Bank Fees": "कर और बैंक शुल्क",
  "Utilities & Bills": "उपयोगिता और बिल",
  // Packing
  Bags: "बैग",
  Cutlery: "कटलरी",
  "Foil & film": "फ़ॉइल और फ़िल्म",
  Takeaway: "टेकअवे",
};

const MONTHS = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  hi: ["जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"],
};

function interpolate(str, vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : `{${k}}`));
}

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem("lang") : null;
    return saved === "hi" ? "hi" : "en";
  });

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l) => {
    setLangState(l);
    try {
      localStorage.setItem("lang", l);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key, vars) => {
      const s = (STR[lang] && STR[lang][key]) || STR.en[key] || key;
      return interpolate(s, vars);
    },
    [lang],
  );

  const tc = useCallback((name) => (lang === "hi" ? CAT_HI[name] || name : name), [lang]);
  const ts = useCallback((name) => (lang === "hi" ? SUB_HI[name] || name : name), [lang]);
  // Item display name (data stays English; Hindi is display-only).
  // Prefers a per-item override (item.nameHi), then the built-in map, then EN.
  const ti = useCallback(
    (name, item) => {
      if (lang !== "hi") return name;
      const custom = item && item.nameHi && String(item.nameHi).trim();
      return custom || ITEM_HI[name] || name;
    },
    [lang],
  );
  const tMonth = useCallback(
    (monthId) => {
      const [y, m] = String(monthId).split("-").map(Number);
      if (!y || !m) return monthId;
      return `${MONTHS[lang][m - 1]} ${y}`;
    },
    [lang],
  );

  const value = { lang, setLang, t, tc, ts, ti, tMonth };
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useT() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useT must be used within a LanguageProvider");
  return ctx;
}
