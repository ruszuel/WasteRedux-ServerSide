import connection from './database_config.js'

connection.connect();
connection.query('SELECT * from users',(err, result) => {
    if (err) throw err
    console.log(result)
});
connection.end();