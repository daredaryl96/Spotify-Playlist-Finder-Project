const express = require('express'); // Express web server framework
const session = require('express-session');
const request = require('request'); // "Request" library
const ejs = require("ejs");
const cors = require('cors');
const querystring = require('querystring');
const cookieParser = require('cookie-parser');
const bodyParser = require("body-parser");
const app = express();





var client_id = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'; // Your client id
var client_secret = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'; // Your secret
var redirect_uri = 'http://localhost:8888/callback'; // Your redirect uri


app.set('views', './views');
app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json())

app.use(express.static(__dirname + '/public'));
app.use(cors()); 
app.use(cookieParser());
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true
}));

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function(length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

var stateKey = 'spotify_auth_state';

app.get("/", function(req, res) {
  res.render('login');
});


app.get('/login', function(req, res) {

  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  var scope = 'playlist-modify-public';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }));
});

app.get('/callback', function(req, res) {

  // your application requests refresh and access tokens
  // after checking the state parameter

  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (Buffer.from(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    };

    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {

        var access_token = body.access_token,
          refresh_token = body.refresh_token;

          req.session.access_token = access_token;
          req.session.refresh_token = refresh_token;

        var options = {
          url: 'https://api.spotify.com/v1/me',
          headers: {
            'Authorization': 'Bearer ' + access_token
          },
          json: true
        };


        // use the access token to access the Spotify Web API
        request.get(options, function(error, response, body) {
          console.log(body);
        });

       
        res.redirect('/searchpage/' + access_token);
      } else {
        res.redirect('/#' +
          querystring.stringify({
            error: 'invalid_token'
          }));
      }
    });
  }
});

app.get("/searchpage/:access_token", function(req, res) {
  var access_token = req.session.access_token;
  var refresh_token = req.session.refresh_token;
  res.render('searchpage', {
    access_token: access_token,
    refresh_token: refresh_token
  }); 

});


app.post("/searchpage", function(req, res) {
  var access_token = req.session.access_token;
  req.session.data = req.body.playlistTerms;
  res.redirect("/results?access_token=" + access_token);
});


app.get("/results", function(req, res) {
  var playlistTerms = req.session.data;
  var access_token = req.query.access_token; // retrieve access_token from session 
  console.log(req.session); 
  res.render("results", {
    playlistTerms: playlistTerms,
    access_token: access_token
  });
});


app.listen(8888, function() {
  console.log("Server started on port 8888");
});
