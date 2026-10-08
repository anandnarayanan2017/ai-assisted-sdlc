CREATE TABLE users (
  id    serial PRIMARY KEY,
  email text NOT NULL UNIQUE,
  name  text NOT NULL,
  role  text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin'))
);

CREATE TABLE rooms (
  id       serial PRIMARY KEY,
  name     text NOT NULL UNIQUE,
  capacity int  NOT NULL CHECK (capacity > 0)
);
