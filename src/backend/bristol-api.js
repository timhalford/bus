var request = require('request');

const API_KEY = 'o5ZtPd5IpUqweQ4SNdC5bQ';
const API_VERSION = '2.0';
const API_URL = 'https://bristol.api.urbanthings.io/api/' + API_VERSION;
const TRANSIT_STOP_BUS = '3';
const STOP_MODES = '' + TRANSIT_STOP_BUS;
const MIN_LAT_SMALL = '51.444145';
const MIN_LONG_SMALL = '-2.59808';
const MAX_LAT_SMALL = '51.455093';
const MAX_LONG_SMALL = '-2.575545';
const MIN_LAT_LARGE = '51.404565';
const MIN_LONG_LARGE = '-2.679087';
const MAX_LAT_LARGE = '51.517397';
const MAX_LONG_LARGE = '-2.485501';

var baseRequest = request.defaults({
  qs: { apiKey: API_KEY },
  json: true
});

function staticResourcePath(resourceName) {
  return API_URL + '/static/' + resourceName;
}

function liveResourcePath(resourceName) {
  return API_URL + '/rti/' + resourceName;
}

function transformStop(stop) {
  return {
    lat: stop.lat,
    lng: stop.lng,
    stopId: stop.primaryCode,
    name: stop.name
  };
}

function transformStopCall(stopId, stopCall) {
  var scheduledArrivalTime = Date.parse(
    stopCall.scheduledCall.scheduledArrivalTime
  );
  var scheduledDepartureTime = Date.parse(
    stopCall.scheduledCall.scheduledDepartureTime
  );
  return {
    stopId: stopId,
    tripId: stopCall.tripInfo.tripID,
    headsign: stopCall.tripInfo.headsign,
    lineName: stopCall.routeInfo.lineName,
    routeId: stopCall.routeInfo.routeID,
    scheduledArrivalTime: scheduledArrivalTime, 
    scheduledDepartureTime: scheduledDepartureTime, 
  };
}

function transformLiveStopCall(stopId, stopCall) {
  var expectedArrivalTime = Date.parse(
    stopCall.expectedArrivalTime
  );
  var expectedDepartureTime = Date.parse(
    stopCall.expectedDepartureTime
  );
  var transformedStopCall = transformStopCall(stopId, stopCall);
  transformedStopCall.expectedArrivalTime = expectedArrivalTime;
  transformedStopCall.expectedDepartureTime = expectedDepartureTime; 
  return transformedStopCall;
}

function transformTrip(trip) {
  return trip.map(function(stopCall) {
    var scheduledArrivalTime = Date.parse(
      stopCall.scheduledCall.scheduledArrivalTime    
    );
    return {
      stopId: stopCall.transitStopPrimaryCode,
      scheduledArrivalTime: scheduledArrivalTime
    };
  });
}

function getAllStops(callback) {
  baseRequest.get({
    url: staticResourcePath('transitstops'),
    qs: {
      stopModes: STOP_MODES,
      minLat: MIN_LAT_SMALL,
      minLng: MIN_LONG_SMALL,
      maxLat: MAX_LAT_SMALL,
      maxLng: MAX_LONG_SMALL
    },
  }, function(error, response, body) {
    callback(body.data.slice(0, 10));
  });
}

function getStops(stopIds, callback) {
  baseRequest.get({
    url: staticResourcePath('stops'),
    qs: {
      stopModes: STOP_MODES,
      stopIDs: stopIds.join()
    }
  },
  function(error, response, body) {
    var stops = body.data.map(transformStop);
    callback(stops);
  });
}

function getTrip(tripId, callback) {
  baseRequest.get({
    url: staticResourcePath('trips'),
    qs: { tripID: tripId }
  },
  function(error, response, body) {
    var trip = transformTrip(body.data[0].stopCalls);
    callback(trip);
  });
}

function getStopCalls(stopId, lookAheadMinutes, callback) {
  baseRequest.get({
    url: staticResourcePath('stopcalls'),
    qs: {
      stopID: stopId,
      lookAheadMinutes: lookAheadMinutes
    }
  }, function(error, response, body) {
    var stopCalls = body.data;
    stopCalls = stopCalls.scheduledCalls
      .map(transformStopCall.bind(null, stopId));
    callback(stopCalls);
  });
}

function getLiveStopCalls(stopId, lookAheadMinutes, callback) {
  baseRequest.get({
    url: liveResourcePath('report'),
    qs: {
      stopID: stopId,
      lookAheadMinutes: lookAheadMinutes
    }
  }, function(error, response, body) {
    var report = body.data.rtiReports[0];
    var stopCalls = report.upcomingCalls
      // remove stop calls with no live data
      .filter(function(stopCall) {
        return (
          typeof stopCall.expectedArrivalTime !== 'undefined' &&
          typeof stopCall.expectedDepartureTime !== 'undefined'
        );
      })
      .map(transformLiveStopCall.bind(null, stopId));
    callback(stopCalls);
  });
}

module.exports = {
  getAllStops: getAllStops,
  getStops: getStops,
  getTrip: getTrip,
  getStopCalls: getStopCalls,
  getLiveStopCalls: getLiveStopCalls
};

