﻿const express = require('express');
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
    .use(events(connection))

app.listen(port, () => {
    console.log(`Express server listening on port ${port}`);
});

const socketapp = require('express')();
const http = require('http').createServer(socketapp);
const io = require('socket.io')(http, {
    cors: {
        origins: ['http://localhost:4200']
    }
});

app.get('/', (req, res) => {
    res.send('<h1>Hey Socket.io</h1>');
});

io.on('connection', (socket) => {
    console.log('User connected. ID: ' + socket.id);
    socket.on('disconnect', () => {
        console.log(socket.id + ' disconnected');
    });

    socket.on('trigger queue update',(msg)=>{
        console.log("Someone added a song to the queue");
        io.emit('broadcast queue update', `someone has clicked to update the queue`);
    })

    socket.on('trigger nowplaying update',(msg)=>{
        console.log("The currently playing song has changed");
        io.emit('broadcast nowplaying update', `update the nowplaying song`);
    })

});


http.listen(3000, () => {
    console.log('Socket.IO listening on 3000');
});
