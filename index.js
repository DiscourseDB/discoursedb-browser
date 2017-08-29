
/*
 *    Initialization of panes, trees, tables
 */
var baseUrl = "https://localhost:5980";
$(function () {
  layout = $('body').layout({applyDefaultStyles: true });
  layout.options.north.resizeable = false;
  layoutEast = $('#eastpanel').layout({
      north__paneSelector: ".queries",
      center__paneSelector: ".io",
      applyDefaultStyles: true
  });

  $('#jstree_annos').jstree({
    "plugins" : [ "checkbox" ]
    });
  $('#jstree_dps').on('changed.jstree', function (eventt, objj) {
    update_grid(objj.selected);
  });
  $('.ellipsis').on('click', function () {
      $(this).toggleClass('nonellipsis')
      $(this).toggleClass('ellipsis')
  });
  $('.nonellipsis').on('click', function () {
      $(this).toggleClass('nonellipsis')
      $(this).toggleClass('ellipsis')
  });
});
$(document).ready(function() {

});


/*
*  Refresh the list of saved queries
*/
var query_list_refresh = function () {
  var ql = $('#query_list');
  $.ajax({
    type: 'GET',
    xhrFields: { withCredentials: ($.access_token != null) },
    beforeSend: function (xhr) {
              xhr.setRequestHeader("Authorization", "BEARER " + $.access_token);
    },
    url: 'https://localhost:5980/browsing/prop_list?ptype=query'}).done(
    function(datback) {
         html = '<pre>';
         $.each(datback, function(i, item) {
           html += item.propName + '<br/>';
         });
         html += '</pre>';
         ql.html(html);
    });


}


/*
*    Refresh the discourse part tree
*/
$("#refreshTree").on('click', function() {
  $('#jstree_dps').jstree(true).refresh();
});
var current_context = new Object();
var dp_tree_refresh = function() {
  $('#jstree_dps').jstree({
      core: {
        data: {
          context: current_context,
          url: function (node) {
            /* # -> root;    /browsing/stats
             * D/1 -> Discourse 1 p1 of 1       /browsing/discourses/1
             * DT/1/3/2   -> Disc 1 type 3 p2   /browsing/discourses/1/discoursePartTypes/3?page=2
             * DP/1/2  -> DiscoursePart 1 page 1   /browsing/subDiscourseParts/1?page=2
             *
             *
             */
            current_context.node_id = node.id;
            if (node.id === '#') { return baseUrl + "/browsing/stats"; }
            var parts = node.id.split("/");
            if (parts[0] === "D") { return baseUrl + "/browsing/discourses/" + parts[1]; }
            if (parts[0] === "DT") { return baseUrl + "/browsing/discourses/" +
                parts[1] + "/discoursePartTypes/" + parts[2] + "?page=" + parts[3]; }
            if (parts[0] === "DP") { return baseUrl + "/browsing/subDiscourseParts/" + parts[1]
                    + "?page=" + parts[2]; }
          },
          /*data: function(node) {
            console.log("In data.data");
            console.log(node);
            return {'id': node.id, 'text': "hello"};
          },*/
          type: 'GET',
          xhrFields: { withCredentials: ($.access_token != null) },
          beforeSend: function (xhr) {
                    xhr.setRequestHeader("Authorization", "BEARER " + $.access_token);
          },
          dataFilter: function(data) {
            var obj = JSON.parse(data);
            //console.log(this.node_id);
            //console.log("Got discoursedb top level respons");

            // Data response from
            if (obj._embedded && obj._embedded.browsingDiscoursePartResources) {
              var dps = obj._embedded.browsingDiscoursePartResources;
              //console.log("In here: dps = " + dps.length);
              var retval =
                dps.map(function(dp) {
                  //console.log("Child " + dp.name);
                       return {
                         id : "DP" + "/" + dp.discoursePartId + "/" + 0,
                         text : dp.name,
                         state : {
                           opened : false,
                           disabled : false,
                           selected : false
                         },
                         children: dp.subDiscoursePartCount > 0
                         }});
              if (obj.page.number == 0 && obj.page.totalPages > 1) {
                for(pp = 1; pp<obj.page.totalPages; pp++) {
                   parentparts = current_context.node_id.split("/")
                   parentparts[parentparts.length-1] = pp+parseInt(obj.page.number);
                   retval.push({
                     id: parentparts.join("/"),
                     text: "More (p" + (1+parentparts[parentparts.length-1]) + "/" + obj.page.totalPages + ")",
                     state: { opened: false, disabled: false, selected: false },
                     children: true
                   });
                }
              }
              //console.log(retval);
              return JSON.stringify(retval);
            }
            else if (obj.discourseId) {
              var links = obj._links;
              //console.log("In here: links=", links);
              var retval =
                // List of discoursePartTypes.  Probably don't need to be paged.
                Object.keys(links).map(function(key, index) {
                  //console.log("Child " + index);
                       return {
                         id : "DT" + "/" + obj.discourseId + "/" + key + "/0",
                         text : key,
                         a_attr: {
                              class: "no_checkbox"
                         },
                         state : {
                           opened : false,
                           disabled : false,
                           selected : false
                         },
                         children: true
                       }});

              //console.log(retval);
              return JSON.stringify(retval);
            }
            // Root object.  Text does not appear apparently
            else if (obj._embedded && obj._embedded.browsingStatsResources) {
                var links = obj._embedded.browsingStatsResources[0]._links;
                //console.log("In here: links=", links);
                var retval = [{
                id          : "#", // will be autogenerated if omitted
                text        : "DiscourseDB", // node text
                //icon        : "" // string for custom
                state       : {
                  opened    : true , // is the node open
                  disabled  : false,  // is the node disabled
                  selected  : false  // is the node selected
                },
                children    :
                  // Generate keys of the discourses.
                  Object.keys(links).map(function(key, index) {
                    //console.log("Child " + index);
                         return {
                           id : "D" + "/" + links[key]["href"].split("/").slice(-1)[0],
                           text : key,
                           a_attr: {
                                class: "no_checkbox"
                           },
                           state : {
                             opened : false,
                             disabled : false,
                             selected : false
                           },
                           children: true
                         }})

              }];
              //console.log(retval);
              return JSON.stringify(retval);

            } else {
              console.log("Can't recognize object");
              console.log(obj);
              return JSON.stringify({});
            }

          }
        }
     },
  "plugins" : [ "wholerow", "checkbox" ]
  });
}


/*
 *    Log in, Log out
 */
 function signOut() {
     var auth2 = gapi.auth2.getAuthInstance();
     auth2.signOut().then(function () {
         console.log('User signed out.');
 	       $.access_token = null;
         $("#currentuser").html("Current user: (none)");
         $("#signInButton").show();
         $("#signOutButton").hide();
     });
     return false;
 }

 $("#signOutButton").on('click', function(e) {
    e.preventDefault();
    signOut();
    });

 function onSignIn(googleUser) {
   var profile = googleUser.getBasicProfile();
   console.log('ID: ' + profile.getId()); // Do not send to your backend! Use an ID token instead.
   console.log('Name: ' + profile.getName());
   console.log('Image URL: ' + profile.getImageUrl());
   console.log('Email: ' + profile.getEmail());
   $.access_token = googleUser.getAuthResponse().id_token;
   var dt = new Date().toLocaleString();
   $("#currentuser").html("Current user: " + profile.getName());
   $("#signInButton").hide();
   $("#signOutButton").show();
   query_list_refresh();
   dp_tree_refresh();
 }

 /*
 *   Populate the grid
   https://datatables.net/reference/option/ajax
 */
var firstTime = true;
function update_grid(selected) {
    var query = {
      "rows": {
        "discourse_part":
          selected.map(function(key, index) {
            return key.split("/")[1];
          })
        }
      };
      if (firstTime == false) {
        var api = $('#contributions').dataTable().api();
        api.ajax.url("https://localhost:5980/browsing/query?query=" + encodeURIComponent(JSON.stringify(query)));
        api.ajax.reload();
        api.table.columns.adjust().draw();
      } else {
        $('#contributions').DataTable( {
          serverSide: true,
          autoWidth: true,
          searching: false,
          ordering: false,
          columns: [
            { data: "contributor" },
            { data: "annotations" },
            { data: "type" },
            { data: "content", width:"50%" },
            { data: "title" },
            { data: "discourseParts" },
            { data: "startTime", width:"10%"},
            { data: "parentId" }
          ],
          ajax: {
                url: "https://localhost:5980/browsing/query?query=" + encodeURIComponent(JSON.stringify(query)),
                dataFilter: function(data){
                    var json = jQuery.parseJSON( data );
                    json.recordsTotal = json.page.totalElements;
                    json.recordsFiltered = json.page.totalElements;
                    json.data = json._embedded.browsingContributionResources;

                    return JSON.stringify( json ); // return JSON string
                }
            }
           } );
        $('#contributions').colResizable({
            liveDrag:true,
  	        gripInnerHtml:"<div class='grip'></div>",
  	        draggingClass:"dragging"
        });
        $("#io_accordion").accordion({
             heightStyle:    "fill",
  	         active: 3
        });
        firstTime = false;
      }


 };

function update_grid_medium(selected) {
   var query = {
     "rows": {
       "discourse_part":
         selected.map(function(key, index) {
           return key.split("/")[1];
         })
       }
     };
     var api = $('#contributions').dataTable().api();

     $.ajax({
       type: 'GET',
       xhrFields: { withCredentials: ($.access_token != null) },
       beforeSend: function (xhr) {
                 xhr.setRequestHeader("Authorization", "BEARER " + $.access_token);
       },
       success: function(datback, status, xhr) {
            api.clear();
            console.log(datback);
            datback._embedded.browsingContributionResources.forEach(function(r) {
              api.row.add([r["title"], r["contributor"], "(date)", r["type"]]);
            });

            api.draw();
       },
       url: "https://localhost:5980/browsing/query?query=" + encodeURIComponent(JSON.stringify(query))

     });
};

function update_grid_old(selected) {
  var query = {
    "rows": {
      "discourse_part":
        selected.map(function(key, index) {
          return key.split("/")[1];
        })
      }
    };
    $('#contributions').DataTable( {
      columns: [
        { data: "Contributions" },
        { data: "Author" },
        { data: "Date" },
        { data: "Annotations" },
        { data: "type" },
        { data: "content" },
        { data: "title" },
        { data: "contributor" },
        { data: "discourseParts" },
        { data: "startTime" },
        { data: "annotations" }
      ],
      ajax: {
        url: "https://localhost:5280/browsing/query",
        data: {"query": {}},
        type: "GET",
        dataSrc: function(data) {
          return data._embedded.browsingContributionResources
        }
      }
  } );
}
