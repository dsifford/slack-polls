var express     = require('express'),
    bodyParser  = require('body-parser'),
    request     = require("request"),
    MongoClient = require('mongodb').MongoClient,
    assert      = require('assert'),
    app         = express();

// TESTING VARIABLES
var PORT = 3000;

// Include the bodyParser Middleman + allow x-url-encoding
// to be extended to the body of the request
app.use(bodyParser.urlencoded({ extended: true }));


/**
 * Global MongoDB URI
 * @type {String}
 */
var MONGODB_URI = 'mongodb://localhost:27017/slackpolls';
var db;


////////////////////////
// Connect to MongoDB //
////////////////////////

MongoClient.connect(MONGODB_URI, function(err, database) {
    assert.equal(err, null);
    console.log("Connected correctly to server");

    db = database;

    app.listen(process.env.PORT || PORT);
    console.log('App listening on http://localhost/%s', PORT);
});

///////////////////////////////
// POST Route for index path //
///////////////////////////////

app.post('/', function(req, res, next) {
    console.log("POST request received at '/'.");

    // Collect request and set variables
    var input = {
        name: req.body.user_name,
        domain: req.body.team_domain,
        pollMethod: req.body.text.match(/\S*/)[0].toLowerCase(),
        pollParams: function() { return req.body.text.substr(input.pollMethod.length).trim(); },
        channelId: req.body.channel_id
    };

    // Set output options TODO: Setup /poll {setup} to save token in database
    var options = {
        method: 'POST',
        url: 'https://' + input.domain + '.slack.com/services/hooks/slackbot',
        qs: { token: '80Q9s54PMHVjOXgJE1CKlzVf', channel: input.channelId },
        body: ''
    };

    //////////////////
    // Output logic //
    //////////////////

    if (input.pollMethod == 'new') {
        removePoll(input);
        newPoll(input);
    } else if (input.pollMethod == 'vote') {
        // Run 'vote' handler
    } else if (input.pollMethod == 'help') {
        renderGraphic(input);
    } else if (input.pollMethod == 'results') {
        // Run 'results' handler
    }

    console.log('> Ending Response...');
    res.end();

});


///////////////////////////////////////////////////////////
// --------------------- FUNCTIONS --------------------- //
///////////////////////////////////////////////////////////

    // Handler functions for /poll {new}
    var removePoll = function(input) {
        db.collection(input.channelId).drop(function(err, response) {
            console.log(response);
        });
    };

    var newPoll = function(input) {

        db.collection(input.channelId).insertOne( {
            "title" : "NEW POLL INSERTED! YAYYY!!!!",
            "answers" : {
                "A" : {
                    "choice" : "This is choice A",
                    "score" : 0
                },
                "B" : {
                    "choice" : "This is choice B",
                    "score" : 0
                },
                "C" : {
                    "choice" : "This is choice C",
                    "score" : 0
                },
                "D" : {
                    "choice" : "This is choice A",
                    "score" : 0
                }
            }
        }, function(err, result) {
            assert.equal(err, null);
            console.log("Created a new collection and instantiated a new poll.");
        });
    };

    // Handler function for /poll {vote}
    // TODO:

    // Handler function for /poll {help}
    // TODO:

    // Handler function for /poll {results}
    // TODO: Finish function that renders the graphic


    var renderGraphic = function(input) {
        
        // TODO: THIS IS THE WORKING CALLBACK TO RETRIEVE 'A' SCORE
        var test = db.collection(input.channelId).find({}, {"answers.A.score": 1, _id:0}).limit(1).toArray(function(err, data) {
            console.log(data[0].answers.A.score);
        });


        // May need special rendering for unicode characters
        /*
        var renderGraph = function() {
            var graph = {
                A : [
                    ['├'],
                    ['┬'.repeat()]
                ]
            };
        };
        */

    };
