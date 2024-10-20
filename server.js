import express from 'express';
import cors from 'cors';
import userRoutes from './routes/userRoutes.js'
import session from 'express-session'
import dotenv from 'dotenv'
import MySQLStore from 'express-mysql-session';
import mysql from 'mysql2'
import database_config from './model/database_config.js';

dotenv.config()
const app = express();
const port = 3000;

const connection = mysql.createPool(database_config.options);
const sessionStore = new (MySQLStore(session))({ 
  clearExpired: true, 
  checkExpirationInterval: 60000 * 5
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
    maxAge: 14400000,
    // secure: true,
    // httpOnly: true
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