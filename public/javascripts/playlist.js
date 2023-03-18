var access_token = accessToken

var maxPlaylists = 100;
var maxPlaylistsToDisplay = 100;
var credentials = null;

var totalTracks = 0;
var totalPlaylistCount = 0;

var abortFetching = false;
var popNormalize = false;

var allPlaylists = [];
var topTracks = null;
var allTracks = {};


function error(s) {
  info(s);
}

function info(s) {
  $("#info").text(s);
}

function callSpotify(url, data) {
  return $.ajax(url, {
    dataType: 'json',
    data: data,
    headers: {
      'Authorization': 'Bearer ' + access_token
    }
  });
}

function postSpotify(url, json, callback) {
  $.ajax(url, {
    type: "POST",
    data: JSON.stringify(json),
    dataType: 'json',
    headers: {
      'Authorization': 'Bearer ' + access_token,
      'Content-Type': 'application/json'
    },
    success: function(r) {
      callback(true, r);
    },
    error: function(r) {
      // 2XX status codes are good, but some have no
      // response data which triggers the error handler
      // convert it to goodness.
      if (r.status >= 200 && r.status < 300) {
        callback(true, r);
      } else {
        callback(false, r);
      }
    }
  });
}

function findMatchingPlaylists(text) {
  var outstanding = 0;

  function addItem(tbody, which, item) {
    var tr = $("<tr>");
    var rowNumber = $("<td>").text(which);
    var title = $("<td>").append($("<a>").attr('href', item.uri).text(item.name));
    var tracks = $("<td>").text(item.tracks.total);
    tr.append(rowNumber);
    tr.append(title);
    tr.append(tracks);
    $("#playlist-item").append(tr);
    tbody.append(tr);
  }

  function showSearchResults(data) {
    outstanding--;

    var matching = data.playlists.total > maxPlaylists ? ">" +
      maxPlaylists : data.playlists.total;
    $("#matching").text(matching);
    var tbody = $("#playlist-items");
    _.each(data.playlists.items, function(item, which) {
      if (true || !item.collaborative) {
        if (allPlaylists.length < maxPlaylistsToDisplay) {
          addItem(tbody, data.playlists.offset + which + 1, item);
        }
        if (allPlaylists.length < maxPlaylists) {
          allPlaylists.push([item.owner.id, item.id]);
          totalTracks += item.tracks.total;
        }
      } else {}
    });

    var totalPlaylists = allPlaylists.length;
    var total = Math.min(data.playlists.total, maxPlaylists);
    var percentComplete = Math.round(totalPlaylists * 100 / total);

    $(".total-tracks").text(totalTracks);
    $(".total-playlists").text(totalPlaylists);
    $("#playlist-progress").css('width', percentComplete + "%");

    if (abortFetching || outstanding == 0) {
      abortFetching = false;
      if (totalPlaylists > 0) {
        $('#fetch-tracks-ready').show(200);
      } else {
        info("No matching playlists found");
        $('#fetch-tracks-ready').show(200);
      }
    }
  }

  function processPlaylistError() {
    outstanding--;
    error("Can't get playlists");
  }

  function processPlaylists(data) {
    var total = Math.min(data.playlists.total, maxPlaylists);
    var offset = data.playlists.offset + data.playlists.items.length;
    for (var i = offset; i < total; i += 50) {
      var url = 'https://api.spotify.com/v1/search';
      var params = {
        q: text,
        type: 'playlist',
        limit: data.playlists.limit,
        offset: i
      };
      outstanding++;
      callSpotify(url, params).then(showSearchResults, processPlaylistError);
    }
    showSearchResults(data);
  }

  totalTracks = 0;
  abortFetching = false;
  allPlaylists = [];
  $('#fetch-tracks-ready').hide();

  var url = 'https://api.spotify.com/v1/search';
  var params = {
    q: text,
    type: 'playlist',
    limit: 50
  };
  var offset = 0;
  $("#playlist-items").empty();
  outstanding++;
  callSpotify(url, params).then(processPlaylists, processPlaylistError);
}

// This function to execute after input has submitted through "Find Playlist button"
function go() {
  var text = serverData;
  console.log(text);
  if (text.length > 0) {
    info("");
    $(".results").hide();
    $("#playlist-table").show();
    findMatchingPlaylists(text);
  } else {
    $(".results").hide();
    info("Enter some keywords first");
  }
}


function new_getTrackScore(track) {
  if (popNormalize) {
    var factor = track.popularity > 30 ? track.popularity : 30;
    factor = factor * factor;
    var score = 1000. * track.count / factor;
    return score;
  } else {
    return track.count;
  }
}

function getTrackScore(track) {
  //return old_getTrackScore(track);
  return new_getTrackScore(track);
}

function refreshTrackList(allTracks) {
  info("");

  var tracks = [];
  _.each(allTracks, function(track, id) {
    track.score = getTrackScore(track);
    tracks.push(track);
  });
  tracks.sort(function(a, b) {
    return b.score - a.score;
  });

  topTracks = tracks.slice(0, 100);
  var table = $("#track-items");
  var newRows = [];
  _.each(topTracks, function(track, i) {
    var tr = $("<tr>");
    tr.append($("<td>").text(i + 1));
    tr.append($("<td>").append($("<a>").attr('href', track.uri).text(track.name)));
    tr.append($("<td>").text(track.artists[0].name));
    tr.append($("<td>").text(Math.round(track.score)));
    newRows.push(tr);
  });
  table.empty().append(newRows);
}

function saveTidsToPlaylist(playlist, tids) {
  var url = "https://api.spotify.com/v1/users/" + playlist.owner.id +
    "/playlists/" + playlist.id + '/tracks';

  postSpotify(url, {
    uris: tids
  }, function(ok, data) {
    if (ok) {
      info("Playlist saved");
      $("#ready-to-save").hide(100);
      $("#playlist-name").attr('href', playlist.uri);
    } else {
      error("Trouble saving to the playlist");
    }
  });
}

function savePlaylist() {nodemon
  var title = getPlaylistTitle();
  var tids = [];

  _.each(topTracks, function(track, i) {
    tids.push(track.uri);
  });

  var url = "https://api.spotify.com/v1/users/" + access_token.user_id + "/playlists";
  var json = {
    name: title
  };

  postSpotify(url, json, function(ok, playlist) {
    if (ok) {
      saveTidsToPlaylist(playlist, tids);
    } else {
      error("Can't create the new playlist");
    }
  });
}

function getPlaylistTitle() {
  return "Top " + serverData + " tracks";
}


function fetchAllTracksFromPlaylist() {
  var start = new Date().getTime();
  $(".results").hide();
  $("#track-table").show();
  $("#ready-to-save").hide();
  $("#fetching-tracks").show();

  allTracks = {};

  var queue = allPlaylists.slice(0);
  var totalTracks = 0;
  totalPlaylistCount = 0;

  function isGoodPlaylist(items) {
    // good playlist needs multiple artists and
    // multiple albums
    var albums = {};
    var artists = {};

    _.each(items, function(item) {
      if (item.track) {
        var track = item.track;
        var rid = track.album.id;
        var aid = track.artists[0].id;
        albums[rid] = rid;
        artists[aid] = aid;
      }
    });
    return Object.keys(albums).length > 1 && Object.keys(artists).length > 1;
  }


  function doneFetching() {
    abortFetching = false;
    $("#fetching-tracks").hide(100);
    if (topTracks.length == 0) {
      info("No matching tracks found");
    } else {
      $("#ready-to-save").show();
    }
    var end = new Date().getTime();
    var total = end - start;
    console.log('delta time', total, 'len',
      allPlaylists.length, 'per 1000', Math.round(total / allPlaylists.length));

  }

  var outstanding = 0;
  var maxSimultaneous = 10;

  function fetchNextTracksFromPlaylist() {
    while (!abortFetching && queue.length > 0 && outstanding < maxSimultaneous) {
      var tinfo = queue.pop(0);
      var user = tinfo[0];
      var pid = tinfo[1];

      var url = "https://api.spotify.com/v1/users/" +
        user + "/playlists/" + pid + "/tracks";
      outstanding++;
      callSpotify(url).then(
        function(data) {
          var remaining = outstanding + queue.length;
          var progress = Math.round(100.0 - (100.0 * remaining / allPlaylists.length));

          $("#track-progress").css('width', progress + "%");
          $("#tt-total-tracks").text(totalTracks);
          $("#tt-unique-tracks").text(Object.keys(allTracks).length);
          if (isGoodPlaylist(data.items)) {
            totalPlaylistCount += 1;
            _.each(data.items, function(item, i) {
              var count = i == 0 ? 3 : i <= 2 ? 1 : 1;
              if (item.track) {
                if (item.track.id) {
                  if (!(item.track.id in allTracks)) {
                    allTracks[item.track.id] = item.track;
                    allTracks[item.track.id].count = 0;
                  }
                  allTracks[item.track.id].count += count;
                  totalTracks += 1;
                }
              }
            });
          } else {}

          refreshTrackList(allTracks);

          --outstanding;
          if (outstanding <= 0 && (abortFetching || queue.length == 0)) {
            doneFetching();
          } else {
            fetchNextTracksFromPlaylist();
          }
        },

        function() {
          error("trouble fetching tracks");
          --outstanding;
          if (outstanding <= 0 && (abortFetching || queue.length == 0)) {
            doneFetching();
          } else {
            fetchNextTracksFromPlaylist();
          }
        }
      );
    }
  }
  fetchNextTracksFromPlaylist();
}

function initApp() {

  $(".stop-button").on('click', function() {
    abortFetching = true;
  });

  $("#fetch-tracks").on('click', function() {
    fetchAllTracksFromPlaylist();
  });

  $("#save-button").on('click', function() {
    savePlaylist();
  });

  $("#norm-for-pop").on('click', function() {
    popNormalize = $("#norm-for-pop").is(':checked');
    refreshTrackList(allTracks);
  });
}

function getTime() {
  return Math.round(new Date().getTime() / 1000);
}


$(function() {
  initApp();
  go();
});