CREATE EXTENSION IF NOT EXISTS btree_gist;

-- The invariant lives in the database: no two confirmed bookings for a room may overlap.
ALTER TABLE bookings
  ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (room_id WITH =, tstzrange(start_at, end_at) WITH &&)
  WHERE (status = 'confirmed');
