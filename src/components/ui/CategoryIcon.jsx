// src/components/ui/CategoryIcon.jsx
import React from "react";

// Line icons (stroke = currentColor). Categories resolve first; otherwise the
// name is looked up as a sub-category via SUB_MAP -> SUB_PATHS.
const PATHS = {
  Kitchen: (
    <>
      <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z" />
      <line x1="6" y1="17" x2="18" y2="17" />
    </>
  ),
  Bar: (
    <>
      <path d="M8 22h8" />
      <path d="M12 11v11" />
      <path d="m19 3-7 8-7-8Z" />
    </>
  ),
  Operations: (
    <>
      <path d="M20 7h-9" />
      <path d="M14 17H5" />
      <circle cx="17" cy="17" r="3" />
      <circle cx="7" cy="7" r="3" />
    </>
  ),
  "Cleaning supplies": (
    <>
      <path d="M19 4 12 11" />
      <path d="M9 10 14 15 11 19.5 6 18 Z" />
      <path d="M8.5 13 8 18.7" />
      <path d="M10.5 14.5 10.2 19.2" />
    </>
  ),
  Office: (
    <>
      <path d="M17 3a2.828 2.828 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="M15 5 19 9" />
    </>
  ),
  Packing: (
    <>
      <path d="M4.5 9 19.5 9" />
      <path d="M6 9 7.5 20 16.5 20 18 9" />
      <path d="M8 9 Q12 3.5 16 9" />
    </>
  ),
  Miscellaneous: (
    <>
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
    </>
  ),
};

// Base sub-category icon shapes.
const SUB_PATHS = {
  mug: (
    <>
      <path d="M6 8h9v8a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3z" />
      <path d="M15 10h2a2 2 0 0 1 0 4h-2" />
      <path d="M8 3v2" />
      <path d="M11.5 3v2" />
    </>
  ),
  snowflake: (
    <>
      <path d="M12 2v20" />
      <path d="M2 12h20" />
      <path d="m4.9 4.9 14.2 14.2" />
      <path d="m19.1 4.9-14.2 14.2" />
    </>
  ),
  cup: (
    <>
      <path d="M17 8h1a3 3 0 0 1 0 6h-1" />
      <path d="M4 8h13v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" />
      <path d="M7 3v2" />
      <path d="M11 3v2" />
    </>
  ),
  can: (
    <>
      <rect x="7" y="3" width="10" height="18" rx="2" />
      <path d="M7 7h10" />
    </>
  ),
  straw: (
    <>
      <path d="M7 3 5.5 21" />
      <path d="M12 3v18" />
      <path d="M17 3 18.5 21" />
    </>
  ),
  bottle: (
    <>
      <path d="M9 2h6" />
      <path d="M10 2v3l-1.4 2A2 2 0 0 0 8 8.6V20a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V8.6a2 2 0 0 0-.6-1.6L14 5V2" />
    </>
  ),
  droplet: <path d="M12 2s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" />,
  wineglass: (
    <>
      <path d="M8 22h8" />
      <path d="M12 15v7" />
      <path d="M6 3h12l-1 6a5 5 0 0 1-10 0z" />
    </>
  ),
  bin: (
    <>
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" />
    </>
  ),
  spray: (
    <>
      <path d="M10 3h4v3h-4z" />
      <path d="M14 4h2l2 2" />
      <path d="M10 6h4v2l1 1v10a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V9l1-1z" />
    </>
  ),
  brush: (
    <>
      <path d="M14 4 20 10" />
      <path d="M4 14h9v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <path d="M13 14 17 10" />
      <path d="M6 19v2" />
      <path d="M9 19v2" />
      <path d="M12 19v2" />
    </>
  ),
  roll: (
    <>
      <rect x="3" y="5" width="18" height="8" rx="4" />
      <circle cx="7" cy="9" r="1.5" />
      <path d="M7 13v6h8l-2-3 2-3" />
    </>
  ),
  bread: (
    <>
      <path d="M5 11a4 4 0 0 1 4-4h6a4 4 0 0 1 0 8H9a4 4 0 0 1-4-4z" />
      <path d="M9 11h.01" />
      <path d="M13 11h.01" />
    </>
  ),
  egg: <path d="M12 3c-3 4-5 7-5 10a5 5 0 0 0 10 0c0-3-2-6-5-10Z" />,
  leaf: (
    <>
      <path d="M7 20h10" />
      <path d="M12 20c0-6 3-9 8-9" />
      <path d="M12 14c-4 0-7-2-7-6 4 0 7 2 7 6z" />
    </>
  ),
  pot: (
    <>
      <path d="M4 10h16v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" />
      <path d="M3 10h18" />
      <path d="M4 10 2 8" />
      <path d="M20 10 22 8" />
    </>
  ),
  beans: (
    <>
      <path d="M4 11h16a8 8 0 0 1-16 0z" />
      <circle cx="9" cy="8" r="1" />
      <circle cx="12" cy="7" r="1" />
      <circle cx="15" cy="8" r="1" />
    </>
  ),
  fish: (
    <>
      <path d="M16 12c-3 4-8 5-12 4 1-2 1-3 0-5 5 0 9 1 12 1z" />
      <path d="M16 12 20 9v6z" />
      <circle cx="7" cy="11" r="0.6" />
    </>
  ),
  wheat: (
    <>
      <path d="M12 3v18" />
      <path d="M12 9c-2-.5-3-2-3-4 2 0 3 1.5 3 3.5" />
      <path d="M12 9c2-.5 3-2 3-4-2 0-3 1.5-3 3.5" />
      <path d="M12 14c-2-.5-3-2-3-4 2 0 3 1.5 3 3.5" />
      <path d="M12 14c2-.5 3-2 3-4-2 0-3 1.5-3 3.5" />
    </>
  ),
  jar: (
    <>
      <path d="M8 3h8v2l1 1v13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6l1-1z" />
      <path d="M9 10h6" />
    </>
  ),
  nut: (
    <path d="M9 3a3.5 3.5 0 0 0 0 7 3.5 3.5 0 0 0 0 7 4 4 0 0 0 6-3.2A3.5 3.5 0 0 0 15 6.2 4 4 0 0 0 9 3z" />
  ),
  spice: (
    <>
      <path d="M8 8h8v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2z" />
      <path d="M9 5h6l-1 3H10z" />
      <circle cx="11" cy="12" r="0.6" />
      <circle cx="13.5" cy="14" r="0.6" />
      <circle cx="11.5" cy="16" r="0.6" />
    </>
  ),
  salt: (
    <>
      <path d="M8 9h8v9a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z" />
      <path d="M9 9a3 3 0 0 1 6 0" />
      <circle cx="10.5" cy="6.5" r="0.4" />
      <circle cx="13.5" cy="6.5" r="0.4" />
      <circle cx="12" cy="5.6" r="0.4" />
    </>
  ),
  cake: (
    <>
      <path d="M6 12h12l-1 8H7z" />
      <path d="M6 12a6 6 0 0 1 12 0" />
      <path d="M12 5v3" />
    </>
  ),
  shirt: (
    <path d="M6 4 9 3l3 2 3-2 3 1 2 4-3 1.5V20a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V9.5L4 8z" />
  ),
  pencil: (
    <>
      <path d="M17 3a2.83 2.83 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
      <path d="M15 5 19 9" />
    </>
  ),
  megaphone: (
    <>
      <path d="M3 11v2a1 1 0 0 0 1 1h2l9 5V5L6 10H4a1 1 0 0 0-1 1z" />
      <path d="M18 8a4 4 0 0 1 0 8" />
    </>
  ),
  coins: (
    <>
      <ellipse cx="9" cy="7" rx="6" ry="3" />
      <path d="M3 7v4c0 1.7 2.7 3 6 3" />
      <ellipse cx="15" cy="14" rx="6" ry="3" />
      <path d="M9 14v3c0 1.7 2.7 3 6 3s6-1.3 6-3v-3" />
    </>
  ),
  wrench: (
    <path d="M15 7a4 4 0 0 0-5.2 5.2l-6 6 2 2 6-6A4 4 0 0 0 17 9l-2.5 2.5-2-2L15 7z" />
  ),
  truck: (
    <>
      <path d="M3 6h11v9H3z" />
      <path d="M14 9h4l3 3v3h-7z" />
      <circle cx="7.5" cy="18" r="1.5" />
      <circle cx="17" cy="18" r="1.5" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="12" rx="2" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M3 12h18" />
    </>
  ),
  home: (
    <>
      <path d="M4 11 12 4l8 7" />
      <path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  bag: (
    <>
      <path d="M6 8h12l-1 12H7z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>
  ),
  cutlery: (
    <>
      <path d="M7 3v7a2 2 0 0 0 2 2v9" />
      <path d="M7 3v4" />
      <path d="M11 3v4" />
      <path d="M17 3c-1.5 0-2 2-2 4.5S15.5 12 17 12v9" />
    </>
  ),
  box: (
    <>
      <path d="M4.5 9 19.5 9" />
      <path d="M6 9 7.5 20 16.5 20 18 9" />
      <path d="M8 9 Q12 3.5 16 9" />
    </>
  ),
};

// Sub-category display name -> base icon key.
const SUB_MAP = {
  // Bar
  Beer: "mug",
  Ice: "snowflake",
  Juices: "cup",
  "Other Items": "box",
  "Soft Drinks": "can",
  "Straw & chopstick": "straw",
  Syrups: "bottle",
  Water: "droplet",
  "Wine & Prosecco": "wineglass",
  // Cleaning supplies
  "Bin liners": "bin",
  "Cleaning chemicals": "spray",
  "Cleaning tools": "brush",
  "Paper & wipes": "roll",
  Washroom: "droplet",
  // Kitchen
  "Bakery & Bread": "bread",
  "Dairy & Eggs": "egg",
  "Fresh Vegetables & Herbs": "leaf",
  "Frozen Foods": "snowflake",
  "Kitchen sundries": "pot",
  "Lentils & Pulses": "beans",
  "Meat & Seafood": "fish",
  "Oils & Ghee": "bottle",
  "Rice, Flour & Grains": "wheat",
  "Sauces, Cans & Pastes": "jar",
  "Snacks & Nuts": "nut",
  "Spices & Masala": "spice",
  "Sugar & Salt": "salt",
  "Sweets & Desserts": "cake",
  "Tea & Coffee": "cup",
  // Miscellaneous
  "Staff wear & PPE": "shirt",
  // Office
  "Printer rolls": "roll",
  Stationery: "pencil",
  // Operations
  Advertisement: "megaphone",
  Deposits: "coins",
  "Maintenance & Repairs": "wrench",
  "Online Portals & Delivery": "truck",
  "Professional Services": "briefcase",
  Rent: "home",
  "Salaries & Payroll": "coins",
  "Taxes & Bank Fees": "coins",
  "Utilities & Bills": "bolt",
  // Packing
  Bags: "bag",
  Cutlery: "cutlery",
  "Foil & film": "roll",
  Takeaway: "box",
};

const FALLBACK = (
  <>
    <path d="M12 2 2 7l10 5 10-5-10-5Z" />
    <path d="m2 17 10 5 10-5" />
    <path d="m2 12 10 5 10-5" />
  </>
);

export default function CategoryIcon({ name, size = 20, className = "" }) {
  const node = PATHS[name] || SUB_PATHS[SUB_MAP[name]] || FALLBACK;
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
      {node}
    </svg>
  );
}
