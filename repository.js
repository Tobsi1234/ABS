
var mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI);
//local: 'mongodb://localhost/test2'

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
    console.log("we're connected!");
});

var MessageType = {"MEMBER_NEW": "MEMBER_NEW"};
Object.freeze(MessageType);

var userSchema = mongoose.Schema({
    username: String,
    password: String,
    groups: [{
        title: String, 
        status: Number // 0: Admin, 1: Normal member of group, 2: Requested to be member of group
    }],
    events: [{ // events which are not within a group
        title: String, 
        status: Number // 0: Admin, 1: Normal member of event
    }],
    messages: [{
        messageType: String, // e.g. "MEMBER_NEW"
        groupName: String,
        content: String, // e.g. Username
        created: Date
    }]
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

var chatSchema = mongoose.Schema({
    groupName: String,
    eventName: String, //either groupName or eventName should be filled
    messages: [String]
});

var Chat = mongoose.model('Chat', chatSchema);

module.exports = { 
    User: User,
    GroupEvents: GroupEvents,
    GroupVotings: GroupVotings,
    Chat: Chat,
    MessageType: MessageType
};