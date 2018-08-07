var express = require('express');
var app = express();
var http = require('http').Server(app);
var session = require('express-session')
var bodyParser = require('body-parser');
var MemoryStore = require('session-memory-store')(session);
var io = require('socket.io')(http);

var db = require('./repository.js');
var User = db.User;
var router = require('./backendAPI');

//config express to use body parser with JSON
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(session({name: 'JSESSION', secret: 'this-is-a-secret-token', saveUninitialized: true, resave: true, store: new MemoryStore()}));
app.use(express.static('public'));

//for /api use backendAPI router
app.use('/api', router);


io.on('connection', function(socket){
    console.log('a user connected');
    socket.on('disconnect', function(){
        console.log('user disconnected');
    });
    socket.on('chat message', function(msg){
        console.log('groupName: ' + msg.groupName + ', message: ' + msg.message);
        io.to(msg.groupName).emit('chat message', msg);
    });

    socket.on('subscribe', function(data) {
        User.findOne({_id: data.userId, groups: data.room}, function(err, doc) {
            if(doc != null) {
                socket.join(data.room);
            }
        });
    });

    socket.on('unsubscribe', function(data) {
        var rooms = io.sockets.adapter.sids[socket.id];
        for(var room in rooms) {
            socket.leave(room);
        }
    });
});


//define route "/" (root) with response 
app.get(['/','/index.html'], function (req, res) {
    console.log("User: " + req.session.username);
    res.sendFile( __dirname + "/index.html" );
 });

 app.get(['/pages/home.html'], function (req, res) { 
    res.sendFile( __dirname + "/pages/home.html" );
 });

 app.get(['/pages/events.html'], function (req, res) { 
    res.sendFile( __dirname + "/pages/events.html" );
 });

 app.get(['/pages/settings.html'], function (req, res) { 
    res.sendFile( __dirname + "/pages/settings.html" );
 });

 app.get(['/pages/user.html'], function (req, res) { 
    res.sendFile( __dirname + "/pages/user.html" );
 });



 //start express server (application) on port 8080 and log announce to console
var server = http.listen(process.env.PORT || 8080, '0.0.0.0', function () {
    console.log('Express App listening at http://localhost:8080');
});