var express = require('express');
var passwordHash = require('password-hash');

var router = express.Router();

var db = require('./repository.js');
var User = db.User;
var GroupEvents = db.GroupEvents;
var GroupVotings = db.GroupVotings;
var Chat = db.Chat;

function checkIfSessionNotNull(req) {
    if(req.session.username != null && req.session.username != '') {
        return true;
    } else {
        return false;
    }
}

function checkIfSessionAndGroupNotNull(req) {
    if(req.session.username != null && req.session.selectedGroup != null && req.session.selectedGroup.title != null) {
        return true;
    } else {
        return false;
    }
}
    
// middleware specific to this router
// authentication, logging, etc.
router.use(function(req, res, next) {
  console.log('API access: ', new Date() );
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
    res.send([req.session.username, req.session.selectedGroup, req.session.selectedEvent]);
});

//Create new user
router.post('/user', function(req, res) {
    var newUser = new User({
        email: req.body.email,
        username: req.body.username,
        password: passwordHash.generate(req.body.password)
    });

    User.find({username: newUser.username}, function(err, docs) {
        if(docs == "") {
            User.find({email: newUser.email}, function(err, docs) {
                if(docs == "") {
                    newUser.save(function (err, newUser) {
                        if (err) return console.error(err);
                        console.log("saved: " + newUser.username);
                        res.send(newUser.username);
                    });
                } else {
                    res.send("Email bereits vorhanden.");
                }
            });
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
            if(docs[0].password != null && passwordHash.verify(req.body.password, docs[0].password)) {
                req.session.username = docs[0].username;
                req.session.selectedGroup = {title: "", status: 0};
                res.sendStatus(200);
            } else {
                res.send("Passwort falsch.");
            }
        }
    });
});

//logout
router.post('/logout', function(req, res) {
    req.session.username = '';
    req.session.selectedGroup = '';
    req.session.selectedEvent = null;
    res.end();
});

router.post('/createGroup', function(req, res) {
    User.findOne({'groups.title': req.body.groupName}, function(err, doc) {
        if(err) res.send("Unknown error.");
        if(doc != null) {
            res.send("Gruppenname bereits vorhanden.");
        } else {
            User.update({username: req.session.username}, {$push: {'groups': {'title': req.body.groupName, 'status': 0}} }, function(err, count) {
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
                if(element.title == req.body.groupName) {
                    alreadyInGroup = true;
                }
            });
            if(alreadyInGroup) {
                return res.send("Du bist bereits in dieser Gruppe oder hast eine Beitrittsanfrage versendet.");
            }
            console.log(alreadyInGroup);
            // If user not already in group, check if group exists:
            User.findOne({'groups.title': req.body.groupName, 'groups.status': 0}, function(err, doc) {
                if(err) return res.send(err.message);
                if(doc != null) {
                    /*User.update({username: req.session.username}, {$push: {'groups': {'title': req.body.groupName, 'status': 1}} }, function(err, count) {
                        if (err) return res.send(err.message);
                        res.send("Gruppe erfolgreich beigetreten.");
                    });*/
                    User.update({'username': doc.username}, {$push: {'messages': {$each: [{'messageType': db.MessageType.MEMBER_NEW, 'groupName': req.body.groupName, 'content': req.session.username, 'created': new Date()}], $position: 0}} }, function(err, count) {
                        if (err) return res.send(err.message);
                        User.update({username: req.session.username}, {$push: {'groups': {'title': req.body.groupName, 'status': 2}} }, function(err, count) {
                            if (err) return res.send(err.message);
                            res.send({'userId': doc._id, 'resultMessage': "Beitrittsanfrage gestellt."});
                        });
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
    if(checkIfSessionAndGroupNotNull(req)) {
        User.update({username: req.session.username}, {$pull: {'groups': {'title': req.session.selectedGroup.title}} }, function(err, doc) {
            if(err) res.send("Unknown error.");
            req.session.selectedGroup = "";
            // TODO: Delete Events, Votings etc. if user is admin
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
            var groups = [];
            if(doc.groups != null) {
                doc.groups.forEach(group => {
                    if(group.status <= 1) {
                        groups.push(group);
                    }
                });
            }
            res.send(groups);
        } else {
            console.log("GetGroupsOfUser(): User is null");
            res.send("");
        }
    });
});

router.post('/selectGroup', function(req, res) {
    req.session.selectedEvent = null;
    if(req.body.selectedGroup.title === "") {
        req.session.selectedGroup = {title: "", status: 0};
        res.send("");
    } else {
        User.findOne({username: req.session.username, 'groups.title': req.body.selectedGroup.title}, function(err, doc) {
            if(err) res.send("SelectGroup(): Unknown error.");
            if(doc != null) {
                req.session.selectedGroup = req.body.selectedGroup;
            } else {
                console.log("Select Group: The user " + req.session.username + " is not in group " + req.body.selectedGroup);
            }
            console.log(req.session.selectedGroup);
            res.send("");
        });
    }
});

router.post('/selectEvent', function(req, res) {
    if(req.session.selectedGroup.title != "") {
        req.session.selectedEvent = req.body.selectedEvent;
        res.send("");
    } else {
        User.findOne({username: req.session.username, 'events.title': req.body.selectedEvent.title}, function(err, doc) {
            if(err) res.send("SelectEvent(): Unknown error.");
            if(doc != null) {
                req.session.selectedEvent = req.body.selectedEvent;
            } else {
                console.log("Select Event: The user " + req.session.username + " is not in event " + req.body.selectedEvent);
            }
            res.send("");
        });
    }
});

router.post('/unselectEvent', function(req,res) {
    req.session.selectedEvent = null;
    res.send("");
});

router.post('/addEvent', function(req, res) {
    if(checkIfSessionNotNull(req)) {
        if(req.session.selectedGroup.title != "") {
            GroupEvents.findOne({groupName: req.session.selectedGroup.title}, function(err, doc) {
                if(err) return res.send("Unknown error.");
                if(doc != null && doc != "") {
                    GroupEvents.update({groupName: req.session.selectedGroup.title}, {$push: {'details': {'title': req.body.newEventName, 'created': new Date()}} }, function(err, doc) { 
                        res.send("Neues Event wurde zur Gruppe hinzugefügt.");
                    });
                } else {
                    var newGroupEvent = new GroupEvents({
                        groupName: req.session.selectedGroup.title,
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
            GroupEvents.findOne({groupName: "", 'details.title': req.body.newEventName}, function(err, doc) {
                if(err) return res.send("Unknown error.");
                if(doc != null && doc != "") {
                    res.send("Eventname bereits vergeben.");
                } else {
                    User.update({username: req.session.username}, {$push: {'events': {'title': req.body.newEventName, 'status': 0}} }, function(err, count) {
                        if (err) res.send("Unknown error.");
                        GroupEvents.findOne({groupName: ''}, function(err, doc) {
                            if(err) return res.send("Unknown error.");
                            if(doc != null && doc != "") {
                                GroupEvents.update({groupName: ''}, {$push: {'details': {'title': req.body.newEventName, 'created': new Date()}} }, function(err, doc) { 
                                    res.send("Neues Event ohne Gruppe wurde hinzugefügt.");
                                });
                            } else {
                                var newGroupEvent = new GroupEvents({
                                    groupName: '',
                                    details: {
                                        title: req.body.newEventName,
                                        created: new Date()
                                    }
                                });
                                newGroupEvent.save(function (err) {
                                    if (err) return res.send("Unknown error.");
                                    res.send("Erstes Event ohne Gruppe wurde angelegt.");
                                });
                            }
                        });
                    });
                }
            });
        }
        
    } else {
        res.send("addEvent(): Username null oder keine Gruppe ausgewählt.");
    }
});

router.post('/saveEvent', function(req, res) {
    if(checkIfSessionNotNull(req)) {
        GroupEvents.update({'details._id': req.body.eventId}, {$set:  {'details.$.date': req.body.newDate}}, function(err, doc) {
            if(err) return res.send("SaveEvent(): Unknown error.");
            res.send("Event wurde aktualisiert.");
        });
    }
});

// saves new title of event in GroupEvents and updates GroupVotings accordingly.
router.post('/saveNewTitle', function(req, res) {
    if(checkIfSessionNotNull(req)) {
        GroupEvents.update({'details._id': req.body.selectedEvent._id}, {$set:  {'details.$.title': req.body.newTitle}}, function(err, doc) {
            if(err) return res.send("SaveNewTitle(): " + err);
            GroupVotings.update({groupName: req.session.selectedGroup.title, 'events.title': req.body.selectedEvent.title, 'events.created': req.body.selectedEvent.created}, {$set: {'events.$.title': req.body.newTitle} }, function(err, doc) {
                if(err) return res.send("SaveNewTitle()2: " + err);
                User.update({'events.title': req.body.selectedEvent.title}, {$set: {'events.$.title': req.body.newTitle} }, function(err, doc) {
                    if(err) return res.send("SaveNewTitle()3: " + err);
                    res.send("Event wurde aktualisiert.");
                });
            });
        });
    }
});

router.post('/getEventsOfSelectedGroup', function(req, res) {
    if(checkIfSessionAndGroupNotNull(req)) {
        GroupEvents.findOne({groupName: req.session.selectedGroup.title}, function(err, doc) {
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

router.post('/getEventsOfUser', function(req, res) {
    if(checkIfSessionNotNull(req)) {
        GroupEvents.findOne({groupName: ''}, function(err, eventDoc) {
            if(err) return res.send("Unknown error.");
            if(eventDoc != null && eventDoc != "") {
                User.findOne({username: req.session.username}, function(err, doc) {
                    if(err) return res.send("Unknown error.");
                    if(doc != null && doc != "") {
                        var userEvents = [];
                        let i = 0; const iMax = eventDoc.details.length; 
                        for(; i < iMax; i++) {
                            doc.events.forEach(event => {
                                if(eventDoc.details[i].title === event.title) {
                                    userEvents.push(eventDoc.details[i]);
                                }
                            });
                        }
                        userEvents.sort(function(a,b) {
                            if (a.date == null && b.date == null) {return 0;}
                            else if (a.date == null) {return -1;} // events without a date should be displayed on top
                            else if (b.date == null) {return 1;}
                            else if (a.date > b.date) {return 1;}
                            else if (b.date > a.date) {return -1;} 
                            return 0;
                        });
                        res.send(userEvents);
                    }
                });
            } else {
                res.send("");
            }
        });
    } else {
        res.send("getEventsOfSelectedGroup(): Username null oder keine Gruppe ausgewählt.");
    }
});

router.post('/handleJoin', function(req, res) {
    if(checkIfSessionNotNull(req)) {
        var join = req.body.join;
        if(join.includes('join/event/')) {
            var joinId = join.split('join/event/')[1];
        } else if (req.session.joinEvent != undefined && req.session.joinEvent.includes('join/event/')) {
            var joinId = req.session.joinEvent.split('join/event/')[1];
        } else {
            if(join == '') {
                return res.send("");
            } else {
                return res.send(join + " entspricht keinem validen URL-Format.");
            }
        }
        req.session.joinEvent = null;
        if(joinId != '') {
            if(joinId.includes('/')) {
                joinId = joinId.split('/')[0];
            }
            if(joinId != '') {
                GroupEvents.find({groupName:''},{details: {$elemMatch: {_id: joinId}}}, function(err, doc) {
                    if(err) return res.send("handleJoin(): " + err);
                    if(doc != null) {
                        var eventTitle = doc[0].details[0].title;
                        User.findOne({username:req.session.username}, function(err, user) {
                            if(err) return res.send("handleJoin(): " + err);
                            if(user.events != null) {
                                var isIn = false;
                                user.events.forEach(event => {
                                    if(event.title === eventTitle) {
                                        isIn = true;
                                    }
                                });
                                if(isIn) {
                                    res.send("Du bist bereits in dem Event '" + eventTitle + "'");
                                } else {
                                    User.update({username:req.session.username}, {$push: {events: {title: eventTitle, status: 1}} }, function(err) {
                                        if(err) return res.send("handleJoin(): " + err);
                                        res.send("Dem Event '" + eventTitle + "' wurde beigetreten.");
                                    });
                                }
                            } else {
                                User.update({username:req.session.username}, {$push: {events: {title: eventTitle, status: 1}} }, function(err) {
                                    if(err) return res.send("handleJoin(): " + err);
                                    res.send("Dem Event '" + eventTitle + "' wurde beigetreten.");
                                });     
                            }
                        });
                    } else {
                        res.send(joinId + " ist nicht vorhanden.");
                    }
                });
            } else {
                res.send(joinId + " ist nicht vorhanden.");
            }    
        } else {
            res.send(joinId + " ist nicht vorhanden.");
        }
    } else {
        if(req.session.joinEvent == undefined || req.session.joinEvent == '') {
            req.session.joinEvent = req.body.join;
        }
        res.send("Nicht eingeloggt.");
    }
});


// voting:

router.post('/addVoting', function(req, res) {
    if(checkIfSessionNotNull(req)) {
        GroupVotings.findOne({groupName: req.session.selectedGroup.title}, function(err, doc) {
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
                    GroupVotings.update({groupName: req.session.selectedGroup.title, 'events.title': req.body.selectedEvent.title, 'events.created': req.body.selectedEvent.created}, {$push: {'events.$.votings': {'title': req.body.newVotingName, 'created': new Date()}} }, function(err, doc) {
                        if(err) return res.send("AddVoting(): " + err);
                        res.send("Neue Abstimmung wurde zum Event hinzugefügt.");
                        updateUserMessageOfGroupOrEvent(req.session.username, req.session.selectedGroup, req.body.selectedEvent, req.body.newVotingName, db.MessageType.VOTING_NEW);
                    });
                } else {
                    // Should not happen, but anyway:
                    GroupVotings.update({groupName: req.session.selectedGroup.title}, {$push: {'events': {'title': req.body.selectedEvent.title, 'created': req.body.selectedEvent.created, 'votings': {'title': req.body.newVotingName, 'created': new Date()}}} }, function(err, doc) { 
                        if(err) return res.send("AddVoting(): " + err);
                        res.send("Erste Abstimmung wurde zum bestehenden Event hinzugefügt.");
                        updateUserMessageOfGroupOrEvent(req.session.username, req.session.selectedGroup, req.body.selectedEvent, req.body.newVotingName, db.MessageType.VOTING_NEW);
                    });
                }
            } else {
                newGroupVoting = new GroupVotings({
                    groupName: req.session.selectedGroup.title,
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
                    updateUserMessageOfGroupOrEvent(req.session.username, req.session.selectedGroup, req.body.selectedEvent, req.body.newVotingName, db.MessageType.VOTING_NEW);
                });
            }
        });
    } else {
        res.send("addVoting(): Username null oder keine Gruppe ausgewählt.");
    }
});

router.post('/getVotingsOfSelectedEvent', function(req, res) {
    if(checkIfSessionNotNull(req)) {
        GroupVotings.findOne({groupName: req.session.selectedGroup.title}, function(err, doc) {
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
    if(checkIfSessionNotNull(req)) {
        GroupVotings.update({'groupName': req.session.selectedGroup.title}, {$push: {'events.$[i].votings.$[j].choices': {'title': req.body.newVotingItem}} }, {arrayFilters: [{$and: [{'i.title': req.body.selectedEvent.title}, {'i.created': new Date(req.body.selectedEvent.created)}]}, {'j.title': req.body.selectedVoting.title}]}, function(err, doc) {
            if(err) return res.send("SaveVotingItem(): " + err);
            return res.send("Neue Abstimmungsmöglichkeit wurde zur Abstimmung hinzugefügt.");
        });
    } else {
        res.send("saveVotingItem(): Username null oder keine Gruppe ausgewählt.");
    }
});

router.post('/removeVotingItem', function(req, res) {
    if(checkIfSessionNotNull(req)) {
        GroupVotings.update({'groupName': req.session.selectedGroup.title}, {$pull: {'events.$[i].votings.$[j].choices': {'title': req.body.votingItem}} }, {arrayFilters: [{$and: [{'i.title': req.body.selectedEvent.title}, {'i.created': new Date(req.body.selectedEvent.created)}]}, {'j.title': req.body.selectedVoting.title}]}, function(err, doc) {
            if(err) return res.send("RemoveVotingItem(): " + err);
            return res.send("Abstimmungsmöglichkeit wurde von der Abstimmung entfernt.");
        });
    } else {
        res.send("RemoveVotingItem(): Username null oder keine Gruppe ausgewählt.");
    }
});

router.post('/saveCheckedChoice', function(req, res) {
    if(checkIfSessionNotNull(req)) {
        // remove previous choice from all subdocuments (should only be there once actually):
        GroupVotings.update({'groupName': req.session.selectedGroup.title}, {$pull: {'events.$[i].votings.$[j].choices.$[].users': req.session.username} }, {arrayFilters: [{$and: [{'i.title': req.body.selectedEvent.title}, {'i.created': new Date(req.body.selectedEvent.created)}]}, {'j.title': req.body.selectedVoting.title}]}, function(err, doc) {
            if(err) return res.send({"object": "","message": "saveCheckedChoice(): " + err});
            // add current choice:
            GroupVotings.findOneAndUpdate({'groupName': req.session.selectedGroup.title}, {$push: {'events.$[i].votings.$[j].choices.$[k].users': req.session.username} }, {arrayFilters: [{$and: [{'i.title': req.body.selectedEvent.title}, {'i.created': new Date(req.body.selectedEvent.created)}]}, {'j.title': req.body.selectedVoting.title}, {'k.title': req.body.votingItem}], "new": true}, function(err, doc) {
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
                    GroupVotings.findOneAndUpdate({'groupName': req.session.selectedGroup.title}, {$set: {'events.$[i].votings.$[j].result': {"title": newResult,"quantity": highestNumber}} }, {arrayFilters: [{$and: [{'i.title': req.body.selectedEvent.title}, {'i.created': new Date(req.body.selectedEvent.created)}]}, {'j.title': req.body.selectedVoting.title}], "new": true}, function(err, doc) {
                        if(err) return res.send({"object": "", "message": "saveCheckedChoice(): " + err});
                        if(req.body.selectedVoting.result == null || req.body.selectedVoting.result.title != newResult) {
                            res.send({"object": doc, "message": req.body.votingItem + " wurde ausgewählt. Abstimmungsergebnis wurde aktualisiert."});
                            updateUserMessageOfGroupOrEvent(req.session.username, req.session.selectedGroup, req.body.selectedEvent, req.body.selectedVoting.title, db.MessageType.VOTING_UPDATE);
                        } else {
                            res.send({"object": doc, "message": req.body.votingItem + " wurde ausgewählt. Abstimmungsergebnis hat sich nicht geändert."});
                        }
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

function updateUserMessageOfGroupOrEvent(username, selectedGroup, selectedEvent, votingName, messageType) {
    if(selectedGroup == null || selectedGroup.title === '') {
        User.find({'events.title': selectedEvent.title}, function(err, docs) {
            if(err) console.log("saveCheckedChoice(): " + err);
            if(docs != null && docs.length > 0) {
                docs.forEach(userInEvent => {
                    if(userInEvent.username != username) {
                        updateUserMessage(userInEvent.username, messageType, selectedGroup.title, selectedEvent.title, votingName, username);
                    }
                });
            } else {
                console.log("No users found for event: " + selectedEvent.title);
            }
        });
    } else {
        User.find({'groups.title': selectedGroup.title}, function(err, docs) {
            if(err) console.log("saveCheckedChoice(): " + err);
            if(docs != null && docs.length > 0) {
                docs.forEach(userInGroup => {
                    if(userInEvent.username != username) {
                        updateUserMessage(userInGroup.username, messageType, selectedGroup.title, selectedEvent.title, votingName, username);
                    }
                });
            } else {
                console.log("No users found for group: " + selectedGroup.title);
            }
        });
    } 
}

function updateUserMessage(username, messageType, groupName, eventName, votingName, content) {
    User.update({'username': username}, {$push: {'messages': {$each: [{'messageType': messageType, 'groupName': groupName, 'eventName': eventName, 'votingName': votingName, 'content': content, 'created': new Date()}], $position: 0}} }, function(err) {
        if (err) console.log("updateUserMessage: " + err);
        console.log(username + " updated.");
    });
}

// chat:

router.post('/saveMessage', function(req, res) {
    if(checkIfSessionNotNull(req)) {
        if(req.session.selectedGroup.title != '') {
            Chat.findOne({groupName: req.session.selectedGroup.title}, function(err, doc) {
                if(err) res.send("saveMessage(): Unknown error.");
                if(doc != null && doc != "") {
                    Chat.findOneAndUpdate({'groupName': req.session.selectedGroup.title}, {$push: {messages: req.body.newMessage}}, function(err, doc) {
                        if(err) return res.send("saveMessage()2: Unknown error.")
                        return res.send("");
                    });
                } else {
                    var chat = new Chat({
                        groupName: req.session.selectedGroup.title,
                        messages: req.body.newMessage
                    });
                    chat.save(function (err) {
                        if (err) return res.send("saveMessage()3: Unknown error.");
                        return res.send("");
                    });
                }
            });
        } else if (req.session.selectedEvent.title != '') {
            Chat.findOne({eventName: req.session.selectedEvent.title}, function(err, doc) {
                if(err) res.send("saveMessage()2.1: Unknown error.");
                if(doc != null && doc != "") {
                    Chat.findOneAndUpdate({'eventName': req.session.selectedEvent.title}, {$push: {messages: req.body.newMessage}}, function(err, doc) {
                        if(err) return res.send("saveMessage()2.2: Unknown error.")
                        return res.send("");
                    });
                } else {
                    var chat = new Chat({
                        eventName: req.session.selectedEvent.title,
                        messages: req.body.newMessage
                    });
                    chat.save(function (err) {
                        if (err) return res.send("saveMessage()2.3: Unknown error.");
                        return res.send("");
                    });
                }
            });
        } else {
            res.send("saveMessage(): Username null oder keine Gruppe/Event ausgewählt.");
        }
    } else {
        res.send("saveMessage(): Username null oder keine Gruppe ausgewählt.");
    }
});

router.post('/loadMessages', function(req, res) {
    if(checkIfSessionNotNull(req)) {
        if(req.session.selectedGroup.title != '') {
            Chat.findOne({groupName: req.session.selectedGroup.title}, function(err, doc) {
                if(err) res.send({"doc": "", "message":"loadMessages(): Unknown error."});
                if(doc != null && doc != "") {
                    res.send({"doc": doc, "message": ""});
                } else {
                    res.send({"doc": "", "message":""});
                }
            });
        } else if (req.session.selectedEvent != null && req.session.selectedEvent.title != '') {
            Chat.findOne({eventName: req.session.selectedEvent.title}, function(err, doc) {
                if(err) res.send({"doc": "", "message":"loadMessages(): Unknown error."});
                if(doc != null && doc != "") {
                    res.send({"doc": doc, "message": ""});
                } else {
                    res.send({"doc": "", "message":""});
                }
            });
        } else {
            res.send({"doc": "", "message":"loadMessages(): Group oder Event null."});

        }
    } else {
        res.send({"doc": "", "message":""});
    }

});


//socket:

router.post('/getUserId', function(req, res) {
    if(checkIfSessionNotNull(req)) {
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


// user messages:

router.post('/getUserMessages', function(req, res) {
    if(checkIfSessionNotNull(req)) {
        User.findOne({username: req.session.username}, function(err, doc) {
            if(err) res.send(err.message);
            if(doc != null) {
                res.send(doc.messages);
            } else {
                console.log("getUserMessages(): User is null");
                res.send("");
            }
        });
    }
});

router.post('/acceptUser', function(req, res) {
    if(checkIfSessionNotNull(req)) {
        User.findOneAndUpdate({'username': req.body.user, 'groups.title': req.body.groupName}, {$set: {'groups.$.status': 1}}, function(err, doc) {
            if (err) return res.send(err.message);
            User.findOneAndUpdate({'username': req.session.username}, {$pull: {'messages': {'_id': req.body.messageId}} },function(err, doc) {
                if (err) return res.send(err.message);
                res.send("Akzeptiert.")
            });
        });
    }
});

router.post('/refuseUser', function(req, res) {
    if(checkIfSessionNotNull(req)) {
        User.findOneAndUpdate({'username': req.body.user}, {$pull: {'groups': {'title': req.body.groupName}}}, function(err, doc) {
            if (err) return res.send(err.message);
            User.findOneAndUpdate({'username': req.session.username}, {$pull: {'messages': {'_id': req.body.messageId}} },function(err, doc) {
                if (err) return res.send(err.message);
                res.send("Abgelehnt.")
            });
        });
    }
});

module.exports = router;
