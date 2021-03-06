var express = require('express');
var unirest = require('unirest');
var events = require('events');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var config = require('./config');
var https = require('https');
var http = require('http');
var app = express();
var park = require('./models/park');
app.use(express.static('public'));
app.use(bodyParser.json());



var runServer = function (callback) {
    mongoose.connect(config.DATABASE_URL, function (err) {
        if (err && callback) {
            return callback(err);
        }

        app.listen(config.PORT, function () {
            console.log('Listening on localhost:' + config.PORT);
            if (callback) {
                callback();
            }
        });
    });
};

if (require.main === module) {
    runServer(function (err) {
        if (err) {
            console.error(err);
        }
    });
};


// external API call
var getFromNps = function (location) {
    var emitter = new events.EventEmitter();
    var options = {
        host: 'developer.nps.gov',
        path: '/api/v1/parks?parkCode=' + location + '&api_key=6eo0dk9fGIU1knoiL1ICR4oKUrYLUx8etZSlqnhT',
        method: 'GET',
        headers: {
            'Authorization': "6eo0dk9fGIU1knoiL1ICR4oKUrYLUx8etZSlqnhT",
            'Content-Type': "application/json",
            'Port': 443,
            'User-Agent': 'Paw/3.1.2 (Macintosh; OS X/10.12.5) GCDHTTPRequest'
        }
    };

    https.get(options, function (res) {
        var body = '';
        res.on('data', function (chunk) {
            body += chunk;
            var jsonFormattedResults = JSON.parse(body);
            emitter.emit('end', jsonFormattedResults);
        });

    }).on('error', function (e) {

        emitter.emit('error', e);
    });
    return emitter;
};


// local API endpoints
app.get('/park/:parkCode', function (req, res) {


    //external api function call and response
    var searchReq = getFromNps(req.params.parkCode);

    //get the data from the first api call
    searchReq.on('end', function (item) {
        res.json(item);
    });

    //error handling
    searchReq.on('error', function (code) {
        res.sendStatus(code);
    });

});
//
app.post('/add-to-bucket-list/', function (req, res) {

    //db connection and data queries
    //creating object that will POST
    park.create({
        name: req.body.name,
        image: req.body.image,
        status: req.body.status
    }, function (err, item) {
        console.log(item);
        if (err) {
            return res.status(500).json({
                message: 'Internal Server Error'
            });
        }
        res.status(201).json(item);
    });
});
app.get('/populate-bucket-list/', function (req, res) {
    park.find(function (err, item) {
        if (err) {
            return res.status(500).json({
                message: 'Internal Server Error'
            });
        }
        res.status(200).json(item);
    });
});

app.put('/update-bucket-list/:bucketListId/:bucketListStatus', function (req, res) {
    console.log(req.params.bucketListId, req.params.bucketListStatus);
    var oppositeStatus = "";
    if (req.params.bucketListStatus == 'unchecked') {
        oppositeStatus = 'checked'
    } else {
        oppositeStatus = 'unchecked'
    }
    park.find(function (err, items) {
        if (err) {
            return res.status(404).json({
                message: 'Item not found.'
            });
        }
        park.update({
            _id: req.params.bucketListId
        }, {
            $set: {
                status: oppositeStatus
            }
        }, function () {
            res.status(201).json(items);
        });
    });
});

app.delete('/delete-from-bucket-list/:bucketListId', function (req, res) {
    park.findByIdAndRemove(req.params.bucketListId, function (err, items) {
        if (err)
            return res.status(404).json({
                message: 'Item not found.'
            });

        res.status(201).json(items);
    });
});


exports.app = app;
exports.runServer = runServer;

app.listen(8080);
