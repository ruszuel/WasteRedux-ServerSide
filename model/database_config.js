import mysql from 'mysql2';
import dotenv from 'dotenv'

dotenv.config()
const options = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10,
  idleTimeout: 60000,
  queueLimit: 50,
  enableKeepAlive: true,
  keepAliveInitialDelay: 5000
}
const pool = mysql.createPool(options)

const promisePool = pool.promise();
    
export default {promisePool, options};