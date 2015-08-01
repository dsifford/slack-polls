var express     = require('express'),
    bodyParser  = require('body-parser'),
    request     = require("request"),
    MongoClient = require('mongodb').MongoClient,
    assert      = require('assert'),
    async       = require('async'),
    app         = express();

/**
 * Include the bodyParser Middleman + allow x-url-encoding
 * to be extended to the body of the request
 */
app.use(bodyParser.urlencoded({ extended: true }));



/** GLOBALS **/
// var MONGOLAB_URI = 'mongodb://localhost:27017/slackpolls'; // TEST VARIABLE
// var PORT = 3000; // TEST VARIABLE
var db,
    input,
    options,
    payload,
    requestURL;

/**
 * Function to fetch the list of Incoming Webhook URIs.
 */

var resetRequest = function() {
    async.series([
        function(callback) {
            db.collection('master').find().toArray(function(err, data) {
                assert.equal(err, null);
                callback(null, data);
            });
        }
    ], function(err, results) {
        if (results[0][0] !== undefined) {
            requestURL = {};
            results[0].forEach(function(counter) {
                requestURL[counter.team] = counter.requestURL;
            });
        }
    });
};


/**
 * Connect to MongoDB
 * Save database to 'db'
 * Save Incoming Webhook URL (if it exists) to requestURL
 */

 MongoClient.connect(process.env.MONGOLAB_URI, function(err, database) {
    assert.equal(err, null);
    console.log("Connected correctly to server");

    db = database;

    resetRequest();

    app.listen(process.env.PORT || PORT);
    console.log('App listening on http://localhost/%s', process.env.PORT);
});

///////////////////////////////
// POST Route for index path //
///////////////////////////////

app.post('/', function(req, res, next) {
    console.log("POST request received at '/'.");
    // PARSE REQUEST TO INDIVIDUAL VARIABLES
    input = {
        name: req.body.user_name,
        userId: req.body.user_id,
        teamDomain: req.body.team_domain,
        pollMethod: req.body.text.match(/\S*/)[0].toLowerCase(),
        pollParams: function() { return req.body.text.substr(input.pollMethod.length).trim(); },
        channelId: req.body.channel_id,
        channelName: '#' + req.body.channel_name
    };

    // SET OUTPUT OPTIONS
    options = {
        method: 'POST',
        uri: undefined,
        headers: { 'content-type': 'application/json' },
        json: true
    };

    if (requestURL !== undefined) {
        for(var key in requestURL) {
            if(key == input.teamDomain) {
                options.uri = requestURL[key].substring(1, requestURL[key].length-1);
                console.log('This is the url generated in the for loop: ' + requestURL[key].substring(1, requestURL[key].length-1));
                break;
            }
        }
    }

    // INSTANTIATE OUTPUT PAYLOAD
    payload = {
        "channel": input.channelName,
        "icon_emoji": ":bar_chart:",
        "username": "Slack Polls",
        "text": undefined,
        "attachments":[
            {
                "title": undefined,
                "text": undefined,
                "image_url": undefined,
                "color":"#D00000",
                "mrkdwn_in": ["pretext", "text", "fields"],
                "fields":[
                    {
                       "title": "Choices",
                       "value": undefined,
                       "short": true
                    },
                    {
                       "title": "Votes",
                       "value": undefined,
                       "short": true
                    }
                ]
            }
        ]
    };

    // OUTPUT LOGIC
    if (requestURL === undefined && input.pollMethod != 'setup') {
        if (input.pollMethod == 'help') {
            res.send(getHelp);
        }
        res.send('You must first run "/poll setup" before you can begin polling.');
        return;
    }
    if (input.pollMethod == 'setup') {
        appSetup();
        resetRequest();
        res.send('Webhook URL successfully stored in the database. You\'re all set!');
    } else if (input.pollMethod == 'new') {
        newHandler();
    } else if (input.pollMethod == 'vote') {
        castVote();
        res.send('Thanks for casting your vote, ' + input.name + '!\n' +
                  'You may check back on the results at any time by invoking `/poll results`.');
    } else if (input.pollMethod == 'help') {
        res.send(getHelp);
    } else if (input.pollMethod == 'peek') {
        getScores(res, true);
    } else if (input.pollMethod == 'results') {
        getScores(res, false);
    }

});


///////////////////////////////////////////////////////////
// --------------------- FUNCTIONS --------------------- //
///////////////////////////////////////////////////////////

    // Handler function for /poll {setup}

        function appSetup() {
            requestURL = input.pollParams();

            db.collection('master').findOneAndReplace({team: input.teamDomain},
                {team: input.teamDomain, requestURL: requestURL},
                {
                        returnOriginal: false,
                        upsert: true,
                },
                function(err, response) {
                assert.equal(err, null);
                console.log('Document successfully inserted into database.');
            });
        }


    // Handler function for /poll {new}

        function newHandler() {
            async.series([
                function removePoll(callback) {
                    db.collection(input.channelId).drop(function(err, response) {
                        callback(null);
                    });
                },
                function newPoll(callback) {

                    var pollOptions = [];
                    input.pollParams().split(/(?:["“])(.*?)(?:[”"])/g).forEach(function(param) {
                        if (param !== '' && param !== ' ' ) {
                            pollOptions.push(param);
                            console.log(pollOptions);
                        }
                    });

                    db.collection(input.channelId).insertOne( {
                        title : pollOptions[0],
                        answers : {
                            A : {
                                "choice" : pollOptions[1],
                                "score" : 0
                            },
                            B : {
                                "choice" : typeof pollOptions[2] === 'undefined' ? '' : pollOptions[2],
                                "score" : 0
                            },
                            C : {
                                "choice" : typeof pollOptions[3] === 'undefined' ? '' : pollOptions[3],
                                "score" : 0
                            },
                            D : {
                                "choice" : typeof pollOptions[4] === 'undefined' ? '' : pollOptions[4],
                                "score" : 0
                            }
                        },
                        voters : [] // Format: [ [ 'userId', 'B' ], [ 'userId', 'A' ] ... ]
                    }, function(err, result) {
                        assert.equal(err, null);
                        console.log("Created a new collection and instantiated a new poll.");

                        // SET RESPONSE PAYLOAD
                        payload.text = '*New poll created successfully!*';
                        payload.attachments[0].title = pollOptions[0];
                        payload.attachments[0].text = '*A.* ' + pollOptions[1] + '\n' +
                                        (typeof pollOptions[2] === 'undefined' ? '' : ('*B.* ' + pollOptions[2] + '\n')) +
                                        (typeof pollOptions[3] === 'undefined' ? '' : ('*C.* ' + pollOptions[3] + '\n')) +
                                        (typeof pollOptions[4] === 'undefined' ? '' : ('*D.* ' + pollOptions[4]));
                        payload.attachments[0].fields = undefined;

                        options.body = payload;

                        request(options, function (error, response, body) {
                          if (error) throw new Error(error);
                          console.log(body);
                        });
                    });
                }
            ]);
        }



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

    // /poll {help} Variable

        var getHelp = '*FORMAT: `/poll` `{method}` `[arguments]*`\n' +
                      '*`Method`*: DO NOT surround in quotes\n' +
                      '*`Arguments`*: All arguments must be separated by a *single space* and surrounded in *"double quotes"*\n\n\n' +
                      '*LIST OF AVAILABLE METHODS:*\n\n' +
                      '*/poll `setup` `[Incoming Webhook URL]`*\n' +
                      '```\n' +
                      '--- [Incoming Webhook URL]: Found on the integration configuration page.\n' +
                      '+++ EXAMPLE: /poll setup "https://hooks.slack.com/services/xxxxxxxxx/yyyyyyyyy/zzzzzzzzzzzzzzzzzzzzzzzz"\n' +
                      '```\n' +
                      '*/poll `new` `[Title]` `[Option (up to 4)]`*\n' +
                      '```\n' +
                      '@@@ This will delete any existing poll in the current channel and initiate a new one.\n' +
                      '@@@ You may have as many simultaneous polls running as channels in your team.\n' +
                      '--- [Title]: The title of your poll.\n' +
                      '--- [Option]: Up to 4 options for your poll.\n' +
                      '+++ EXAMPLE: /poll new "This is the title of my question." "Option A" "Option B" "Option C" "Option D"\n' +
                      '```\n' +
                      '*/poll `vote` `[Option]`*\n' +
                      '```\n' +
                      '@@@ This method saves your vote in the database.\n' +
                      '@@@ Subsequent uses of vote on the same poll replaces your previous vote with your current one.\n' +
                      '--- [Option]: A single letter corresponding to the option of your choice. Case-insensitive.\n' +
                      '+++ EXAMPLE: /poll vote "C"  -OR-  /poll vote "c"\n' +
                      '```\n' +
                      '*/poll `results`*\n' +
                      '```\n' +
                      '@@@ This method takes no arguments. Invoking it will return a graph and detailed breakdown of the current results.\n' +
                      '```';

    // Handler function for /poll {results}

        function getScores(mainResponse, isPeek) {

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

                // SET RESPONSE PAYLOAD
                payload.text = '*Current Results*\n```\n' + graphic.join('') + '```\n';
                payload.attachments[0].pretext = '_*' + title + '*_\n';
                payload.attachments[0].fields[0].value =    ( A[0] !== '' ? '*' + A[2] + '.* ' + A[0] + '\n' : '' ) +
                                                            ( B[0] !== '' ? '*' + B[2] + '.* ' + B[0] + '\n' : '' ) +
                                                            ( C[0] !== '' ? '*' + C[2] + '.* ' + C[0] + '\n' : '' ) +
                                                            ( D[0] !== '' ? '*' + D[2] + '.* ' + D[0] + '\n' : '' );
                payload.attachments[0].fields[1].value =    ( A[0] !== '' ? ' ` ' + A[1] + ' `\n' : '' ) +
                                                            ( B[0] !== '' ? ' ` ' + B[1] + ' `\n' : '' ) +
                                                            ( C[0] !== '' ? ' ` ' + C[1] + ' `\n' : '' ) +
                                                            ( D[0] !== '' ? ' ` ' + D[1] + ' `\n' : '' );

                options.body = payload;

                if (isPeek) {
                    mainResponse.send(payload.text + payload.attachments[0].pretext + payload.attachments[0].fields[0].value);
                } else {
                    request(options, function (error, response, body) {
                      if (error) throw new Error(error);
                    });
                    mainResponse.end();
                }
            });

        }
