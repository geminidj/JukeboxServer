const express = require('express');
const bodyParser = require("body-parser");

function createRouter(db) {
    const router = express.Router();
    
    router.post('/addsong', (req, res, next) => {

        console.log("addsong called");
        
        const songID = req.body.songID;
        const username = req.body.username;
        const userIP = req.body.userIP;
        const message = req.body.message;
        
        console.log(req.body);
        
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
                    console.log(results);
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

    /* Delete event - Removed for now
    router.delete('/event/:id', function (req, res, next) {
        db.query(
            'DELETE FROM events WHERE id=? AND owner=?',
            [req.params.id, owner],
            (error) => {
                if (error) {
                    res.status(500).json({status: 'error'});
                } else {
                    res.status(200).json({status: 'ok'});
                }
            }
        );
    });
    */
     

    return router;
}

module.exports = createRouter;