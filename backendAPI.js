var express = require('express');
var router = express.Router();

var db = require('./repository.js');
var User = db.User;
var GroupEvents = db.GroupEvents;
var GroupVotings = db.GroupVotings;
var Chat = db.Chat;
    
// middleware specific to this router
// authentication, logging, etc.
router.use(function(req, res, next) {
  console.log('API access: ', new Date() );
  next();
});

// logging middleware for /student
router.use('/user', function(req, res, next) {
  console.log( req.method + ' /user');
  next();
});

// Get all users
router.get('/user', function(req, res) {
    User.find({}, function(err, docs) { res.send(docs);});
});

// Get all groupEvents
router.get('/groupEvents', function(req, res) {
    GroupEvents.find({}, function(err, docs) { res.send(docs);});
});

// Get all groupVotings
router.get('/groupVotings', function(req, res) {
    GroupVotings.find({}, function(err, docs) { res.send(docs);});
});

// Get all chats
router.get('/chat', function(req, res) {
    Chat.find({}, function(err, docs) { res.send(docs);});
});

router.post('/session', function(req, res) {
    res.send([req.session.username, req.session.selectedGroup]);
});

//Create new user
router.post('/user', function(req, res) {
    var newUser = new User({
        username: req.body.username,
        password: req.body.password
    });

    User.find({username: newUser.username}, function(err, docs) {
        if(docs == "") {
            newUser.save(function (err, newUser) {
                if (err) return console.error(err);
                console.log("saved: " + newUser.username);
            });
            res.send(newUser.username);
        } else {
            res.send("Username bereits vorhanden.");
        }
    });
});

//login
router.post('/login', function(req, res) {
    User.find({username: req.body.username}, function(err, docs) {
        if(err) res.send("Unknown error.");
        if(docs == "") {
            res.send("Username nicht vorhanden.");
        } else {
            if(docs[0].password != null && req.body.password == docs[0].password) {
                req.session.username = docs[0].username;
                res.sendStatus(200);
            } else {
                res.send("Passowrt falsch, richtiges: " + docs[0].password);
            }
        }
    });
});

//logout
router.post('/logout', function(req, res) {
    req.session.username = '';
    req.session.selectedGroup = '';
    res.end();
});

router.post('/createGroup', function(req, res) {
    User.findOne({groups: req.body.groupName}, function(err, doc) {
        if(err) res.send("Unknown error.");
        if(doc != null) {
            res.send("Gruppenname bereits vorhanden.");
        } else {
            User.update({username: req.session.username}, {$push: {'groups': req.body.groupName} }, function(err, count) {
                if (err) res.send("Unknown error.");
                res.send("Gruppe erfolgreich erstellt.");
            });
        }
    });
});

router.post('/enterGroup', function(req, res) {
    User.findOne({username: req.session.username}, function(err, doc) {
        if(err) res.send("Unknown error.");
        if(doc != null) {
            var alreadyInGroup = false;
            doc.groups.forEach(element => {
                if(element == req.body.groupName) {
                    alreadyInGroup = true;
                }
            });
            if(alreadyInGroup) {
                return res.send("Bereits in der Gruppe");
            }
            console.log(alreadyInGroup);
            // If user not already in group, check if group exists:
            User.findOne({groups: req.body.groupName}, function(err, doc) {
                if(err) res.send("Unknown error.");
                if(doc != null) {
                    User.update({username: req.session.username}, {$push: {'groups': req.body.groupName} }, function(err, count) {
                        if (err) res.send("Unknown error.");
                        res.send("Gruppe erfolgreich beigetreten.");
                    });
                } else {
                    res.send("Gruppe existiert nicht.");
                }
            });
        } else {
            console.log("EnterGroup(): User is null");
            res.send("");
        }
    });
});

router.post('/exitGroup', function(req, res) {
    if(req.session.username != null && req.session.selectedGroup != null) {
        User.update({username: req.session.username}, {$pull: {'groups': req.session.selectedGroup} }, function(err, doc) {
            if(err) res.send("Unknown error.");
            req.session.selectedGroup = "";
            res.send("Gruppe erfolgreich ausgetreten.");
        });
    } else {
        res.send("ExitGroup(): Username null oder keine Gruppe ausgewählt.");
    }
});

router.post('/getGroupsOfUser', function(req, res) {
    User.findOne({username: req.session.username}, function(err, doc) {
        if(err) res.send("Unknown error.");
        if(doc != null) {
            res.send(doc.groups);
        } else {
            console.log("GetGroupsOfUser(): User is null");
            res.send("");
        }
    });
});

router.post('/selectGroup', function(req, res) {
    User.findOne({username: req.session.username, groups: req.body.selectedGroup}, function(err, doc) {
        if(err) res.send("SelectGroup(): Unknown error.");
        if(doc != null) {
            req.session.selectedGroup = req.body.selectedGroup;
            console.log("selectGroup: " + req.body.selectedGroup);
        } else {
            console.log("Select Group: The user " + req.session.username + " is not in group " + req.body.selectedGroup);
        }
        console.log(req.session.selectedGroup);
        res.send("");
    });
});

router.post('/addEvent', function(req, res) {
    if(req.session.username != null && req.session.selectedGroup != null) {
        GroupEvents.findOne({groupName: req.session.selectedGroup}, function(err, doc) {
            if(err) return res.send("Unknown error.");
            if(doc != null && doc != "") {
                GroupEvents.update({groupName: req.session.selectedGroup}, {$push: {'details': {'title': req.body.newEventName, 'created': new Date()}} }, function(err, doc) { 
                    res.send("Neues Event wurde zur Gruppe hinzugefügt.");
                });
            } else {
                var newGroupEvent = new GroupEvents({
                    groupName: req.session.selectedGroup,
                    details: {
                        title: req.body.newEventName,
                        created: new Date()
                    }
                });
                newGroupEvent.save(function (err) {
                    if (err) return res.send("Unknown error.");
                    res.send("Erstes Event der Gruppe wurde angelegt.");
                });
            }
        });
    } else {
        res.send("addEvent(): Username null oder keine Gruppe ausgewählt.");
    }
});

router.post('/saveEvent', function(req, res) {
    if(req.session.username != null && req.session.selectedGroup != null) {
        GroupEvents.update({'details._id': req.body.eventId}, {$set:  {'details.$.date': req.body.newDate}}, function(err, doc) {
            if(err) return res.send("SaveEvent(): Unknown error.");
            res.send("Event wurde aktualisiert.");
        });
    }
});

// saves new title of event in GroupEvents and updates GroupVotings accordingly.
router.post('/saveNewTitle', function(req, res) {
    if(req.session.username != null && req.session.selectedGroup != null) {
        GroupEvents.update({'details._id': req.body.selectedEvent._id}, {$set:  {'details.$.title': req.body.newTitle}}, function(err, doc) {
            if(err) return res.send("SaveNewTitle(): Unknown error.");
            GroupVotings.update({groupName: req.session.selectedGroup, 'events.title': req.body.selectedEvent.title, 'events.created': req.body.selectedEvent.created}, {$set: {'events.$.title': req.body.newTitle} }, function(err, doc) {
                if(err) return res.send("SaveNewTitle()2: Unknown error.");
                res.send("Event wurde aktualisiert.");
            });
        });
    }
});

router.post('/getEventsOfSelectedGroup', function(req, res) {
    if(req.session.username != null && req.session.selectedGroup != null) {
        GroupEvents.findOne({groupName: req.session.selectedGroup}, function(err, doc) {
            if(err) return res.send("Unknown error.");
            if(doc != null && doc != "") {
                doc.details.sort(function(a,b) {
                    if (a.date == null && b.date == null) {return 0;}
                    else if (a.date == null) {return -1;} // events without a date should be displayed on top
                    else if (b.date == null) {return 1;}
                    else if (a.date > b.date) {return 1;}
                    else if (b.date > a.date) {return -1;} 
                    return 0;
                });
                res.send(doc.details);
            } else {
                res.send("");
            }
        });
    } else {
        res.send("getEventsOfSelectedGroup(): Username null oder keine Gruppe ausgewählt.");
    }
});

router.post('/addVoting', function(req, res) {
    if(req.session.username != null && req.session.selectedGroup != null) {
        GroupVotings.findOne({groupName: req.session.selectedGroup}, function(err, doc) {
            if(err) return res.send("AddVoting(): Unknown error." + err);
            if(doc != null && doc != "") {
                var eventExists = false;
                console.log(doc);
                if(doc.events != null) {
                    var titleExists = false;
                    doc.events.forEach(element => {
                        if(element.title == req.body.selectedEvent.title && new Date(element.created).getTime() == new Date(req.body.selectedEvent.created).getTime()) {
                            eventExists = true;
                            if(element.votings != null) {
                                element.votings.forEach(element => {
                                    if(element.title == req.body.newVotingName) {
                                        titleExists = true;
                                    }
                                })
                            }
                        }
                    });
                    if(titleExists) {
                        return res.send("Name der Abstimmung in dieser Veranstaltung bereits vorhanden.");
                    }
                }
                if(eventExists) {
                    GroupVotings.update({groupName: req.session.selectedGroup, 'events.title': req.body.selectedEvent.title, 'events.created': req.body.selectedEvent.created}, {$push: {'events.$.votings': {'title': req.body.newVotingName, 'created': new Date()}} }, function(err, doc) {
                        if(err) return res.send("AddVoting(): " + err);
                        return res.send("Neue Abstimmung wurde zum Event hinzugefügt.");
                    });
                } else {
                    // Should not happen, but anyway:
                    GroupVotings.update({groupName: req.session.selectedGroup}, {$push: {'events': {'title': req.body.selectedEvent.title, 'created': req.body.selectedEvent.created, 'votings': {'title': req.body.newVotingName, 'created': new Date()}}} }, function(err, doc) { 
                        if(err) return res.send("AddVoting(): " + err);
                        return res.send("Erste Abstimmung wurde zum bestehenden Event hinzugefügt.");
                    });
                }
            } else {
                newGroupVoting = new GroupVotings({
                    groupName: req.session.selectedGroup,
                    events: {
                        title: req.body.selectedEvent.title,
                        created: req.body.selectedEvent.created,
                        votings: {
                            title: req.body.newVotingName, 
                            created: new Date()
                        }
                    }
                });
                newGroupVoting.save(function (err) {
                    if (err) return res.send("AddVoting(): " + err);
                    res.send("Erste Abstimmung wurde dem Event hinzugefügt.");
                });
            }
        });
    } else {
        res.send("addVoting(): Username null oder keine Gruppe ausgewählt.");
    }
});

router.post('/getVotingsOfSelectedEvent', function(req, res) {
    if(req.session.username != null && req.session.selectedGroup != null) {
        GroupVotings.findOne({groupName: req.session.selectedGroup}, function(err, doc) {
            if(err) return res.send("AddVoting(): Unknown error." + err);
            if(doc != null && doc != "") {
                if(doc.events != null) {
                    var votings = "";
                    doc.events.forEach(element => {
                        if(element.title == req.body.selectedEvent.title && new Date(element.created).getTime() == new Date(req.body.selectedEvent.created).getTime()) {
                            votings = element.votings;
                        }
                    });
                    return res.send(votings);
                }
            }
            return res.send("");
        });
    } else {
        res.send("getVotingsOfSelectedEvent(): Username null oder keine Gruppe ausgewählt.");
    }
});

router.post('/saveVotingItem', function(req, res) {
    if(req.session.username != null && req.session.selectedGroup != null) {
        GroupVotings.update({'groupName': req.session.selectedGroup}, {$push: {'events.$[i].votings.$[j].choices': {'title': req.body.newVotingItem}} }, {arrayFilters: [{$and: [{'i.title': req.body.selectedEvent.title}, {'i.created': new Date(req.body.selectedEvent.created)}]}, {'j.title': req.body.selectedVoting.title}]}, function(err, doc) {
            if(err) return res.send("SaveVotingItem(): " + err);
            return res.send("Neue Abstimmungsmöglichkeit wurde zur Abstimmung hinzugefügt.");
        });
    } else {
        res.send("saveVotingItem(): Username null oder keine Gruppe ausgewählt.");
    }
});

router.post('/removeVotingItem', function(req, res) {
    if(req.session.username != null && req.session.selectedGroup != null) {
        GroupVotings.update({'groupName': req.session.selectedGroup}, {$pull: {'events.$[i].votings.$[j].choices': {'title': req.body.votingItem}} }, {arrayFilters: [{$and: [{'i.title': req.body.selectedEvent.title}, {'i.created': new Date(req.body.selectedEvent.created)}]}, {'j.title': req.body.selectedVoting.title}]}, function(err, doc) {
            if(err) return res.send("RemoveVotingItem(): " + err);
            return res.send("Abstimmungsmöglichkeit wurde von der Abstimmung entfernt.");
        });
    } else {
        res.send("RemoveVotingItem(): Username null oder keine Gruppe ausgewählt.");
    }
});

router.post('/saveCheckedChoice', function(req, res) {
    if(req.session.username != null && req.session.selectedGroup != null) {
        // remove previous choice from all subdocuments (should only be there once actually):
        GroupVotings.update({'groupName': req.session.selectedGroup}, {$pull: {'events.$[i].votings.$[j].choices.$[].users': req.session.username} }, {arrayFilters: [{$and: [{'i.title': req.body.selectedEvent.title}, {'i.created': new Date(req.body.selectedEvent.created)}]}, {'j.title': req.body.selectedVoting.title}]}, function(err, doc) {
            if(err) return res.send({"object": "","message": "saveCheckedChoice(): " + err});
            // add current choice:
            GroupVotings.findOneAndUpdate({'groupName': req.session.selectedGroup}, {$push: {'events.$[i].votings.$[j].choices.$[k].users': req.session.username} }, {arrayFilters: [{$and: [{'i.title': req.body.selectedEvent.title}, {'i.created': new Date(req.body.selectedEvent.created)}]}, {'j.title': req.body.selectedVoting.title}, {'k.title': req.body.votingItem}], "new": true}, function(err, doc) {
                if(err) return res.send({"object": "", "message": "saveCheckedChoice(): " + err});
                // update the result field of the updated voting:
                var newResult = "";
                var highestNumber = 0;
                doc.events.forEach(event => {
                    if(event.title == req.body.selectedEvent.title && new Date(event.created).getTime() == new Date(req.body.selectedEvent.created).getTime()) {
                        event.votings.forEach(voting => {
                            if(voting.title === req.body.selectedVoting.title) {
                                highestNumber = 0;
                                voting.choices.forEach(choice => {
                                    if(choice.users.length > highestNumber) {
                                        highestNumber = choice.users.length;
                                        newResult = choice.title;
                                    }
                                })
                            }
                        });
                    }
                });
                if(newResult != "") {
                    GroupVotings.findOneAndUpdate({'groupName': req.session.selectedGroup}, {$set: {'events.$[i].votings.$[j].result': {"title": newResult,"quantity": highestNumber}} }, {arrayFilters: [{$and: [{'i.title': req.body.selectedEvent.title}, {'i.created': new Date(req.body.selectedEvent.created)}]}, {'j.title': req.body.selectedVoting.title}], "new": true}, function(err, doc) {
                        if(err) return res.send({"object": "", "message": "saveCheckedChoice(): " + err});
                        res.send({"object": doc, "message": req.body.votingItem + " wurde ausgewählt. Abstimmungsergebnis wurde aktualisiert."});
                    });
                } else {
                    res.send({"object": "", "message": req.body.votingItem + " wurde ausgewählt. Aber Abstimmungsergebnis konnte nicht ermittelt werden."});
                }
            });
        });
    } else {
        res.send("saveCheckedChoice(): Username null oder keine Gruppe ausgewählt.");
    }
});


// chat:

router.post('/saveMessage', function(req, res) {
    if(req.session.username != null && req.session.selectedGroup != null) {
        Chat.findOne({groupName: req.session.selectedGroup}, function(err, doc) {
            if(err) res.send("saveMessage(): Unknown error.");
            if(doc != null && doc != "") {
                Chat.findOneAndUpdate({'groupName': req.session.selectedGroup}, {$push: {messages: req.body.newMessage}}, function(err, doc) {
                    if(err) return res.send("saveMessage()2: Unknown error.")
                    return res.send("");
                });
            } else {
                var chat = new Chat({
                    groupName: req.session.selectedGroup,
                    messages: req.body.newMessage
                });
                chat.save(function (err) {
                    if (err) return res.send("saveMessage()3: Unknown error.");
                    return res.send("");
                });
            }
        });
    } else {
        res.send("saveMessage(): Username null oder keine Gruppe ausgewählt.");
    }
});

router.post('/loadMessages', function(req, res) {
    if(req.session.username != null && req.session.selectedGroup != null) {
        Chat.findOne({groupName: req.session.selectedGroup}, function(err, doc) {
            if(err) res.send({"doc": "", "message":"loadMessages(): Unknown error."});
            if(doc != null && doc != "") {
                res.send({"doc": doc, "message": ""});
            } else {
                res.send({"doc": "", "message":""});
            }
        });
    } else {
        res.send({"doc": "", "message":"loadMessages(): Username null oder keine Gruppe ausgewählt."});
    }

});


//socket:

router.post('/getUserId', function(req, res) {
    if(req.session.username != null && req.session.selectedGroup != null) {
        User.findOne({username: req.session.username}, function(err, doc) {
            if(err) return res.send("0");
            if(doc != null && doc != "") {
                res.send(doc._id);
            } else {
                res.send("0");
            }
        });
    } else {
        res.send("0");
    }
});


module.exports = router;
