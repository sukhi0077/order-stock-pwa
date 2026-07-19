-- =============================================================================
-- Icons by id (run once in the Supabase SQL Editor)
--
-- The icon glyphs live in the APP CODE, keyed by a stable `icon_id` string
-- (e.g. 'beerMug'). This adds an `icon_id` column to the master tables so each
-- category / sub-category stores *which* icon it uses. Because the app then
-- renders by icon_id (not by name), renaming a category/sub-category never
-- changes its icon.
--
-- Additive + idempotent: the column is only added if missing, and each seed row
-- is only set when icon_id is still empty (so it never clobbers a value you've
-- changed, and won't touch rows you've renamed once they have an icon).
-- =============================================================================

alter table public.categories     add column if not exists icon_id text;
alter table public.sub_categories add column if not exists icon_id text;

-- Categories -> icon key
update public.categories c set icon_id = m.icon
from (values
  ('Kitchen', 'chefHat'),
  ('Bar', 'martini'),
  ('Operations', 'sliders'),
  ('Cleaning supplies', 'bucket'),
  ('Office', 'pencil'),
  ('Packing', 'pkg'),
  ('Miscellaneous', 'grid')
) as m(name, icon)
where c.name = m.name and c.icon_id is null;

-- Sub-categories -> icon key (by canonical name)
update public.sub_categories s set icon_id = m.icon
from (values
  ('Beer', 'beerMug'),
  ('Ice', 'snowflake'),
  ('Juices', 'cupSoda'),
  ('Other Items', 'pkg'),
  ('Soft Drinks', 'sodaBottle'),
  ('Straw & chopstick', 'straws'),
  ('Syrups', 'pumpBottle'),
  ('Tea & Coffee', 'coffee'),
  ('Water', 'droplet'),
  ('Wine & Prosecco', 'wineGlass'),
  ('Bin liners', 'trash'),
  ('Cleaning chemicals', 'sprayBottle'),
  ('Cleaning tools', 'brush'),
  ('Paper & wipes', 'roll'),
  ('Washroom', 'droplets'),
  ('Bakery & Bread', 'bread'),
  ('Dairy & Eggs', 'milkEgg'),
  ('Fresh Vegetables & Herbs', 'carrot'),
  ('Frozen Foods', 'snowflake'),
  ('Kitchen sundries', 'pot'),
  ('Lentils & Pulses', 'beans'),
  ('Meat & Seafood', 'fish'),
  ('Oils & Ghee', 'oilBottle'),
  ('Rice, Flour & Grains', 'wheat'),
  ('Sauces, Cans & Pastes', 'tinCan'),
  ('Snacks & Nuts', 'peanut'),
  ('Spices & Masala', 'spice'),
  ('Sugar & Salt', 'salt'),
  ('Sweets & Desserts', 'cupcake'),
  ('Staff wear & PPE', 'shirt'),
  ('Printer rolls', 'printer'),
  ('Stationery', 'pencil'),
  ('Advertisement', 'megaphone'),
  ('Deposits', 'piggyBank'),
  ('Maintenance & Repairs', 'wrench'),
  ('Online Portals & Delivery', 'truck'),
  ('Professional Services', 'briefcase'),
  ('Rent', 'house'),
  ('Salaries & Payroll', 'wallet'),
  ('Taxes & Bank Fees', 'landmark'),
  ('Utilities & Bills', 'zap'),
  ('Bags', 'shoppingBag'),
  ('Cutlery', 'cutlery'),
  ('Foil & film', 'roll'),
  ('Takeaway box', 'curryBox'),
  ('Takeaway', 'curryBox')
) as m(name, icon)
where s.name = m.name and s.icon_id is null;

-- Already-renamed sub-categories (name no longer canonical) — set by id.
update public.sub_categories set icon_id = 'curryBox'
where id = 'fdc10f72-f2ae-485c-9323-fb7871a93685' and icon_id is null; -- "Takeaway Containers"
