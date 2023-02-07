const express = require('express');
const cors = require('cors');
const mysql = require('mysql');
const events = require('./events');
const {Server} = require('socket.io');
const socketServer = require('express')();
const http = require('http').Server(socketServer);
const io = require('socket.io')(http);

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

socketServer.use(cors());

socketServer.get('/', function(req, res){ res.sendFile('C:/test/index.html');
});

//Whenever someone connects this gets executed
io.on('connection', function(socket){
    console.log('A user connected');

    //Whenever someone disconnects this piece of code executed
    socket.on('disconnect', function () {
        console.log('A user disconnected');
    });
});
http.listen(3000, function(){
    console.log('Socket.IO listening on 3000');
});