
var mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI);
//local: 'mongodb://localhost/test2'

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
    console.log("we're connected!");
});

var userSchema = mongoose.Schema({
    username: String,
    password: String,
    groups: [String]
});

var User = mongoose.model('User', userSchema);

var eventSchema = mongoose.Schema({
    groupName: String,
    details: [{
        title: String,
        created: Date,
        date: String
    }]
});

var GroupEvents = mongoose.model('GroupEvents', eventSchema);

var votingSchema = mongoose.Schema({
    groupName: String,
    events: [{
        title: String,
        created: Date, // Creation date of event, not of voting
        votings: [{
            title: String,
            created: Date,
            votingType: Number,
            result: {
                title: String, 
                quantity: Number
            },
            choices: [{
                title: String,
                users: [String]
            }]
        }]
    }]
});

var GroupVotings = mongoose.model('GroupVotings', votingSchema);

module.exports = { 
    User: User,
    GroupEvents: GroupEvents,
    GroupVotings: GroupVotings
};