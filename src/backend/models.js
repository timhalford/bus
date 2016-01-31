var redis = require('redis');
var bristolAPI = require('./bristol-api.js');

const STATIC_EXPIRE = 43200;
const STOPS_EXPIRE = STATIC_EXPIRE;
const TRIPS_EXPIRE = STATIC_EXPIRE;
const STOP_CALLS_EXPIRE = 6200;
const STOPS_KEY = 'stops';
const STOP_CALLS_KEY = 'stop_calls';
const TRIPS_KEY = 'trips';
const SAMPLES_KEY = 'samples';

var redisClient = redis.createClient();

redisClient.on('error', function(error) {
  console.log('redis error: ' + error);
});

function transformStop(stop) {
  if (stop === null) {
    return null;
  }
  stop.lat = parseFloat(stop.lat);
  stop.lng = parseFloat(stop.lng);
  return stop;
}

function transformSample(stopCall) {
  console.log('transform', stopCall);
  stopCall.scheduledArrivalTime = parseInt(stopCall.scheduledArrivalTime)
  stopCall.expectedArrivalTime = parseInt(stopCall.expectedArrivalTime)
  stopCall.timestamp = parseInt(stopCall.timestamp);
  return stopCall;
}

function transformTrip(trip) {
  var transformedTrip = [];
  for(var i = 0; i < trip.length; i += 2) {
    transformedTrip.push({
      stopId: trip[i],
      scheduledArrivalTime: parseInt(trip[i + 1])
    });
  }
  return transformedTrip;
}

function fetchHashes(hashKeys, callback) {
  var multi = redisClient.multi();
  hashKeys.forEach(function(hashKey) {
    multi.hgetall(hashKey);
  });
  multi.exec(function(error, hashes) {
    redis.print(error, hashes);
    callback(hashes);
  });
}

function insertSetOfHashes(setKey, hashKeys, hashes, expire) {
  var multi = redisClient.multi();
  for (var i = 0; i < hashKeys.length; i++) {
    multi.hmset(hashKeys[i], hashes[i]);
    multi.sadd(setKey, hashKeys[i]);
    multi.expire(hashKeys[i], expire);
  }
  multi.expire(setKey, expire);
  multi.exec(redis.print);
}

function fetchSetOfHashes(setKey, callback) {
  redisClient.smembers(setKey, function(error, hashKeys) {
    if (hashKeys.length === 0) {
      return callback([]);
    }
    redis.print(error, hashKeys);
    fetchHashes(hashKeys, callback);
  });
}

function insertStops(stops) {
  var hashKeys = stops.map(function(stop) {
    return STOPS_KEY + ':' + stop.stopId;
  });
  insertSetOfHashes(
    STOPS_KEY,
    hashKeys,
    stops,
    STOPS_EXPIRE
  );
}
function fetchAllStops(callback) {
  fetchSetOfHashes(STOPS_KEY, function(stops) {
    var stops = stops.map(transformStop);
    callback(stops);
  });
}
function fetchStops(stopIds, callback) {
  var hashKeys = stopIds.map(function(stopId) {
    return STOPS_KEY + ':' + stopId;
  });
  fetchHashes(hashKeys, function(stops) {
    var stops = stops.map(transformStop);
    callback(stops);
  });
}

function insertStopCalls(stopId, stopCalls, expire) {
  var setKey = STOP_CALLS_KEY + ':' + stopId;
  var hashKeys = stopCalls.map(function(stopCall) {
    return setKey +
      ':' + stopCall.lineName +
      ':' + stopCall.scheduledArrivalTime;
  });
  insertSetOfHashes(
    setKey,
    hashKeys,
    stopCalls,
    STOP_CALLS_EXPIRE
  );
}

function fetchStopCalls(stopId, callback) {
  fetchSetOfHashes(
    STOP_CALLS_KEY + ':' + stopId,
    function(stopCalls) {
      callback(stopCalls);
    }
  );
}

function insertTrip(tripId, trip) {
  var setKey = TRIPS_KEY + ':' + tripId;
  var multi = redisClient.multi();
  trip.forEach(function(stopCall) {
    console.log(stopCall);
    multi.zadd(
      setKey,
      stopCall.scheduledArrivalTime,
      stopCall.stopId
    );
  });
  multi.expire(setKey, TRIPS_EXPIRE);
  multi.exec(function(error, replies) {
    redis.print(error, replies);
  });
}

function fetchTrip(tripId, callback) {
  setKey = TRIPS_KEY + ':' + tripId;
  redisClient.zrange(
    setKey, 0, -1,
    'WITHSCORES',
    function(error, trip) {
      redis.print(error, trip);
      callback(transformTrip(trip));
    }
  );
}

function allStops(callback) {
  fetchAllStops(function(stops) {
    if (stops.length === 0) {
      return bristolAPI.getAllStops(function(stops) {
        insertStops(stops);
        callback(stops);
      });
    }
    callback(stops);
  });
}

function stops(stopIds, callback) {
  console.log(stopIds);
  fetchStops(stopIds, function(stops) {
    var anyMissing = stops.some(function(stop) {
      return stop === null;
    });
    if (anyMissing) {
      var hashKeys = stopIds.map(function(stopId) {
        return STOPS_KEY + ':' + stopId;
      });
      return bristolAPI.getStops(stopIds, function(stops) {
        insertStops(stops);
        callback(stops);
      });
    }
    callback(stops);
  });
}

function stop(stopId, callback) {
  stops([stopId], callback);
}

function stopCalls(stopId, callback) {
  fetchStopCalls(stopId, function(stopCalls) {
    if (stopCalls.length === 0) {
      return bristolAPI.getStopCalls(
        stopId,
        (STOP_CALLS_EXPIRE / 60) * 2,
        function(stopCalls) {
          insertStopCalls(stopId, stopCalls);
          callback(stopCalls);
        }
      );
    }
    callback(stopCalls);
  });
}

function stopCall(stopId, lineName, scheduledArrivalTime, callback) {
  var hashKey = 
  STOP_CALLS_KEY +
    ':' + stopId +
    ':' + lineName +
    ':' + scheduledArrivalTime;
  redisClient.hgetall(
    hashKey,
    function(error, stopCall) {
      console.log(hashKey);
      redis.print(error, stopCall);
      callback(stopCall);
    }
  );
}

function trip(tripId, callback) {
  fetchTrip(tripId, function(trip) {
    if (trip.length === 0) {
      return bristolAPI.getTrip(tripId, function(trip) {
        insertTrip(tripId, trip);
        callback(trip);
      });
    }
    callback(trip);
  });
}

function tripStopCalls(tripId, callback) {
  trip(tripId, function(trip) {
    var stopIds = trip.map(function(stopCall) {
      return stopCall.stopId;
    });
    stops(stopIds, function(stops) {
      for (var i = 0; i < stops.length; i++) {
        stops[i].scheduledArrivalTime = trip[i].scheduledArrivalTime;
      }
      callback(stops);
    });
  });
}

function insertSample(sample, callback) {
  var setKey = SAMPLES_KEY +
    ':' + sample.stopId;
  var score = sample.timestamp;
  var hashKey = SAMPLES_KEY +
    ':' + sample.stopId +
    ':' + sample.tripId +
    ':' + sample.timestamp;
  var multi = redisClient.multi();
  multi.hmset(hashKey, sample);
  multi.zadd(setKey, score, hashKey);
  multi.exec(function(error, reply) {
    redis.print(error, reply); 
    callback();
  });
}

function fetchSamples(stopId, callback) {
  var setKey = SAMPLES_KEY +
    ':' + stopId;
  redisClient.zrange(setKey, 0, -1, function(error, sampleKeys) {
    redis.print(error, sampleKeys);
    var multi = redisClient.multi();
    sampleKeys.forEach(function(hashKey) {
      multi.hgetall(hashKey);
    });
    multi.exec(function(error, samples) {
      redis.print(error, samples);
      callback(samples.map(transformSample));
    });
  });
}

module.exports = {
  allStops: allStops,
  stop: stop,
  stops: stops,
  stopCalls: stopCalls,
  stopCall: stopCall,
  trip: trip,
  tripStopCalls: tripStopCalls,
  insertSample: insertSample,
  fetchSamples: fetchSamples,
};
