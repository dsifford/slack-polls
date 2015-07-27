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
                }
            });

            console.log(pollOptions);

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
                }
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

            var holder = {};
            var vote = 'answers.' + input.pollParams().toUpperCase().slice(1,2) + '.score';
            holder[vote] = 1;

            db.collection(input.channelId).updateOne(
                { "answers.A.score": { $gt: -1 } },
                { $inc: holder }
            );

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
                }
            ],
            function drawGraphic(err, results){

                var A = results[0].concat('A');
                var B = results[1].concat('B');
                var C = results[2].concat('C');
                var D = results[3].concat('D');

                var sorted = [A, B, C, D].sort(function(a, b) {
                    if (a[1] < b[1]) return -1;
                    if (a[1] > b[1]) return 1;
                    return 0;
                });
                console.log(sorted);

                graphic = {
                    A : '├' + Array(A[1] + 1).join('┬') + '┐\n' +
                        '│' + Array(A[1] + 1).join('│') + '│[A]\n' +
                        '├' + Array(A[1] + 1).join('┴') + '┘\n',
                    B : '├' + Array(B[1] + 1).join('┬') + '┐\n' +
                        '│' + Array(B[1] + 1).join('│') + '│[B]\n' +
                        '├' + Array(B[1] + 1).join('┴') + '┘\n',
                    C : '├' + Array(C[1] + 1).join('┬') + '┐\n' +
                        '│' + Array(C[1] + 1).join('│') + '│[C]\n' +
                        '├' + Array(C[1] + 1).join('┴') + '┘\n',
                    D : '├' + Array(D[1] + 1).join('┬') + '┐\n' +
                        '│' + Array(D[1] + 1).join('│') + '│[D]\n' +
                        '├' + Array(D[1] + 1).join('┴') + '┘\n'
                };

                // [0] Question -- [1] Number -- [2] Letter

                options.body += '```\n' + graphic.A + graphic.B + graphic.C + graphic.D + '```\n' +
                                '> *Current Results*\n\n' +
                                '>>>*' + sorted[0][2] + '.* ' + sorted[0][0] + ' ` ' + sorted[0][1] + ' `\n' +
                                '*' + sorted[1][2] + '.* ' + sorted[1][0] + ' ` ' + sorted[1][1] + ' `\n' +
                                '*' + sorted[2][2] + '.* ' + sorted[2][0] + ' ` ' + sorted[2][1] + ' `\n' +
                                '*' + sorted[3][2] + '.* ' + sorted[3][0] + ' ` ' + sorted[3][1] + ' `';

                request(options, function (error, response, body) {
                  if (error) throw new Error(error);
                  console.log(body);
                });

            });

        }
