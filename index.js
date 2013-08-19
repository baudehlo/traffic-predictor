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

/* TODO
 * Fetch road closures from http://www.toronto.ca/transportation/road_info/index.htm - hard to parse as some are partial closures
 * Use weather as a heuristic
*/

var process_day = moment().add('days', 1);

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
        fetch_fort_york,
        fetch_the_ex,
        // fetch_road_closures,
    ],
    process_results
    )
}

function fetch_the_ex (cb) {
    var start = moment("Aug 16, 2013");
    var end   = moment("Sep 2, 2013");


    if (process_day > start && process_day <= end) {
        return cb(null, "The Ex");
    }
    return cb();
}

function fetch_amphitheatre (cb) {
    var url = 'http://www.livenation.com/venues/14878/molson-canadian-amphitheatre';
    
    var tomorrow_format = process_day.format('YYYY-MM-DD');
    
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
    
    var tomorrow_format = process_day.format('YYYY-MM-DD');
    
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

var reasons = [
    'Amp', 'Sky', 'ACC', 'BMO', 'FTY', 'Ex', 'CLO',
];

function process_results (err, results) {
    console.log("Results: ", results);
    var found = 0;
    var reason = '';
    for (var i=0; i<results.length; i++) {
        if (results[i]) found++;
        if (results[i]) reason += reasons[i] + ' '
    }
    
    if (found > 4) found = 4;
    
    var tomorrow_format = process_day.format('ddd, MMM Do');
    
    var status = "On " + tomorrow_format + 
                 " in the evening the Gardiner will probably be " + 
                 fuckage[found];
    
    if (reason.length) {
        status += ' (' + reason.trim() + ')';
    }
    
    if (process.env.NOTWEET) {
        console.log(status);
        return;
    }

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
