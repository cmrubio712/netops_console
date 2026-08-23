import mysql from "mysql2/promise";

import { db } from "../config";

export const pool = mysql.createPool({
  host: db.host,
  port: db.port,
  user: db.user,
  password: db.password,
  database: db.database,
  waitForConnections: true,
  connectionLimit: 5,
  dateStrings: true,
});
