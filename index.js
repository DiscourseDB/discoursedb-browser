
var baseUrl = "https://localhost:5980";
var model = {
  server_query_list: [],
  current_server_query_name: "",
  query_saved_state: "working",
  query_content: { rows: { discourse_part: [] }, },


  /*checkboxes2query_content(dpIdList, lookupDpIdName) {
    this.query_content.rows.discourse_part =
          dpIdList.map(function(key) {
            return { name: lookupDpIdName(key), dpid: key.split("/")[1] };
          })
  },*/
  query_content2dplist() {
    return this.query_content.rows.discourse_part.map(function(key) {
      return key["dpid"];
    })
  },
  find_server_query(name) {
    for (q in model.server_query_list) {
      if (model.server_query_list[q]["propName"] === name) {
          return JSON.parse(model.server_query_list[q]["propValue"]);
      }
    }
  },
  remove_query_item(dpid) {
    this.query_content.rows.discourse_part =
       this.query_content.rows.discourse_part.
          filter(function(i) { return i.dpid !== dpid; })
  },
  add_query_item(dpId, dpName) {
    this.remove_query_item(dpId);
    this.query_content.rows.discourse_part.push({dpid: dpId, name: dpName});
  }
}

var triggers = {
  pauseGridUpdate: false,
  query_content_changed() { if (!this.pauseGridUpdate) { set_selections_from_query(); update_grid(); set_query_buttons(); }   },
  server_query_list_changed() { show_server_query_list(); },
  save_query_clicked() { upload_query_to_server(); },
  after_upload_query_to_server() { query_list_refresh(); },
  initialization() { setup_components(); },
  query_selection_change() {  set_selections_from_query();  this.query_content_changed(); },
  jtree_expand_node() { set_selections_from_query(); },
}

set_query_buttons = function() {
    $('#save_query').prop('disabled', model.query_content.rows.discourse_part.length == 0);
}


myprompt = function(question) {
  return new Promise(function(g,b) {
    var ans = window.prompt(question);
    if (ans == undefined) { b("Cancel"); }
    else { g(ans); }
  });
}

upload_query_to_server = function() {
  myprompt('Please name this selection of ' +
      model.query_content.rows.discourse_part.length +
      ' discourse parts').then(function(newname) {
        $.ajax({
          type: 'GET',
          xhrFields: { withCredentials: ($.access_token != null) },
          beforeSend: function (xhr) {
                    xhr.setRequestHeader("Authorization", "BEARER " + $.access_token);
          },
          data: {
            "ptype": "query",
            "pname": newname,
            "pvalue": JSON.stringify(model.query_content)
          },
          url: baseUrl + '/browsing/prop_add'}).done(
          function(datback) {
               triggers.after_upload_query_to_server();
          });
        });
}



$(function () {
  triggers.initialization();
});
$(document).ready(function() {

});

/*
 *    Initialization of panes, trees, tables
 */
setup_components = function() {
  layout = $('body').layout({applyDefaultStyles: true });
  layout.options.north.resizeable = false;
  layoutEast = $('#eastpanel').layout({
      north__paneSelector: ".queries",
      center__paneSelector: ".io",
      applyDefaultStyles: true
  });
  $('#dps_tabs').tabs();
  $('#jstree_annos').jstree({ "plugins" : [ "checkbox" ] });

  $('#jstree_dps').on('changed.jstree', function (eventt, objj) {
    console.log("JTREE", eventt);
    var tree = $('#jstree_dps').jstree(true);
    if (objj.node.state.selected && objj.node.id.startsWith("DP/")) {
      model.add_query_item(objj.node.id.split("/")[1], objj.node.text);
    } else {
      model.remove_query_item(objj.node.id);

    }
    triggers.query_content_changed();
  });
  $("#jstree_dps").on("open_node.jstree", function (e, data) {
    triggers.jtree_expand_node  ();
  });
  $('#save_query').on('click', function (eventt, objj) {
    triggers.save_query_clicked();
  });
  $('#query_list').on('change', function (eventt) {
    model.query_content = model.find_server_query(eventt.currentTarget.value);
    triggers.query_selection_change();
  });
  $(document).on('click', '.ellipsis', function () {
      $(this).toggleClass('nonellipsis')
      $(this).toggleClass('ellipsis')
  });
  $(document).on('click', '.nonellipsis', function () {
      $(this).toggleClass('nonellipsis')
      $(this).toggleClass('ellipsis')
  });
  $(document).on('click', '.removeQueryItem', function(eventt, objj) {
      model.remove_query_item(eventt.target.getAttribute("dpid"));
      triggers.query_selection_change();
  });
}


set_selections_from_query = function() {
  // DONE: Add some secondary text to the query format
  // DONE: learn how to set checkboxes without knock-on effects; turn on here
  // DONE: Why doesn't unchecking work?  Retrieved items just stack up
  // DONE: prettier selection list
  // DONE: copy pretty name into query_content
  // TODO: prop_new should replace if type and name are the same
  // DONE: go through tree and select things that should be selected
  var t = $("#jstree_dps").jstree(true)
  var v = t.get_json('#', {'flat': true});
  var dplist = model.query_content2dplist().map((dpid) => "DP/" + dpid + "/0");
  // DONE: Put count of selected DPs at top. Hyperlink to List tab
  $('#jstree_selection_count').html(dplist.length);
  for (i = 0; i < v.length; i++) {
     var z = v[i];
     triggers.pauseGridUpdate = true;
     if (dplist.includes(z["id"])) {
       t.check_node(z["id"]);
     } else {
       t.uncheck_node(z["id"]);
     }
     triggers.pauseGridUpdate = false;
  }
  // TODO: call this every time a new subtree is opened
  // DONE: also write list to $('#dps_list') along with a delete icon
  var lst = "";
  model.query_content.rows.discourse_part.map(function(dp) {
     lst = lst + '\n<i dpid="' + dp["dpid"] +
        '" class="glyphicon removeQueryItem glyphicon-remove-circle"></i>&nbsp;<span class="ellipsis">'
        + dp["name"] + "</span><br/>";
  });
  $("#list_dps").html(lst);

  // TODO: make delete icon remove from model, and call this function
  //
  //
}


show_server_query_list = function() {
  var ql = $('#query_list');
  html = '<option selected>(no saved query)</option>'
  $.each(model.server_query_list, function(i, item) {
    html += '<option>' + item.propName + '</option>';
  });
  ql.html(html);
}

/*
*  Refresh the list of saved queries
*/
query_list_refresh = function () {
  $.ajax({
    type: 'GET',
    xhrFields: { withCredentials: ($.access_token != null) },
    beforeSend: function (xhr) {
              xhr.setRequestHeader("Authorization", "BEARER " + $.access_token);
    },
    url: baseUrl + '/browsing/prop_list?ptype=query'}).done(
    function(datback) {
         model.server_query_list = datback;
         triggers.server_query_list_changed();
    });
}
/*
*  Refresh the query pane
*    qstate.queries = [list of strings -- names of saved queries]
*    qstate.state = working  OR  saved   <--- default is working
*    qstate.selection = query
*
var query_pane_refresh = function (qstate) {
  var ql = $('#query_list');
  $.ajax({
    type: 'GET',
    xhrFields: { withCredentials: ($.access_token != null) },
    beforeSend: function (xhr) {
              xhr.setRequestHeader("Authorization", "BEARER " + $.access_token);
    },
    url: 'https://localhost:5980/browsing/prop_list?ptype=query'}).done(
    function(datback) {
         html = '<option selected>(no saved query)</option>'
         $.each(datback, function(i, item) {
           html += '<option>' + item.propName + '</option>';
         });
         ql.html(html);
    });
}*/

jstree_node2url = function (node) {
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
}



var dptype2icon = {
  default: { icon: "glyphicon glyphicon-flash" },
  DISCOURSE: { icon: "glyphicon glyphicon-globe" },
  FOLDER: { icon: "glpyicon glyphicon-folder-open" },
  TYPE: { icon: "glyphicon glyphicon-tags" },
  MORE: { icon: "glyphicon glyphicon-plus-sign" },
  FORUM: { icon: "glyphicon glyphicon-bullhorn" },
  SUBFORUM: { icon: "glyphicon glyphicon-comment" },
  LESSON: { icon: "glyphicon glyphicon-list" },
  LESSON_ITEM: { icon: "glyphicon glyphicon-indent-left" },
  MODULE: { icon: "glyphicon glyphicon-list-alt" },
  QUESTION: { icon: "glyphicon glyphicon-question-sign" },
  RESPONSE: { icon: "glyphicon glyphicon-exclamation-sign" },
};


closedChildDiscourse = function(key, linkinf) {
  //console.log("Child " + index);
       return {
         id : "D" + "/" + linkinf["href"].split("/").slice(-1)[0],
         text : key,
         type : "DISCOURSE",
         a_attr: {
              class: "no_checkbox"
         },
         state : {
           opened : false,
           disabled : false,
           selected : false
         },
         children: true
       }
}


/*
 * Create a jstree node for a discourse part type, and the
 * top level list of discourse parts that have that type
 */
dptype2node = function(key,discid) {
  console.log("dptype2node", key, discid);
     return {
       id : "DT" + "/" + discid + "/" + key + "/0",
       text : key,
       type : "TYPE",
       a_attr: {
            class: "no_checkbox"
       },
       state : {
         opened : false,
         disabled : false,
         selected : false
       },
       children: true
     }
   }

/*
 * Create a jstree node for a discourse part and its contents
 */
discoursePartToNode = function(dp) {
  console.log("Type: " + dp.type + " (" + dp.name + ")");
  return {
         id : "DP" + "/" + dp.discoursePartId + "/" + 0,
         text : dp.name,
         type : dp.type,
         state : {
           opened : false,
           disabled : false,
           selected : false
         },
         children: dp.subDiscoursePartCount > 0
       }
};

/* Create a "more pages" jstree node, for when the
 * server returns a multipage result and we don't want to
 * proactively retrieve them all */
extraPages2nodes = function(obj, node) {
  retval = [];
  if (obj.page.number == 0 && obj.page.totalPages > 1) {
    for(pp = 1; pp<obj.page.totalPages; pp++) {
      parentparts = node.split("/")
      parentparts[parentparts.length-1] = pp+parseInt(obj.page.number);
      retval.push({
        id: parentparts.join("/"),
        text: "More (p" + (1+parentparts[parentparts.length-1]) + "/" + obj.page.totalPages + ")",
        type: "MORE",
        a_attr: {
             class: "no_checkbox"
        },
        state: { opened: false, disabled: false, selected: false },
        children: true
      });
   }
  }
  return retval;
}


/* Create a root jstree node */
makeRootObject = function(links) {
    console.log("makerootobject ", links.length);
    return [{
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
      Object.keys(links).map(function(key, index) { return closedChildDiscourse(key, links[key]) })
    }];
}

/* What kind of data did we just get back from the DiscourseDB server? */
identifyRestResponse = function(obj) {
  if (obj._embedded && obj._embedded.browsingDiscoursePartResources) {
    return "DiscoursePartList";
  } else if (obj.discourseId) {
    return "DiscoursePartTypeList";
  } else if (obj._embedded && obj._embedded.browsingStatsResources) {
    return "rootObject";
  } else {
    console.log("Can't recognize object");
    console.log(obj);
    return "Unknown";
  }
}

dpsTopLevelDataFilter = function(data) {
  var obj = JSON.parse(data);
  kind = identifyRestResponse(obj);
  var retval = {};

  console.log("About to gen nodes for ", kind);
  // List of DiscourseParts
  if (kind == "DiscoursePartList") {
    var dps = obj._embedded.browsingDiscoursePartResources;
    retval = dps.map(discoursePartToNode).concat(extraPages2nodes(obj, current_context.node_id));
  }
  // List of discoursePartTypes.  Probably don't need to be paged.
  else if (kind == "DiscoursePartTypeList") {
    retval =
        Object.keys(obj._links).map(function(key, index) { return dptype2node(key, obj.discourseId); });
  }
  // Root object.  Text does not appear apparently
  else if (kind == "rootObject") {
      var links = obj._embedded.browsingStatsResources[0]._links;
      if (links == undefined) { links = {} };
      retval = makeRootObject(links);
  }
  return JSON.stringify(retval);
}





/*
*    Refresh the discourse part tree
*/

var current_context = new Object();
var dp_tree_refresh = function() {
  $('#jstree_dps').jstree({
      core: {
        data: {
          context: current_context,
          url: jstree_node2url,
          type: 'GET',
          xhrFields: { withCredentials: ($.access_token != null) },
          beforeSend: function (xhr) {
                    xhr.setRequestHeader("Authorization", "BEARER " + $.access_token);
          },
          dataFilter: dpsTopLevelDataFilter,
        }
     },
  types: dptype2icon,

  "plugins" : [ "wholerow", "checkbox", "types" ]
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
function update_grid() {
      var query = model.query_content;

      console.log("Updating grid with query results: " + JSON.stringify(query));
      if (firstTime == false) {
        var api = $('#contributions').dataTable().api();
        api.ajax.url("https://localhost:5980/browsing/query?query=" + encodeURIComponent(JSON.stringify(query)));
        api.ajax.reload();
        api.columns.adjust();
	      api.draw();
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
	    { data: "contributionId" },
            { data: "parentId" }
          ],
          ajax: {
                url: "https://localhost:5980/browsing/query?query=" + encodeURIComponent(JSON.stringify(query)),
                dataFilter: function(data){
                    var json = jQuery.parseJSON( data );
                    json.recordsTotal = json.page.totalElements;
                    json.recordsFiltered = json.page.totalElements;
                    if (json._embedded) {
                        json.data = json._embedded.browsingContributionResources;
            		    } else {
            		        json.data = [];
            		    }
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

/*
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
*/
