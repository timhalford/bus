var models = require('./src/backend/models');
var bristolAPI = require('./src/backend/bristol-api');

const POLL_INTERVAL_MILLISECONDS = 20000;

function sampleBristolAPI(stopId) {
  // cache full stop calls for stop
  models.stopCalls(stopId, function() {
    // get live stop calls
    bristolAPI.getLiveStopCalls(stopId, 30, function(liveStopCalls) {
      // if no live stop calls, return
      if (liveStopCalls.length === 0) {
        return null;
      }
      var timestamp = Date.now();
      liveStopCalls.forEach(function(liveStopCall) {
        liveStopCall.timestamp = timestamp;
        var lineName = liveStopCall.lineName;
        var scheduledArrivalTime = liveStopCall.scheduledArrivalTime;
        // get full stop call
        models.stopCall(
          stopId,
          lineName,
          scheduledArrivalTime,
          function(stopCall) {
            if (!stopCall) {
              console.log('not found');
              return null;
            }
            var tripId = stopCall.tripId;
            var routeId = stopCall.routeId
            liveStopCall.tripId = tripId;
            liveStopCall.routeId = routeId;
            liveStopCall.staticHeadsign = stopCall.headsign;
            models.insertSample(
              liveStopCall,
              function() {
                // emit update
                console.log('update');
              }
            );
          }
        );
      });
    });
  });
}

var stopId = '0100BRP90325';

setInterval(
  function() {
    console.log('interval: ' + stopId);
    sampleBristolAPI(stopId);
  },
  60000
);
sampleBristolAPI(stopId);

