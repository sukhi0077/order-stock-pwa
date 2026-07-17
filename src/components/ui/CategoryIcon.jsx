// src/components/ui/CategoryIcon.jsx
import React from "react";

// Line icons (stroke = currentColor), 24x24. Looked up by the category OR
// sub-category display name via ICONS below. Shared shapes (e.g. snowflake for
// both Ice and Frozen Foods) are defined once and referenced by several names.

// ---- Categories ------------------------------------------------------------
const chefHat = (
  <>
    <path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z" />
    <path d="M6 17h12" />
  </>
);
const martini = (
  <>
    <path d="M8 22h8" />
    <path d="M12 11v11" />
    <path d="m19 3-7 8-7-8Z" />
  </>
);
const sliders = (
  <>
    <path d="M20 7h-9" />
    <path d="M14 17H5" />
    <circle cx="17" cy="17" r="3" />
    <circle cx="7" cy="7" r="3" />
  </>
);
const bucket = (
  <>
    <path d="M4 8h16" />
    <path d="M6 8l1.1 11a2 2 0 0 0 2 1.8h5.8a2 2 0 0 0 2-1.8L18 8" />
    <path d="M8 8a4 3 0 0 1 8 0" />
  </>
);
const pencil = (
  <>
    <path d="M17 3a2.83 2.83 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
    <path d="M15 5 19 9" />
  </>
);
const pkg = (
  <>
    <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" />
    <path d="M12 22V12" />
    <path d="m3.3 7 8.7 5 8.7-5" />
    <path d="m7.5 4.27 9 5.15" />
  </>
);
const grid = (
  <>
    <rect width="7" height="7" x="3" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="14" rx="1" />
    <rect width="7" height="7" x="3" y="14" rx="1" />
  </>
);

// ---- Drinks / Bar ----------------------------------------------------------
const beerMug = (
  <>
    <path d="M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a2.5 2.5 0 0 1 0-5c.78 0 1.57.5 2.5.5S9.44 2 11 2s2 1.5 3 1.5 1.72-.5 2.5-.5a2.5 2.5 0 0 1 0 5c-.78 0-1.5-.5-2.5-.5Z" />
    <path d="M5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8" />
    <path d="M17 11h1a3 3 0 0 1 0 6h-1" />
    <path d="M9 12v6" />
    <path d="M13 12v6" />
  </>
);
const snowflake = (
  <>
    <path d="M12 2v20" />
    <path d="M2 12h20" />
    <path d="m4.9 4.9 14.2 14.2" />
    <path d="m19.1 4.9-14.2 14.2" />
  </>
);
const cupSoda = (
  <>
    <path d="m6 8 1.75 12.28a2 2 0 0 0 2 1.72h4.54a2 2 0 0 0 2-1.72L18 8" />
    <path d="M5 8h14" />
    <path d="M7 15a6.47 6.47 0 0 1 5 0 6.47 6.47 0 0 0 5 0" />
    <path d="m12 8-1-6h2l-1 6" />
  </>
);
const sodaBottle = (
  <>
    <path d="M10 2h4" />
    <path d="M10 2v2.2c0 .6-.2 1.1-.6 1.5L9 6.4C8.4 7 8 7.8 8 8.7V20a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V8.7c0-.9-.4-1.7-1-2.3l-.4-.4c-.4-.4-.6-.9-.6-1.5V2" />
    <path d="M8 12h8" />
    <path d="M8 16h8" />
  </>
);
const straws = (
  <>
    <path d="M7.5 21 9 5" />
    <path d="M9 5l2 1.2" />
    <path d="M14.5 21 16 5" />
    <path d="M16 5l-2 1.2" />
  </>
);
const pumpBottle = (
  <>
    <path d="M12 4h3" />
    <path d="M15 4v2" />
    <path d="M11 6h4v2h-4z" />
    <path d="M9.5 8h5v11a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2z" />
  </>
);
const droplet = <path d="M12 2s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" />;
const wineGlass = (
  <>
    <path d="M8 22h8" />
    <path d="M12 15v7" />
    <path d="M6 3h12l-1 6a5 5 0 0 1-10 0z" />
  </>
);
const coffee = (
  <>
    <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
    <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
    <path d="M6 2v2" />
    <path d="M10 2v2" />
    <path d="M14 2v2" />
  </>
);

// ---- Cleaning --------------------------------------------------------------
const trash = (
  <>
    <path d="M3 6h18" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </>
);
const sprayBottle = (
  <>
    <path d="M10 3h4v3h-4z" />
    <path d="M14 4h2l2 2" />
    <path d="M10 6h4v2l1 1v10a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V9l1-1z" />
  </>
);
const brush = (
  <>
    <path d="M14 4 20 10" />
    <path d="M4 14h9v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
    <path d="M13 14 17 10" />
    <path d="M6 19v2" />
    <path d="M9 19v2" />
    <path d="M12 19v2" />
  </>
);
const roll = (
  <>
    <rect x="3" y="5" width="18" height="8" rx="4" />
    <circle cx="7" cy="9" r="1.5" />
    <path d="M7 13v6h8l-2-3 2-3" />
  </>
);
const droplets = (
  <>
    <path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 4.8 7 3c-.3 1.8-1.15 3.24-2.29 4.16S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05Z" />
    <path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97" />
  </>
);

// ---- Kitchen ---------------------------------------------------------------
const bread = (
  <>
    <path d="M5 11a4 4 0 0 1 4-4h6a4 4 0 0 1 0 8H9a4 4 0 0 1-4-4z" />
    <path d="M9 11h.01" />
    <path d="M13 11h.01" />
  </>
);
const milkEgg = (
  <>
    <path d="M6 3h4" />
    <path d="M6 3v2L5 7v12a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1V7L9 5V3" />
    <path d="M5 12h5" />
    <path d="M17 21a3 3 0 0 0 3-3c0-2.2-1.5-5-3-5s-3 2.8-3 5a3 3 0 0 0 3 3z" />
  </>
);
const carrot = (
  <>
    <path d="M2.27 21.7s9.87-3.5 12.73-6.36a4.5 4.5 0 0 0-6.36-6.37C5.77 11.84 2.27 21.7 2.27 21.7z" />
    <path d="M8.64 14l-2.05-2.04" />
    <path d="M15.34 15l-2.46-2.46" />
    <path d="M22 9s-1.33-2-3.5-2C16.86 7 15 9 15 9s1.33 2 3.5 2S22 9 22 9z" />
    <path d="M15 2s-2 1.33-2 3.5S15 9 15 9s2-1.83 2-3.5S15 2 15 2z" />
  </>
);
const pot = (
  <>
    <path d="M2 12h20" />
    <path d="M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8" />
    <path d="m4 8 16-4" />
    <path d="M8.86 6.78c-.45-1.26-.16-2.61.82-3.6l.4.4a2 2 0 0 0 2.83 0l.4-.4c.98.98 1.27 2.34.82 3.6" />
  </>
);
const beans = (
  <>
    <path d="M4 11h16a8 8 0 0 1-16 0z" />
    <circle cx="9" cy="8" r="1" />
    <circle cx="12" cy="7" r="1" />
    <circle cx="15" cy="8" r="1" />
  </>
);
const fish = (
  <>
    <path d="M16 12c-3 4-8 5-12 4 1-2 1-3 0-5 5 0 9 1 12 1z" />
    <path d="M16 12 20 9v6z" />
    <circle cx="7" cy="11" r="0.6" />
  </>
);
const oilBottle = (
  <>
    <path d="M11 2h2" />
    <path d="M11 2v3L9 7v12a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V7l-2-2V2" />
    <path d="M12 11c-1 1.3-1.6 2.2-1.6 3a1.6 1.6 0 0 0 3.2 0c0-.8-.6-1.7-1.6-3z" />
  </>
);
const wheat = (
  <>
    <path d="M12 22V9" />
    <path d="M12 9c0-2.2 1.5-3.8 3.5-4-.2 2.2-1.6 3.8-3.5 4z" />
    <path d="M12 9c0-2.2-1.5-3.8-3.5-4 .2 2.2 1.6 3.8 3.5 4z" />
    <path d="M12 14.5c0-2.2 1.5-3.8 3.5-4-.2 2.2-1.6 3.8-3.5 4z" />
    <path d="M12 14.5c0-2.2-1.5-3.8-3.5-4 .2 2.2 1.6 3.8 3.5 4z" />
  </>
);
const tinCan = (
  <>
    <path d="M6 6c0-1.1 2.7-2 6-2s6 .9 6 2-2.7 2-6 2-6-.9-6-2z" />
    <path d="M6 6v13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6" />
    <path d="M6 10h12" />
    <path d="M6 15h12" />
  </>
);
const peanut = (
  <path d="M9 3a3.5 3.5 0 0 0 0 7 3.5 3.5 0 0 0 0 7 4 4 0 0 0 6-3.2A3.5 3.5 0 0 0 15 6.2 4 4 0 0 0 9 3z" />
);
const spice = (
  <>
    <path d="M8 8h8v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2z" />
    <path d="M9 5h6l-1 3H10z" />
    <circle cx="11" cy="12" r="0.6" />
    <circle cx="13.5" cy="14" r="0.6" />
    <circle cx="11.5" cy="16" r="0.6" />
  </>
);
const salt = (
  <>
    <path d="M8 9h8v9a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z" />
    <path d="M9 9a3 3 0 0 1 6 0" />
    <circle cx="10.5" cy="6.5" r="0.4" />
    <circle cx="13.5" cy="6.5" r="0.4" />
    <circle cx="12" cy="5.6" r="0.4" />
  </>
);
const cupcake = (
  <>
    <path d="M6 12h12l-1 8H7z" />
    <path d="M6 12a6 6 0 0 1 12 0" />
    <path d="M12 5v3" />
  </>
);

// ---- Misc / Office / Operations / Packing ---------------------------------
const shirt = (
  <path d="M6 4 9 3l3 2 3-2 3 1 2 4-3 1.5V20a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V9.5L4 8z" />
);
const printer = (
  <>
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6" />
    <rect x="6" y="14" width="12" height="8" rx="1" />
  </>
);
const megaphone = (
  <>
    <path d="M3 11v2a1 1 0 0 0 1 1h2l9 5V5L6 10H4a1 1 0 0 0-1 1z" />
    <path d="M18 8a4 4 0 0 1 0 8" />
  </>
);
const piggyBank = (
  <>
    <path d="M11 17h3v2a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-3a3.16 3.16 0 0 0 1.5-1.7H20a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-.8A5 5 0 0 0 17 7V4.5a4 4 0 0 0-3 1.5l-.3.4H11a6 6 0 0 0-6 6v.5a5 5 0 0 0 2 3.6V19a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1z" />
    <path d="M16 10h.01" />
    <path d="M2 9v1a2 2 0 0 0 2 2h1" />
  </>
);
const wrench = (
  <path d="M15 7a4 4 0 0 0-5.2 5.2l-6 6 2 2 6-6A4 4 0 0 0 17 9l-2.5 2.5-2-2L15 7z" />
);
const truck = (
  <>
    <path d="M3 6h11v9H3z" />
    <path d="M14 9h4l3 3v3h-7z" />
    <circle cx="7.5" cy="18" r="1.5" />
    <circle cx="17" cy="18" r="1.5" />
  </>
);
const briefcase = (
  <>
    <rect x="3" y="7" width="18" height="12" rx="2" />
    <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    <path d="M3 12h18" />
  </>
);
const house = (
  <>
    <path d="M4 11 12 4l8 7" />
    <path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" />
    <path d="M10 20v-5h4v5" />
  </>
);
const wallet = (
  <>
    <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
    <path d="M4 6v12a2 2 0 0 0 2 2h14v-4" />
    <path d="M18 12a2 2 0 0 0 0 4h4v-4z" />
  </>
);
const landmark = (
  <>
    <path d="M10 18v-7" />
    <path d="M11.12 2.2a2 2 0 0 1 1.76 0l7.87 3.85c.47.23.31.95-.22.95H3.47c-.53 0-.69-.72-.22-.95z" />
    <path d="M14 18v-7" />
    <path d="M18 18v-7" />
    <path d="M3 22h18" />
    <path d="M6 18v-7" />
  </>
);
const zap = (
  <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
);
const shoppingBag = (
  <>
    <path d="M6 8h12l-1 12H7z" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
  </>
);
const cutlery = (
  <>
    <path d="M7 3v7a2 2 0 0 0 2 2v9" />
    <path d="M7 3v4" />
    <path d="M11 3v4" />
    <path d="M17 3c-1.5 0-2 2-2 4.5S15.5 12 17 12v9" />
  </>
);
// Round curry/takeaway container: oval lid with a pull-tab over a round tub.
const curryBox = (
  <>
    <ellipse cx="12" cy="6.5" rx="8" ry="2.5" />
    <path d="M11 4h2" />
    <path d="M4.5 9.5a7.5 2.2 0 0 0 15 0" />
    <path d="M5.5 10.5 6.8 18.5a2 2 0 0 0 2 1.7h6.4a2 2 0 0 0 2-1.7L18.5 10.5" />
  </>
);

// Display name (category OR sub-category) -> glyph.
const ICONS = {
  // Categories
  Kitchen: chefHat,
  Bar: martini,
  Operations: sliders,
  "Cleaning supplies": bucket,
  Office: pencil,
  Packing: pkg,
  Miscellaneous: grid,
  // Bar
  Beer: beerMug,
  Ice: snowflake,
  Juices: cupSoda,
  "Other Items": pkg,
  "Soft Drinks": sodaBottle,
  "Straw & chopstick": straws,
  Syrups: pumpBottle,
  "Tea & Coffee": coffee,
  Water: droplet,
  "Wine & Prosecco": wineGlass,
  // Cleaning supplies
  "Bin liners": trash,
  "Cleaning chemicals": sprayBottle,
  "Cleaning tools": brush,
  "Paper & wipes": roll,
  Washroom: droplets,
  // Kitchen
  "Bakery & Bread": bread,
  "Dairy & Eggs": milkEgg,
  "Fresh Vegetables & Herbs": carrot,
  "Frozen Foods": snowflake,
  "Kitchen sundries": pot,
  "Lentils & Pulses": beans,
  "Meat & Seafood": fish,
  "Oils & Ghee": oilBottle,
  "Rice, Flour & Grains": wheat,
  "Sauces, Cans & Pastes": tinCan,
  "Snacks & Nuts": peanut,
  "Spices & Masala": spice,
  "Sugar & Salt": salt,
  "Sweets & Desserts": cupcake,
  // Miscellaneous
  "Staff wear & PPE": shirt,
  // Office
  "Printer rolls": printer,
  Stationery: pencil,
  // Operations
  Advertisement: megaphone,
  Deposits: piggyBank,
  "Maintenance & Repairs": wrench,
  "Online Portals & Delivery": truck,
  "Professional Services": briefcase,
  Rent: house,
  "Salaries & Payroll": wallet,
  "Taxes & Bank Fees": landmark,
  "Utilities & Bills": zap,
  // Packing
  Bags: shoppingBag,
  Cutlery: cutlery,
  "Foil & film": roll,
  "Takeaway box": curryBox,
  Takeaway: curryBox, // legacy alias — items not yet renamed in the DB
};

const FALLBACK = (
  <>
    <path d="M12 2 2 7l10 5 10-5-10-5Z" />
    <path d="m2 17 10 5 10-5" />
    <path d="m2 12 10 5 10-5" />
  </>
);

export default function CategoryIcon({ name, size = 20, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {ICONS[name] || FALLBACK}
    </svg>
  );
}
