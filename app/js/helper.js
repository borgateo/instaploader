
const _ = require('lodash');
const Promise = require('bluebird');
const fs = require('fs');
const jsonfile = require('jsonfile');


var Client = require('instagram-private-api').V1;
const Conf = require('../config/config-app.js');
const currentUser = Conf.user;

const device = new Client.Device( currentUser.username );
const storage = new Client.CookieFileStorage('./app/cookies/'+ currentUser.username +'.json');
const session = new Client.Session(device, storage);

//-------------------------------------------------
/*
function login() {

  // And go for login
  Client.Session.create( device, storage, currentUser.username, currentUser.password )
    .then(function( session ) {
      console.log('this is your session', session );
    })
  ;
}

function account( callback ) {
    let id;

    storage.getAccountId() 
      .then(function(accountId){
        console.log(accountId);
        id = accountId;
        console.log( id );
      });

    session.getAccount()
      .then(function( account ) {
        console.log('account', account);
    });

    Client.Relationship.get(session, 25025320)
      .then(function( relationship ) {
        console.log('what?', relationship);
      })
    ;
}
*/

export const me = currentUser;
export const hashtags = Conf.hashtags;

export function upload( file, caption ) {
  if ( !fs.existsSync( file ) ) {
    alert('Forgot to upload a picture?');
    return Promise.reject(new Error('image do not exist!'));
  }

  return Client.Upload.photo( session, file )
    .then(function( uploadObj ) {
      // uploadObj instanceof Client.Upload
      // nothing more than just keeping uploadObj id
      console.log( uploadObj.params.uploadId );
      return Client.Media.configurePhoto( session, uploadObj.params.uploadId, caption );
    })
    .then(function( medium ) {
      logEvent( caption );
      return Promise.resolve( medium.params );
    })
  ;
}

function logEvent( caption ) {
  let logFile = Conf.logfile;
  let logJSON = {};
  let jsonDate = (new Date()).toJSON();
  let date = new Date(jsonDate);

  jsonfile.readFile(logFile, function(err, obj) {

    if ( err ) {
      // json is empty, initialize it
      logJSON = {"logs":[{
        'id': 0,
        'date': date,
        'description': caption
      }]};

    } else {

      logJSON = obj;

      let lastEntry = logJSON.logs[ logJSON.logs.length-1 ];
      let id = +lastEntry.id + 1;

      logJSON.logs.push({
        'id': id,
        'date': date,
        'description': caption
      });  
    }

    jsonfile.writeFile(logFile, logJSON, function (err) {
      if ( err ) throw err;
      console.info('Event Logged into log.json')
    });

  });
}

