/*jshint node:true,expr:true*/
'use strict';

var http = require('spas-http')
  , async = require('async');

var LIST_FEED_SCHEMA = 'http://schemas.google.com/spreadsheets/2006#listfeed';
var CELL_FEED_SCHEMA = 'http://schemas.google.com/spreadsheets/2006#cellsfeed';
var VISUALIZATION_SCHEMA = 'http://schemas.google.com/visualization/2008#visualizationApi';
var EXPORT_CSV_SCHEMA = 'http://schemas.google.com/spreadsheets/2006#exportcsv';

/**
 * Return the link to a feed by schema type.
 * @param  {Object} entry     The entry from Sheets API's response.
 * @param  {String} type      The schema type of the feed.
 * @return {String|undefined} The URL to the feed.
 */
function getLinkByType(entry, type) {
  var links = entry.link, link;
  for(var i=0, l=links.length; i<l; i++) {
    link = links[i];
    if (link.rel === type) {
      return link.href;
    }
  }
}
/**
 * Retrieves cell-based feed from a worksheet.
 * @param {Object}    params      A hash of params
 * @param {id}        params.id The sheet's ID.
 * @param {String}    params.worksheet The worksheet number.
 * @param {Boolean}   params.reverse True to return data in reversed.
 * @param {String}    params.orderby Name of column to sort by.
 * @param {String}    params.sq Structured query to filter the rows.
 * @param {Number}    params.min-row Starting row to fetch from.
 * @param {Number}    params.max-row End row to fetch from.
 * @param {Number}    params.min-col Starting column to fetch from.
 * @param {Number}    params.max-col End column to fetch from.
 * @param {String}    params.visibility 'public' || 'private'
 * @param {String}    params.projection 'full' || 'basic'
 * @param {String}    params.alt Format of results. Default to XML.
 * @param {Object}    credentials A hash of credentials
 * @param {Function}  callback    Function to called for data.
 */
function getCells(params, credentials, callback) {
  if (!params.url) {
    var urlSegments = ['https://spreadsheets.google.com/feeds'];

    var worksheetId = params.worksheet;
    urlSegments.push('cells');

    urlSegments.push(params.id);
    urlSegments.push(params.worksheet);

    urlSegments.push(params.visibility || 'public');
    urlSegments.push(params.projection || 'full');

    params.url = urlSegments.join('/');
  }

  http.request(params, credentials, function(error, results) {
    if (error) {
      console.error(error);
      return callback(error, null);
    }

    var feed = results.feed;
    var cells = feed.entry.map(function(cell) {
      return {
        "updated": cell.updated.$t,
        "row": cell.gs$cell.row,
        "col": cell.gs$cell.col,
        "inputValue": cell.gs$cell.inputValue,
        "value": cell.gs$cell.$t
      };
    });

    results = {
      "updated": feed.updated.$t,
      "title": feed.title.$t,
      "author": feed.author.map(function(author) {
        return {
          "name": author.name.$t,
          "email": author.email.$t
        };
      }),
      "entry": cells
    };

    callback(null, results);
  });
}

/**
 * Get all cells from a Spreadsheet, grouped by worksheet.
 * @param  {Object}   params      Parameters to pass to `getCells`.
 * @param  {Object}   credentials Credentials to send to API.
 * @param  {Function} callback    Called when all data are retrived.
 */
function getWorksheets(params, credentials, callback) {
  var urlSegments = ['https://spreadsheets.google.com/feeds'];
  urlSegments.push('worksheets');
  urlSegments.push(params.id);
  urlSegments.push(params.visibility || 'public');
  urlSegments.push(params.projection || 'full');

  params.url = urlSegments.join('/');

  // Retrieve the list of worksheets for this spreadsheet.
  http.request(params, credentials, function(error, results) {
    if (error) {
      console.error(error);
      return callback(error, null);
    }

    var entries = results.feed.entry;
    async.map(entries, function(entry, done) {
      var copy = Object.assign({}, params);
      copy.url = getLinkByType(entry, CELL_FEED_SCHEMA);
      getWorksheet(copy, credentials, done);
    }, callback);
  });
  
}

exports.worksheets = getWorksheets;
exports.worksheet = getCells;