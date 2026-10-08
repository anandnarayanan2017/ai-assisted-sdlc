import pg from "pg";
import { createApp } from "./app.js";
import { migrate } from "./db/migrate.js";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
await migrate(pool);
const port = Number(process.env.PORT ?? 3000);
createApp(pool).listen(port, () => console.log(`room-booking listening on ${port}`));
