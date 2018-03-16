
 function GoogleSignIn(googleUser) {
   var profile = googleUser.getBasicProfile();
   console.log('ID: ' + profile.getId()); // Do not send to your backend! Use an ID token instead.
   console.log('Name: ' + profile.getName());
   console.log('Image URL: ' + profile.getImageUrl());
   console.log('Email: ' + profile.getEmail());
   authorizer.access_token = "BEARER " + googleUser.getAuthResponse().id_token;
   authorizer.status = "google";
   authorizer.name = profile.getName();
   $.ajaxSetup({
     xhrFields: { withCredentials: (authorizer.access_token != null) },
     headers: {
        'Authorization': authorizer.access_token
      }});
   authorizer["serviceSignout"] = function () {
     console.log("Initiating logout promise");

     return new Promise(function(g,b) {
       var auth2 = gapi.auth2.getAuthInstance();
       auth2.signOut().then(function () {
         console.log('User signed out of google.');
         deauth();
         g();
       });
   })};
   authorizer["onSignIn"](profile.getName());
 }

function deauth() {
  $.ajax({type: 'GET',url: baseUrl + '/browsing/logout'})
  $.ajaxSetup({xhrFields:{withCredentials:false}, headers: { 'Authorization': "" }});
  authorizer.access_token = null;
  authorizer.name = "(none)";
  authorizer.status = "unauthorized";
  authorizer.basicUser = "";
  authorizer.basicPass = "";
}

function BasicSignIn(googleUser) {
   authorizer.basicUser = $('input#basicUser')[0].value;
   authorizer.basicPass = $('input#basicPass')[0].value;
   authorizer.status = "basic";
   authorizer.name = authorizer.basicUser;
   authorizer.access_token = "Basic " + btoa(authorizer.basicUser + ":" + authorizer.basicPass)
   $.ajaxSetup({
     xhrFields: { withCredentials: true },
     headers: {
        'Authorization': authorizer.access_token
      }});
   console.log('basicUser: ');
   console.log(basicUser);
   authorizer["serviceSignout"] = function() { return new Promise(function(g,b) {
       console.log('User signed out of basic.');
       deauth();
       g();
   }); }
   authorizer["onSignIn"](authorizer.basicUser);
 }

 console.log("Doing this stuff");
 window.authorizer = {
   "status": "unauthorized",   // or: google, github, basic, incommon, if logged in
   "name": "",
   "onSignIn": function(name) { console.log(name) },
   "serviceSignout": function() { return new Promise(function(g,b) { console.log("Signing out"); deauth(); g(); }) }
 }
 console.log("window.authorizer=", window.authorizer);
