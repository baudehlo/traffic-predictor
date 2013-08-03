"use strict";

var request = require('request');
var cheerio = require('cheerio');
var async   = require('async');
var moment  = require('moment');
var twitter = require('simple-twitter');
var twitkeys = require('./twitterkeys');

/* Process:

 * Fetch event data
 * Get events for tomorrow
 * Assign a fucked-uppery to it
 * Tweet or Email it
*/

main();

function main () {
    fetch_event_data();
}

function fetch_event_data () {
    async.parallel([
        fetch_amphitheatre,
        fetch_skydome,
        fetch_acc,
        fetch_bmo_field,
        // fetch_fort_york,
        // fetch_road_closures,
    ],
    process_results
    )
}

function fetch_amphitheatre (cb) {
    var url = 'http://www.livenation.com/venues/14878/molson-canadian-amphitheatre';
    
    var tomorrow_format = moment().add('days', 1).format('YYYY-MM-DD');
    
    request.get(url, function (err, r, body) {
        if (err) {
            return cb("Error fetching amphitheatre: " + err);
        }
        var $ = cheerio.load(body, {lowerCaseTags: true});
        
        var entries = $('ul.showlist.upcoming li');
        var show = null;
        entries.each(function (i, el) {
            if (show) return;
            var $el = $(el);
            var attr = $el.attr('data-local-start-time');
            if (attr.indexOf(tomorrow_format) != -1) {
                show = $el.find('div.show').text().trim();
            }
        });
        if (show) {
            console.log("Found show: " + show);
            return cb(null, show);
        }
        console.log("Found no shows matching " + tomorrow_format);
        return cb();
    })
}

function fetch_ticketmaster (venue_id, cb) {
    var url = 'http://www.ticketmaster.ca/json/search/event?vid=' + venue_id;
    
    var tomorrow_format = moment().add('days', 1).format('YYYY-MM-DD');
    
    request.get(url, {json: true}, function (err, r, data) {
        if (err) {
            return cb("Error fetching ticketmaster venue: " + venue_id + ": " + err);
        }
        // console.log(data.response.docs);
        var events = data.response.docs;
        var show = null;
        for (var i=0; i<events.length; i++) {
            if (events[i].EventDate.indexOf(tomorrow_format) != -1) {
                show = events[i].EventName;
                break;
            }
        }
        return cb(null, show);
    });
}

function fetch_skydome (cb) {
    fetch_ticketmaster(131114, cb);
}

function fetch_acc (cb) {
    fetch_ticketmaster(131157, cb);
}

function fetch_bmo_field (cb) {
    fetch_ticketmaster(131713, cb);
}

function fetch_fort_york (cb) {
    var url = 'http://www.fortyork.ca/news-a-events/events.html';
    
    return cb();
}

function fetch_road_closures (cb) {
    return cb();
}

var fuckage = [
    'probably fine',
    'a bit shitty',
    'shitty',
    'fucking awful',
    'a fucking parking lot',
];

function process_results (err, results) {
    console.log("Results: ", results);
    var found = 0;
    for (var i=0; i<results.length; i++) {
        if (results[i]) found++;
    }
    
    if (found > 4) found = 4;
    
    var tomorrow_format = moment().add('days', 1).format('ddd, MMM Do');
    
    var status = "On " + tomorrow_format + 
                 " in the evening the Gardiner will probably be " + 
                 fuckage[found];
    
    var twit = new twitter(
        twitkeys.consumer_key,
        twitkeys.consumer_secret,
        twitkeys.access_token,
        twitkeys.access_token_secret,
        false
    );
    
    twit.post('statuses/update', {status: status}, function (err, data) {
        if (err) {
            return console.log("Error posting to twitter: ", err);
        }
        console.log(data);
    });
}
