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
 * 1) Handler function for /poll {help}
 * 2) Move functions to external file for cleaner index
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
    options,
    payload,
    requestURL;


////////////////////////
// Connect to MongoDB //
////////////////////////

MongoClient.connect(MONGODB_URI, function(err, database) {
    assert.equal(err, null);
    console.log("Connected correctly to server");

    db = database;

    async.series([
        function(callback) {
            db.collection('master').find().toArray(function(err, data) {
                assert.equal(err, null);
                callback(null, data[0]);
            });
        }
    ], function(err, results) {
        if (results[0] !== undefined) {
            requestURL = results[0].requestURL;
        }
    });
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
        url: 'https://hooks.slack.com/services/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',
        headers: { 'content-type': 'application/json' },
        // body: payload (dont forget to add this!)
        json: true
    };

    payload = {
        channel: input.channelId,
        icon_emoji: ":bar_chart:",
        username: "Slack Polls",
        text: "",
        attachments:[
            {
                "color":"#D00000",
                "fields":[
                    {
                       "title":"Choices",
                       "value":"A\nB\nC\nD",
                       "short":true
                    },
                    {
                       "title":"Votes",
                       "value":"64\n44\n28\n12",
                       "short":true
                    }
                ]
            }
        ]
    };

    //////////////////
    // Output logic //
    //////////////////
    if (requestURL === undefined && input.pollMethod != 'setup') {
        console.log('You must first run "/poll setup" before you can begin polling.');
        return;
    }
    if (input.pollMethod == 'setup') {
        appSetup();
    } else if (input.pollMethod == 'new') {
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

    // Handler function for /poll {setup}
    function appSetup() {
        requestURL = input.pollParams();

        async.series([
            function dropIfExisting(callback){
                db.collection('master').drop(function(err, response) {
                    console.log(response);
                    callback(null, '');
                });
            },
            function storeUrl(callback){
                db.collection('master').insertOne( {
                    requestURL : requestURL
                }, function(err, result) {
                    assert.equal(err, null);
                    console.log('Webhook URL successfully stored in the database.');
                });
            }
        ]);
    }


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
                "voters" : [] // Format: [ [ 'userId', 'B' ], [ 'userId', 'A' ] ... ]
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

            /**
             * checkVoteStatus: [Checks the voters array to see if a vote has been cast
             * 					with a matching userId. If one exists, that array is captured
             * 					as 'match'. If one does not exist, 'match' is set to false]
             *
             * voteHandler:     [Control flow depending on if the user has already voted]
             */
            async.series([
                function checkVoteStatus(callback) {
                    db.collection(input.channelId).find({}, {"voters": 1, _id:0}).toArray(function(err, data) {
                        assert.equal(err, null);
                        var match = false;
                        data[0].voters.forEach(function(current, index) {
                            if (current.indexOf(input.userId) > -1) {
                                match = data[0].voters[index].concat([index]);
                                return;
                            }
                        });
                        callback(null, [match, data[0].voters]);
                    });
                }
            ], function voteHandler(err, result) {

                /**
                 * Format of result: [ ['userId', 'oldChoice', index], [[full], [voters], [array-of-arrays]] ] (index = main database array)
                 */
                var match = result[0][0];
                var updatedArray = result[0][1]; // Copy of the old array (pre-updated)
                var choice = input.pollParams().toUpperCase().slice(1,2); // Letter choice for new vote

                if (match) {

                    /**
                     * If the user has already voted...
                     * 1) Replace their old vote in updatedArray with their new one
                     * 2) Decrement the score for their old vote
                     * 3) Increment the score for thier new vote
                     * 4) Replace the voters array with updatedArray
                     */

                    updatedArray[result[0][0][2]] = [input.userId, choice]; // Replace old vote with new vote
                    holder = {};
                    vote = 'answers.' + result[0][0][1] + '.score';
                    holder[vote] = -1;

                    // DECREMENT
                    db.collection(input.channelId).updateOne(
                        { "answers.A.score": { $gt: -1 } },
                        { $inc: holder }
                    );

                    // INCREMENT
                    holder = {};
                    vote = 'answers.' + input.pollParams().toUpperCase().slice(1,2) + '.score';
                    holder[vote] = 1;

                    db.collection(input.channelId).updateOne(
                        { "answers.A.score": { $gt: -1 } },
                        { $inc: holder }
                    );

                    // REPLACE VOTERS ARRAY
                    db.collection(input.channelId).updateOne(
                        { "answers.A.score": { $gt: -1 } },
                        { $set: { "voters" : updatedArray } }
                    );

                } else {

                    /**
                     * If the user has not voted yet (match = false)...
                     * 1) .push() their [userId, choice] to  updatedArray
                     * 2) Increment the score for their vote
                     * 3) Replace the voters array with updatedArray
                     */

                    updatedArray.push([input.userId, choice]);

                    holder = {};
                    vote = 'answers.' + input.pollParams().toUpperCase().slice(1,2) + '.score';
                    holder[vote] = 1;

                    db.collection(input.channelId).updateOne(
                        { "answers.A.score": { $gt: -1 } },
                        { $inc: holder }
                    );

                    db.collection(input.channelId).updateOne(
                        { "answers.A.score": { $gt: -1 } },
                        { $set: { "voters" : updatedArray } }
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
                            graphic.splice(index, 1, '│\n│[' + String.fromCharCode(65 + index) + ']\n│\n');
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
