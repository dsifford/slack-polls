var express     = require('express'),
    bodyParser  = require('body-parser'),
    request     = require("request"),
    MongoClient = require('mongodb').MongoClient,
    assert      = require('assert'),
    async       = require('async'),
    app         = express();

// TESTING VARIABLES
var PORT = 3000;

/**
 * TODO...
 * 1) Add check so users can only vote once (or so that they can re-vote)
 * 2) /poll {setup} function to save Slackbot Token to MongoDB
 * 3) Handler function for /poll {help}
 * 4) Move functions to external file for cleaner index
 */


// Include the bodyParser Middleman + allow x-url-encoding
// to be extended to the body of the request
app.use(bodyParser.urlencoded({ extended: true }));


/**
 * Global MongoDB URI
 * @type {String}
 */
var MONGODB_URI = 'mongodb://localhost:27017/slackpolls';

/** GLOBALS **/
var db,
    input,
    options;


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
    input = {
        name: req.body.user_name,
        domain: req.body.team_domain,
        userId: req.body.user_id,
        pollMethod: req.body.text.match(/\S*/)[0].toLowerCase(),
        pollParams: function() { return req.body.text.substr(input.pollMethod.length).trim(); },
        channelId: req.body.channel_id
    };

    // Set output options
    options = {
        method: 'POST',
        url: 'https://' + input.domain + '.slack.com/services/hooks/slackbot',
        qs: { token: '80Q9s54PMHVjOXgJE1CKlzVf', channel: input.channelId },
        body: ''
    };

    //////////////////
    // Output logic //
    //////////////////

    if (input.pollMethod == 'new') {
        removePoll();
        newPoll();
    } else if (input.pollMethod == 'vote') {
        castVote();
    } else if (input.pollMethod == 'help') {
        // Run 'help' handler
    } else if (input.pollMethod == 'results') {
        // Run 'results' handler
        getScores();
    }

    res.end();

});


///////////////////////////////////////////////////////////
// --------------------- FUNCTIONS --------------------- //
///////////////////////////////////////////////////////////


    // Handler functions for /poll {new}
    // TODO: Merge 'removePoll' and newPoll into a single async function
        var removePoll = function() {
            db.collection(input.channelId).drop(function(err, response) {
                console.log(response);
            });
        };

        var newPoll = function() {

            var pollOptions = [];
            input.pollParams().split('"').forEach(function(param) {
                if (param !== '' && param !== ' ' ) {
                    pollOptions.push(param);
                    console.log(pollOptions);
                }
            });

            db.collection(input.channelId).insertOne( {
                "title" : pollOptions[0],
                "answers" : {
                    "A" : {
                        "choice" : pollOptions[1],
                        "score" : 0
                    },
                    "B" : {
                        "choice" : typeof pollOptions[2] === 'undefined' ? '' : pollOptions[2],
                        "score" : 0
                    },
                    "C" : {
                        "choice" : typeof pollOptions[3] === 'undefined' ? '' : pollOptions[3],
                        "score" : 0
                    },
                    "D" : {
                        "choice" : typeof pollOptions[4] === 'undefined' ? '' : pollOptions[4],
                        "score" : 0
                    }
                },
                "voters" : {} // Format { UserId : 'Letter'}
            }, function(err, result) {
                assert.equal(err, null);
                console.log("Created a new collection and instantiated a new poll.");

                options.body += 'New poll created successfully!\n\n*' +
                                pollOptions[0] + '*\n>>>*A.* ' + pollOptions[1] + '\n' +
                                (typeof pollOptions[2] === 'undefined' ? '' : ('*B.* ' + pollOptions[2] + '\n')) +
                                (typeof pollOptions[3] === 'undefined' ? '' : ('*C.* ' + pollOptions[3] + '\n')) +
                                (typeof pollOptions[4] === 'undefined' ? '' : ('*D.* ' + pollOptions[4]));

                request(options, function (error, response, body) {
                  if (error) throw new Error(error);
                  console.log(body);
                });
            });
        };




    // Handler function for /poll {vote}

        function castVote() {

            var holder;
            var vote;
// TODO Updated "voters" to an object -- need to go through this entire function and fix.
            async.series([
                function checkVoteStatus(callback) {
                    db.collection(input.channelId).find({}, {"voters": 1, _id:0}).toArray(function(err, data) {
                        assert.equal(err, null);
                        console.log(data);
                        var match = false;
                        data.forEach(function(current, index) {
                            if (current.indexOf(input.userId) > -1) {
                                match = data[index].concat([index]);
                                return;
                            }
                        });
                        callback(null, match);
                    });
                }
            ], function voteHandler(err, result) {

                /**
                 * Format of result: ['userId', 'letter', index] (index = main database array)
                 */

                if (result) {

                    // Decrement value of old vote

                    holder = {};
                    vote = 'answers.' + result[1] + '.score';
                    holder[vote] = -1;

                    db.collection(input.channelId).updateOne(
                        { "answers.A.score": { $gt: -1 } },
                        { $inc: holder }
                    );

                    // Increment value of new vote

                    holder = {};
                    vote = 'answers.' + input.pollParams().toUpperCase().slice(1,2) + '.score';
                    holder[vote] = 1;

                    db.collection(input.channelId).updateOne(
                        { "answers.A.score": { $gt: -1 } },
                        { $inc: holder }
                    );

                    // Update value of voter array

                    holder = {};
                    var indexVal = result[2];
                    vote = input.pollParams().toUpperCase().slice(1,2);
                    holder[indexVal] = vote;

                    // db.collection(input.channelId).updateOne(
                    //     { "answers.A.score": { $gt: -1 } },
                    //     { $set: { holder[66]  2 } }
                    // );

                } else {

                    holder = {};
                    vote = 'answers.' + input.pollParams().toUpperCase().slice(1,2) + '.score';
                    holder[vote] = 1;

                    db.collection(input.channelId).updateOne(
                        { "answers.A.score": { $gt: -1 } },
                        { $inc: holder }
                    );
                }

            });

        }

    // Handler function for /poll {help}
    // TODO:

    // Handler function for /poll {results}

        function getScores() {

            var scores;
            var graphic;

            async.parallel([
                function getScoreA(callback) {
                    db.collection(input.channelId).find({}, {"answers.A": 1, _id:0}).limit(1).toArray(function(err, data) {
                        callback(null, [data[0].answers.A.choice, data[0].answers.A.score]);
                    });
                },
                function getScoreB(callback) {
                    db.collection(input.channelId).find({}, {"answers.B": 1, _id:0}).limit(1).toArray(function(err, data) {
                        callback(null, [data[0].answers.B.choice, data[0].answers.B.score]);
                    });
                },
                function getScoreC(callback) {
                    db.collection(input.channelId).find({}, {"answers.C": 1, _id:0}).limit(1).toArray(function(err, data) {
                        callback(null, [data[0].answers.C.choice, data[0].answers.C.score]);
                    });
                },
                function getScoreD(callback) {
                    db.collection(input.channelId).find({}, {"answers.D": 1, _id:0}).limit(1).toArray(function(err, data) {
                        callback(null, [data[0].answers.D.choice, data[0].answers.D.score]);
                    });
                },
                function getPollTitle(callback) {
                    db.collection(input.channelId).find({}, {"title": 1, _id:0}).limit(1).toArray(function(err, data) {
                        callback(null, [data[0].title]);
                    });
                }
            ],
            function drawGraphic(err, results){

                var A     = results[0].concat('A');
                var B     = results[1].concat('B');
                var C     = results[2].concat('C');
                var D     = results[3].concat('D');
                var title = results[4];

                graphic = [
                    [
                        '├' + Array(A[1]).join('┬') + '┐\n' +
                        '│' + Array(A[1]).join('│') + '│[A]\n' +
                        '├' + Array(A[1]).join('┴') + '┘\n'
                    ],
                    [
                        '├' + Array(B[1]).join('┬') + '┐\n' +
                        '│' + Array(B[1]).join('│') + '│[B]\n' +
                        '├' + Array(B[1]).join('┴') + '┘\n'
                    ],
                    [
                        '├' + Array(C[1]).join('┬') + '┐\n' +
                        '│' + Array(C[1]).join('│') + '│[C]\n' +
                        '├' + Array(C[1]).join('┴') + '┘\n'
                    ],
                    [
                        '├' + Array(D[1]).join('┬') + '┐\n' +
                        '│' + Array(D[1]).join('│') + '│[D]\n' +
                        '├' + Array(D[1]).join('┴') + '┘\n'
                    ]
                ];

                /**
                 * forEach element in [A - D]...
                 * 		If the question was not set, then remove it entirely.
                 * 		If the total votes for the question is 0, then flatten the bar group.
                 * @return {Array} [Formatted array ready to .join() and send to user]
                 */
                [A, B, C, D].forEach(
                    function(element, index) {
                        if (element[0] === '') {
                            graphic.splice(index);
                        }
                        if (element[1] === 0 && element[0] !== '') {
                            graphic.splice(index, 1, '│\n│[A]\n│\n');
                        }
                    });

                options.body += '_*' + title + '*_\n' +
                                '```\n' + graphic.join('') + '```\n' +
                                '> *Current Results*\n\n>>>' +
                                ( A[0] !== '' ? '*' + A[2] + '.* ' + A[0] + ' ` ' + A[1] + ' `\n' : '' ) +
                                ( B[0] !== '' ? '*' + B[2] + '.* ' + B[0] + ' ` ' + B[1] + ' `\n' : '' ) +
                                ( C[0] !== '' ? '*' + C[2] + '.* ' + C[0] + ' ` ' + C[1] + ' `\n' : '' ) +
                                ( D[0] !== '' ? '*' + D[2] + '.* ' + D[0] + ' ` ' + D[1] + ' `\n' : '' );

                request(options, function (error, response, body) {
                  if (error) throw new Error(error);
                  console.log(body);
                });

            });

        }
