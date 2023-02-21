const express = require('express');
const io_client = require('socket.io-client');

const totalDailyVotes = 1000;
const maxDailyRequests = 50;
let oldSongID = 0;

function createRouter(db) {
    
    const router = express.Router();
    const ioclient = io_client.connect('http://localhost:3000');

    setInterval(function (){
        checkForNewSong();
    },1000)

    setInterval(function (){
        reenableSongs();
    },10000)
    
    router.post('/addvotes',(req,res)=>{
        
        console.log("addvotes called");
        const email = req.body.email;
        const votes = Number(req.body.votes);
        const songID = req.body.songid;
        let fixedVotes = 0;
        let numVotes = 0;

        console.log("email: " + email);
        console.log("votes: " + votes);
        console.log("songID: " + songID);

        
        db.query(
            'SELECT * FROM website_users WHERE email LIKE ?',
            [email],
            (error, results)=>{
                if(error){
                    console.error("Error adding votes")
                    console.error(error);
                }else{
                    console.log("Stage 1")
                    console.log(JSON.stringify(results));
                    
                    if (votes < 0){
                        fixedVotes = votes * -1;
                    }else{
                        fixedVotes = votes;
                    }

                    console.log("*****");
                    console.log(results[0].votesused);
                    console.log(fixedVotes);
                    
                    let newTotalvotes = results[0].votesused + fixedVotes
                    
                    console.log(newTotalvotes);
                    
                    if(newTotalvotes > totalDailyVotes){
                        //num votes user has submitted is higher than the daily limit
                        res.status(200).json({message:'daily vote limit exceeded'});
                    }else{
                        //UPDATE THE VOTES
                        db.query(
                            'SELECT * FROM queuelist WHERE songID LIKE ?',
                            [songID],
                            (error,results)=>{
                                if(error){
                                    console.log("Error querying number of votes");
                                    console.log(error)
                                }
                                else if(results.length === 1){
                                    numVotes = results[0].votes + votes;
                                    db.query(
                                        'UPDATE queuelist SET votes = ? WHERE songID LIKE ?',
                                        [numVotes,songID],
                                        (error,results)=>{
                                            if(error){
                                                console.log(error);
                                            }
                                            if(results.affectedRows > 0){
                                                ioclient.emit("update queue", "update queue");
                                            }
                                            //UPDATE THE QUERY
                                            db.query(
                                                'UPDATE website_users SET votesused = ? WHERE email LIKE ?',
                                                [newTotalvotes, email],
                                                (error) => {
                                                    if (error) {
                                                        console.log("Error updating vote count");
                                                        console.error(error);
                                                    }
                                                }
                                            )
                                        }
                                    )
                                }else{
                                    console.log("Too many results in query");
                                }
                            }
                        )
                    }
                    
                }
            }
        )
        
    })


    router.post('/addsong', (req, res) => {

        const songID = req.body.songID;
        const username = req.body.username;
        const userIP = req.body.userIP;
        const message = req.body.message;

        db.query(
            'SELECT * FROM website_users WHERE email LIKE ?',
            [username],
            (error, results) => {
                if (error) {
                    console.log(error);
                    res.status(500).json({status: 'error'});
                } else if (results.length === 1) {

                    let reenableuser = results[0].reenableUser;
                    let tableyear = results[0].lastrequestdate.getFullYear();
                    let tablemonth = results[0].lastrequestdate.getMonth() + 1;
                    let tableday = results[0].lastrequestdate.getDate();
                    let numrequests = results[0].requeststoday;

 
                    
                    if(new Date() > reenableuser) {

                        if (usedAllRequests(tableday, tablemonth, tableyear, numrequests, username)) {
                            //All requests used - No more requests
                            res.status(200).json({status: 'daily requests exceeded'})
                        } else {
                            //More requests allowed
                            db.query(
                                'INSERT INTO requests (songID, username, userIP, message) VALUES (?,?,?,?)',
                                [songID, username, userIP, message],
                                (error) => {
                                    if (error) {
                                        console.error(error);
                                        res.status(500).json({status: 'something went wrong adding song to queue'});
                                    } else {
                                        disableSong(songID);
                                        cooldownUser(reenableuser, username);
                                        res.status(200).json({status: 'ok'});
                                    }
                                }
                            );
                        }
                    }else{
                        //TODO - Set up a friendly return to the request with some helpful error message
                        console.log("user in cooldown");
                    }
                } else {
                    res.status(500).json({status: results});
                }
            }
        );
    });
    
    router.get('/getmaxdailyrequests', function(req,res){
        res.status(200).json({playcount:maxDailyRequests, votecount:totalDailyVotes});
    })

    router.get('/getmaxdailyvotes', function(req,res){
        res.status(200).json({votes:getmaxdailyvotes});
    })
    
    router.post('/getuserdailyrequests', function (req, res){
        
        const email = req.body.email;
        
        db.query(
            'SELECT requeststoday,votesused FROM website_users WHERE email LIKE ?',
            [email],
            (error, results) => {
                if (error) {
                    console.log(error);
                    res.status(500).json({status: 'error'});
                } else {
                    res.status(200).json(results);
                }
            }
        );
    })
    
    

    router.get('/getnumberofsongs', function (req, res) {

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

    router.get('/getqueue', function (req, res) {

        db.query(
            'SELECT id, songID, artist, title, ETA FROM queuelist',
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

    router.get('/getnowplaying', function (req, res) {
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
    
    router.post('/getnumsongs', function (req, res) {
        
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
            'SELECT ID, artist, title, date_played, soft_enabled FROM songs',
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
    router.post('/getcooldown', (req, res)=>{
        const email = req.body.email;

        db.query(
            'SELECT * FROM website_users WHERE email LIKE ?',
            [email],
            (error, results) => {
                if (error) {
                    console.log(error);
                    res.status(500).json({status: 'error'});
                } else{
                    //console.log(JSON.stringify(results));
                    res.status(200).json(results);
                }
            }
        )
    })

    router.post('/adduser', (req, res) => {

        const email = req.body.email;
        const name = req.body.name;
        const picture = req.body.picture;
        const numrequests = 0;
        

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
                            'INSERT INTO website_users (email, name, picture,requeststoday) VALUES (?,?,?,?)',
                            [email, name, picture, numrequests],
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
    
    //Calculates how long a user must wait in cooldown before being able to make another request
    function calculateCooldown(){
       
        let result = new Date();
        
        result.setMinutes(result.getMinutes() + 1);
        return result;
    }
    
    function cooldownUser(date, email){
        
        let resumeDate = calculateCooldown();
        
        db.query(
            'UPDATE website_users SET reenableUser = ? WHERE email LIKE ?',
            [resumeDate, email],
            (error) => {
                if (error) {
                    console.log("ERROR setting lastrequestdatetime");
                    console.error(error);
                }else{
                    ioclient.emit("update cooldown", email);
                }
            }
        )
    }
    
    function disableSong(songID){
        db.query(
            'UPDATE songs SET soft_enabled = 0 WHERE ID LIKE ?',
            [songID],
            (error) => {
                if (error) {
                    console.log("ERROR disabling " + songID);
                    console.error(error);
                }
            }
        )
    }
    
    
    //HELPER METHODS
    
    function reenableSongs(){
        db.query(
            'SELECT * FROM songs WHERE soft_enabled = 0',
            (error, results) => {
                let playedDate;
                let disabledDate;
                if (error) {
                    console.error("Something went wrong searching for songs to reenable");
                    console.log(error);
                } else {
                    if (results.length > 0) {
                        //at least one song found that has been disabled - test if they should be re-enabled
                        for (let i = 0; i < results.length; i++) {
                            disabledDate = new Date(results[i].date_disabled);
                            playedDate = new Date(results[i].date_played);

                            if (disabledDate < playedDate) {
                                //Song has been played since it was disabled - Start timer for re-enable.
                                playedDate.setHours(playedDate.getHours() + 6);
                                if(playedDate < new Date()){
                                    //reenable song
                                    db.query(
                                        'UPDATE songs SET soft_enabled = 1 WHERE ID LIKE ?',
                                        [results[i].ID],
                                        (error) => {
                                            if (error) {
                                                console.error(error);
                                                console.log("Error re-enabling song with ID: " + results[i].ID);
                                            } else {
                                                console.log("Re-enabling song ID: " + results[i].ID);
                                            }
                                        }
                                    )
                                    
                                }
                            }
                        }
                    }
                }
            }
        );
    }
    
    function checkForNewSong(){
        db.query(
            'SELECT ID FROM history ORDER BY ID DESC LIMIT 1',
            (error, results) => {
                if (error) {
                    console.error("Something went wrong in checkForNewSong()");
                    console.log(error);
                } else {
                    if(results[0].ID === oldSongID){
                        //song hasnt changed, no nothing
                    }
                    else{
                        //song has changed - do something
                        oldSongID = results[0].ID;
                        ioclient.emit("update nowplaying", "update nowplaying");
                    }
                }
            }
        );
    }
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
    
    function usedAllRequests(day, month, year, numrequests, email){
        
        let date = new Date();
        let newday = date.getDate();
        let newmonth = date.getMonth() + 1;
        let newyear = date.getFullYear();
        
        if ((day === newday) && (month === newmonth) && (year === newyear)){

            if(numrequests > maxDailyRequests){
                console.log(email + " has requested too many songs");
                return true;
            }
            
            db.query(
                'UPDATE website_users SET requeststoday = ? WHERE email LIKE ?',
                [(numrequests + 1),email],
                (error) => {
                    if (error) {
                        console.error(error);
                    } else {
                        console.log("Play count updated for " + email + " to " + (numrequests+1));
                    }
                }
            )
            
            return numrequests >= maxDailyRequests;
        }
        else{

            db.query(
                'UPDATE website_users SET requeststoday = 1, lastrequestdate = ? WHERE email LIKE ?',
                [date,email],
                (error) => {
                    if (error) {
                        console.error(error);
                    } else {
                        console.log("Date updated for " + email);
                    }
                }
            )
            
            return false;
        }
    }
     

    return router;
}

module.exports = createRouter;