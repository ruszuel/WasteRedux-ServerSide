import express from 'express';
import cors from 'cors';
import userRoutes from './routes/userRoutes.js'
import session from 'express-session'
import dotenv from 'dotenv'
import MySQLStore from 'express-mysql-session';
import mysql from 'mysql2'

dotenv.config()
const app = express();
const port = 3000;

const options = {
  host: 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
};

const connection = mysql.createConnection(options);
const sessionStore = new (MySQLStore(session))({ 
  clearExpired: true, 
  checkExpirationInterval: 900000
}, connection)

const corsOptions = {
  origin: 'http://localhost:3000',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(session({
  secret: process.env.SECRET_SESSION_TOKEN,
  saveUninitialized: false,
  resave: false,
  cookie: {
    maxAge: 86400 * 1000
  },
  store: sessionStore
}))

app.use(cors(corsOptions));
app.use(express.json());
app.use('/user', userRoutes);

app.listen(port, () => {
  console.log(`listening to port ${port}`)
})

export default app