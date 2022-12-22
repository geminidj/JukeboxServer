const express = require('express');
const bodyParser = require("body-parser");

function createRouter(db) {
    const router = express.Router();
    
    router.post('/addsong', (req, res, next) => {
        
        const songID = req.body.songID;
        const username = req.body.username;
        const userIP = req.body.userIP;
        const message = req.body.message;
        
        db.query(
            'INSERT INTO requests (songID, username, userIP, message) VALUES (?,?,?,?)',
            [songID, username, userIP, message],
            (error) => {
                if (error) {
                    console.error(error);
                    res.status(500).json({status: 'error'});
                } else {
                    res.status(200).json({status: 'ok'});
                }
            }
        );
    });

    router.get('/getnumberofsongs', function (req, res, next) {

        db.query(
            'SELECT COUNT(*) as count FROM songs',
            (error, results) => {
                if (error) {
                    console.log(error);
                    res.status(500).json({status: 'error'});
                } else {
                    res.status(200).json(results);
                }
            }
        );
    });

    router.get('/getqueue', function (req, res, next) {

        db.query(
            'SELECT id, songID, artist, title FROM queuelist',
            (error, results) => {
                if (error) {
                    console.log(error);
                    res.status(500).json({status: 'error'});
                } else {
                    res.status(200).json(results);
                }
            }
        );
    });

    router.get('/getnowplaying', function (req, res, next) {
        db.query(
            'SELECT ID, artist, title FROM history ORDER BY ID DESC LIMIT 1',
            (error, results) => {
                if (error) {
                    console.log(error);
                    res.status(500).json({status: 'error'});
                } else {
                    res.status(200).json(results);
                }
            }
        );
    });
    
    router.post('/getnumsongs', function (req, res, next) {
        
        const numSongs = Number(req.body.numSongs);
        const baseSong = req.body.baseSong;
        const topSong = baseSong + numSongs;
        
        db.query(
            'SELECT ID, artist, title FROM songs WHERE ID BETWEEN ? and ? LIMIT ?',
            [baseSong,topSong,numSongs],
            (error, results) => {
                if (error) {
                    console.log(error);
                    res.status(500).json({status: 'error'});
                } else {
                    res.status(200).json(results);
                }
            }
        );
    });
    
    router.get('/getallsongs', (req,res) =>{
        db.query(
            'SELECT ID, artist, title FROM songs',
            (error, results) => {
                if (error) {
                    console.log(error);
                    res.status(500).json({status: 'error'});
                } else{
                    res.status(200).json(results);
                }
            }
        )
    })
    
    
    //USERS

    router.post('/adduser', (req, res, next) => {

        const email = req.body.email;
        const name = req.body.name;
        const picture = req.body.picture;

        db.query(
            'SELECT * FROM website_users WHERE email LIKE ? ',
            [email],
            (error,results) => {
                if (error) {
                    console.error(error);
                    res.status(500).json({status: 'error'});
                } else {
                    
                    if(results.length > 0){
                        //User already in database - Ignore
                        res.status(200).json({status: 'user already in DB'});
                    }
                    else{
                        //User not in database - Write user to database
                        db.query(
                            'INSERT INTO website_users (email, name, picture) VALUES (?,?,?)',
                            [email, name, picture],
                            (error) => {
                                if (error) {
                                    console.error(error);
                                    res.status(500).json({status: 'error'});
                                } else {
                                    res.status(200).json({status: 'ok'});
                                }
                            }
                        );
                    }
                    
                    
                    
                }
            }
        );
    });
     

    return router;
}

module.exports = createRouter;