const express = require('express');
const bodyParser = require("body-parser");
const {DATETIME, DATE, DATETIME2} = require("mysql/lib/protocol/constants/types");

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

    router.post('/gettodaysplaycount', function (req, res, next) {

        const email = req.body.email;
        let count = 0;

        db.query(
            'SELECT ID, requested FROM requests WHERE username LIKE ?',
            [email],
            (error, results) => {
                if (error) {
                    console.log(error);
                    res.status(500).json({status: 'error'});
                } else {
                    res.status(200).json(getRequestCount(results));
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
                                    res.status(200).json({status: 'user added to DB'});
                                }
                            }
                        );
                    }
                    
                    
                    
                }
            }
        );
    });
    
    
    //HELPER METHODS
    function wasToday(incoming) {

        let today = new Date()
        let t_dd = String(today.getDate()).padStart(2, '0');
        let t_mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0 - stupid
        let t_yyyy = today.getFullYear();
        let t_result = t_dd + "/" + t_mm + "/" + t_yyyy

        let r_string = String(incoming.requested);

        let r_dd = r_string.substring(8,10);
        let r_mm = getMonth(r_string.substring(4,7));
        let r_yyyy = r_string.substring(11,15);
        let r_result = r_dd + "/" + r_mm + "/" + r_yyyy

        return t_result === r_result;

    }

    function getMonth(month) {
        switch (month) {
            case "Jan":
                return "01";
            case "Feb":
                return "02";
            case "Mar":
                return "03";
            case "Apr":
                return "04";
            case "May":
                return "05";
            case "Jun":
                return "06";
            case "Jul":
                return "07";
            case "Aug":
                return "08";
            case "Sep":
                return "09";
            case "Oct":
                return "10";
            case "Nov":
                return "11";
            case "Dec":
                return "12";
        }
    }
    
    function getRequestCount(results){
        
        let count = 0;
        
        results.forEach(element => {
            if(wasToday(element)){
                count++;
            }
        })
        return count;
    }
     

    return router;
}

module.exports = createRouter;