CREATE TABLE bookings (
  id         serial PRIMARY KEY,
  room_id    int         NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id    int         NOT NULL REFERENCES users(id),
  start_at   timestamptz NOT NULL,
  end_at     timestamptz NOT NULL,
  status     text        NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);

CREATE INDEX bookings_room_time_idx ON bookings (room_id, start_at, end_at);
