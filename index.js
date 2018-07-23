var express = require('express');
var app = express();
var session = require('express-session')
var bodyParser = require('body-parser');

var router = require('./backendAPI');

//config express to use body parser with JSON
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(session({ secret: 'this-is-a-secret-token', saveUninitialized: true, resave: true, cookie: { maxAge: 60 * 60 * 1000 }}));
app.use(express.static('plugin'));

//for /api use backendAPI router
app.use('/api', router);


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
var server = app.listen(8080, '0.0.0.0', function () {
    console.log('Express App listening at http://localhost:8080');
});