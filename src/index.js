const express = require('express');
const cors = require('cors');
const mysql = require('mysql');
const events = require('./events');

const connection = mysql.createConnection({
    host     : 'localhost',
    user     : 'radiodj-smart',
    password : '-7Rza!k@JS5nC4kM',
    database : 'radiodj20341'
});

connection.connect();

const port = process.env.PORT || 8080;

const app = express()
    .use(cors())
    .use(express.urlencoded())
    .use(events(connection));

app.listen(port, () => {
    console.log(`Express server listening on port ${port}`);
});