import mysql from 'mysql2';

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'C@ps_db5262_003',
    database: 'wasteredux'
});

connection.connect((err) => {
    if (err) throw err;
    console.log('connected')
});
    
export default connection;