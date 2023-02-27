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
        checkForSongTransfer();
    },10000)
    
    router.post('/addvotes',(req,res)=>{
        
        const email = req.body.email;
        const votes = Number(req.body.votes);
        const songID = req.body.songid;
        let fixedVotes = 0;
        let numVotes = 0;
        
        db.query(
            'SELECT * FROM website_users WHERE email LIKE ?',
            [email],
            (error, results)=>{
                if(error){
                    console.error("Error adding votes")
                    console.error(error);
                }else{
                    if (votes < 0){
                        fixedVotes = votes * -1;
                    }else{
                        fixedVotes = votes;
                    }
                    
                    let newTotalvotes = results[0].votesused + fixedVotes
                    
                    if(newTotalvotes > totalDailyVotes){
                        //num votes user has submitted is higher than the daily limit
                        res.status(200).json({message:'daily vote limit exceeded'});
                    }else{
                        //UPDATE THE VOTES
                        db.query(
                            'SELECT * FROM voteslist WHERE songID LIKE ?',
                            [songID],
                            (error,results)=>{
                                if(error){
                                    console.error("Error querying number of votes");
                                    console.error(error)
                                }
                                else if(results.length === 1){
                                    numVotes = results[0].votes + votes;
                                    db.query(
                                        'UPDATE voteslist SET votes = ? WHERE songID LIKE ?',
                                        [numVotes,songID],
                                        (error,results)=>{
                                            if(error){
                                                console.error(error);
                                            }
                                            if(results.affectedRows > 0){
                                                //reorderQueue();
                                            }
                                            //UPDATE THE QUERY
                                            db.query(
                                                'UPDATE website_users SET votesused = ? WHERE email LIKE ?',
                                                [newTotalvotes, email],
                                                (error) => {
                                                    if (error) {
                                                        console.error("Error updating vote count");
                                                        console.error(error);
                                                    }
                                                    ioclient.emit("update votes", "update votes");
                                                }
                                            )
                                        }
                                    )
                                }else{
                                    console.error("Too many/few results in query");
                                    console.error(JSON.stringify(results));
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
                    console.error(error);
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
                                'SELECT * FROM songs WHERE ID = ?',
                                [songID],
                                (error, songInfo) => {
                                    if (error) {
                                        console.error("Error retrieving song info");
                                        console.error(error);
                                    }
                                    if(songInfo.length === 1){
                                        db.query(
                                            'INSERT INTO voteslist (songID, username, userIP, message, artist, title) VALUES (?,?,?,?,?,?)',
                                            [songID, username, userIP, message, songInfo[0].artist,songInfo[0].title],
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


                                }
                            )
                            

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
                    console.error(error);
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
                    console.error(error);
                    res.status(500).json({status: 'error'});
                } else {
                    res.status(200).json(results);
                }
            }
        );
    });

    router.get('/getqueue', function (req, res) {

        db.query(
            'SELECT * FROM voteslist ORDER BY votes DESC',
            (error, results) => {
                if (error) {
                    console.error(error);
                    res.status(500).json({status: 'error'});
                } else {
                    res.status(200).json(results);
                }
            }
        );
    });
    

    router.get('/getupnext', function (req, res) {

        db.query(
            'SELECT id, songID, artist, title, votes FROM queuelist',
            (error, results) => {
                if (error) {
                    console.error(error);
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
                    console.error(error);
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
                    console.error(error);
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
                    console.error(error);
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
                    console.error(error);
                    res.status(500).json({status: 'error'});
                } else{
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
    
    function insertIntoRequestTable(id,username,ip,message){
        db.query(
            'INSERT INTO requests (songID, username, userIP, message) VALUES (?,?,?,?)',
            [id,username,ip,message],
            (error)=>{
                if(error){
                    console.error("Error inserting into queuelist from votelist");
                    console.error(error);
                }
            }
        )
    }
    
    function getSongInfo(id) {
         db.query(
            'SELECT * FROM songs WHERE ID = ?',
            [id],
            (error, results) => {
                if (error) {
                    console.error("Error retrieving song info");
                    console.error(error);
                }
                if (results.length === 1) {
                    return [results[0].artist, results[0].title];
                }

            }
        )
    }
    
    function removeFromVotelist(id){
        db.query(
            'DELETE FROM voteslist WHERE songID = ?',
            [id],
            (error)=>{
                if(error){
                    console.error("Error removing song from vote list");
                    console.error(error);
                }
            }
        )
    }
    
    function checkForSongTransfer(){
        db.query(
            'SELECT ID FROM queuelist',
            (error,results)=>{
                if(error){
                    console.error("Error checking queue length");
                    console.error(error);
                }
                if(results.length<3){
                    //Less than 3 songs in "UP NEXT" section - Add one"
                    db.query(
                        'SELECT * FROM voteslist ORDER BY votes DESC LIMIT 1',
                        (error,results)=>{
                            if(error){
                                console.error("Error retrieving songs from votelist");
                                console.error(error);
                            }
                            if(results.length === 0){
                                //console.log("No songs in votelist to transfer");
                            }
                            else if(results.length === 1) {
                                insertIntoRequestTable(results[0].songID, results[0].username, results[0].userIP, results[0].message);
                                removeFromVotelist(results[0].songID);
                                ioclient.emit('update upnext','update upnext');
                                ioclient.emit("update queue", "update queue");
                            }
                            else{
                                console.error("Too many songs retrieved by query (this is a serious fuckup)")
                            }
                        }
                    )
                }
            }
        )
        
    }
    
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
                    console.error("ERROR setting lastrequestdatetime");
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
                    console.error("ERROR disabling " + songID);
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
                    console.error(error);
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
                                            } 
                                        }
                                    )
                                    console.log("Song:", results[i].ID, " has been re-enabled");
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
                    console.error(error);
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
    
    function resetRequestCount(email){
        let date = new Date();
        db.query(
            'UPDATE website_users SET requeststoday = 1, lastrequestdate = ? WHERE email LIKE ?',
            [date,email],
            (error) => {
                if (error) {
                    console.error(error);
                }
            }
        )
    }

    function resetVoteCount(email){
        let date = new Date();
        db.query(
            'UPDATE website_users SET votesused = 0, lastvotedate = ? WHERE email LIKE ?',
            [date,email],
            (error) => {
                if (error) {
                    console.error(error);
                }
            }
        )
    }
    
    function usedAllRequests(day, month, year, numrequests, email){
        
        let date = new Date();
        let newday = date.getDate();
        let newmonth = date.getMonth() + 1;
        let newyear = date.getFullYear();

        if(numrequests > maxDailyRequests){
            return true;
        }
        
        if ((day === newday) && (month === newmonth) && (year === newyear)){
            
            db.query(
                'UPDATE website_users SET requeststoday = ? WHERE email LIKE ?',
                [(numrequests + 1),email],
                (error) => {
                    if (error) {
                        console.error(error);
                    }
                }
            )
            
            return numrequests >= maxDailyRequests;
        }
        else{
            
            resetRequestCount(email);
            resetVoteCount(email);
            
            
            return false;
        }
    }
     

    return router;
}

module.exports = createRouter;