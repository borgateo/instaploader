
const _ = require('lodash');
const Promise = require('bluebird');
const fs = require('fs');

var Client = require('instagram-private-api').V1;
const Conf = require('../config/config-app.js');
const currentUser = Conf.user;

const device = new Client.Device( currentUser.username );
const storage = new Client.CookieFileStorage('./app/cookies/'+ currentUser.username +'.json');
const session = new Client.Session(device, storage);


// Expose Public Methods
const utils = {
  login: login,
  account: account,
  updatePlaceholderImage: updatePlaceholderImage,
  upload: upload
};

//-------------------------------------------------

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


function updatePlaceholderImage() {
  if ( !uploadFileBtn.files.length ) {
    return;
  }
  imagePlaceholder.src = uploadFileBtn.files[0].path;
}

function upload() {
  if ( !uploadFileBtn.files.length ) {
    alert('Dude! Forgot something? Where\'s your awesome pic to upload?');
  }

  let file = uploadFileBtn.files[0].path;
  if ( !fs.existsSync( file ) ) {
    alert('file doesn\'t exists!');
    return;
  }

  Client.Upload.photo( session, file )
    .then(function( upload ) {
        // upload instanceof Client.Upload
        // nothing more than just keeping upload id
        console.log(upload.params.uploadId);
        return Client.Media.configurePhoto( session, upload.params.uploadId, uploadTextarea.value );
    })
    .then(function( medium ) {
        // we configure medium, it is now visible with caption
        console.log(medium.params);
    })
  ;
}


if ( typeof module !== "undefined" && module.exports ) {
  module.exports = utils;
}