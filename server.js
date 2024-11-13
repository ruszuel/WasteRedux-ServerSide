import express from 'express';
import cors from 'cors';
import userRoutes from './routes/userRoutes.js'
import session from 'express-session'
import dotenv from 'dotenv'
import MySQLStore from 'express-mysql-session';
import mysql from 'mysql2'
import database_config from './model/database_config.js';
import helmet from 'helmet'
import loadModel from './controllers/modelController.js'

dotenv.config()
const app = express();
const port = 3000;

const connection = mysql.createPool(database_config.options);
const sessionStore = new (MySQLStore(session))({ 
  clearExpired: true, 
  checkExpirationInterval: 60000 * 5
}, connection)

const corsOptions = {
  origin: true,
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(session({
  name: 'waste',
  secret: process.env.SECRET_SESSION_TOKEN,
  saveUninitialized: false,
  resave: false,
  cookie: {
    maxAge: 14400000, //4hrs
    secure: true,
    httpOnly: true,
    sameSite: 'None'
  },
  store: sessionStore
}))

app.use(cors());
app.use(express.json());
app.use(helmet())
app.use('/user', userRoutes);

app.listen(port, async () => {
  await loadModel.loadModel()
  console.log(`listening to port ${port}`)
})

export default app