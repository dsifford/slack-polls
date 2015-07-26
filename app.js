var express     = require('express'),
    bodyParser  = require('body-parser'),
    request     = require("request"),
    MongoClient = require('mongodb').MongoClient,
    assert      = require('assert'),
    app         = express();

// TESTING VARIABLES
var PORT = 3000;

// Connect to MongoDB



// Include the bodyParser Middleman + allow x-url-encoding
// to be extended to the body of the request
app.use(bodyParser.urlencoded({ extended: true }));

app.post('/', function(req, res, next) {
    console.log("POST request received at '/'.");

    // Collect request and set variables
    var name = req.body.user_name;
    var domain = req.body.team_domain;
    var pollMethod = req.body.text.match(/\S*/)[0].toLowerCase();
    var pollParams = req.body.text.substr(pollMethod.length).trim();
    var channelId = req.body.channel_id;

    // Set output options TODO: Setup /poll {setup} to save token in database
    var options = {
        method: 'POST',
        url: 'https://' + domain + '.slack.com/services/hooks/slackbot',
        qs: { token: '80Q9s54PMHVjOXgJE1CKlzVf', channel: channelId },
        body: ''
    };

    // Output logic
    if (pollMethod == 'new') {
        // Run 'new' handler
    } else if (pollMethod == 'vote') {
        // Run 'vote' handler
    } else if (pollMethod == 'help') {
        help(options);
    } else if (pollMethod == 'results') {
        // Run 'results' handler
    }

    console.log('> Ending Response...');
    res.end();
});

app.listen(process.env.PORT || PORT, function() {
    console.log('App listening on http://localhost/%s', PORT);
});


// Handler function for /poll {new}
    // TODO:

// Handler function for /poll {vote}
    // TODO:

// Handler function for /poll {help}
    // TODO:
    function help(options) {
        options.body = 'This is a test!\nTest test test!';
        request(options, function (error, response, body) {
          if (error) throw new Error(error);

          console.log(body);
        });
    }

// Handler function for /poll {results}
    // TODO:
