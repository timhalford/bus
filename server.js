var express = require('express');
var moment = require('moment');
var models = require('./src/backend/models');
var bristolAPI = require('./src/backend/bristol-api.js');

var api = express();
api.get('/stops', function(req, res) {
  models.allStops(function(data) {
    res.json(data);
  });
});
api.get('/stops/:stopIds', function(req, res) {
  models.stops(req.params.stopIds.split(','),
    function(data) {
      res.json(data);
    }
  );
});
api.get('/stopCalls/:stopId', function(req, res) {
  models.stopCalls(
    req.params.stopId,
    function(data) {
      res.json(data);
    }
  );
});
api.get('/samples/:stopId', function(req, res) {
  models.fetchSamples(
    req.params.stopId,
    function(samples) {
      var stopTrips = samples.reduce(function(memo, sample) {
        var tripId = sample.tripId;
        if (!(tripId in memo)) {
          memo[tripId] = {
            tripId: tripId,
            headsign: sample.headsign,
            lineName: sample.lineName,
            scheduledArrivalTime: sample.scheduledArrivalTime,
            samples: []
          };
        }
        memo[tripId].samples.push(sample);
        return memo;
      }, {});
      stopTrips = Object.keys(stopTrips).map(function(tripId) {
        return stopTrips[tripId]
      }).sort(function(a, b) {
        var aLastSample = a.samples[a.samples.length - 1];
        var bLastSample = b.samples[b.samples.length - 1];
        var aLastScheduled = moment(aLastSample.scheduledArrivalTime);
        var bLastScheduled = moment(bLastSample.scheduledArrivalTime);
        return (aLastScheduled > bLastScheduled);
      });
      res.json(stopTrips);
    }
  );
});
api.get('/liveStopCalls/:stopId', function(req, res) {
  bristolAPI.getLiveStopCalls(req.params.stopId, 30, function(data) {
    res.json(data);
  });
});
api.get('/trips/:tripId', function(req, res) {
  models.trip(req.params.tripId, function(data) {
    res.json(data);
  });
});
api.get('/trips/:tripId/stopCalls', function(req, res) {
  models.tripStopCalls(req.params.tripId, function(data) {
    res.json(data);
  });
});

var app = express();
app.use(express.static('public'));
app.use('/api', api);

app.listen(80, function() {
  console.log('listening...');
});

