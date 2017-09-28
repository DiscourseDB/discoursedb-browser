
var baseUrl = "https://localhost:5980";
var empty_server_query = { rows: { discourse_part: [] } };
var blank_server_query = {propName: "blank", propValue: "{ \"rows\": { \"discourse_part\": [] } }"};

var model = {
  query_content: empty_server_query,
  server_query_list: [blank_server_query],
  current_server_query_name: "",
  query_saved_state: "blank",   // blank | saved | unsaved
  brat_dirs: [],

  // Model readers/writers
  query_content2dplist() {
    return model.query_content.rows.discourse_part.map(function(key) {
      return key["dpid"];
    })
  },
  is_query_saved() {
    return this.query_saved_state === "saved";
    /*if (model.query_content.rows.discourse_part.length == 0) { return true; }
    for (q in model.server_query_list) {
      if (model.server_query_list[q]["propName"] === model.current_server_query_name) {
          return true;
      }
    }
    return false;*/
  },
  find_server_query(name) {
    //if (name === "blank") { return empty_server_query; }
    for (q in model.server_query_list) {
      if (model.server_query_list[q]["propName"] === name) {
          return JSON.parse(model.server_query_list[q]["propValue"]);
      }
    }
    return empty_server_query;
  },
  remove_query_item(dpid) {
    model.query_content.rows.discourse_part =
       model.query_content.rows.discourse_part.
          filter(function(i) { return i.dpid !== dpid; })

  },
  add_query_item(dpId, dpName) {
    this.remove_query_item(dpId);
    model.query_content.rows.discourse_part.push({dpid: dpId, name: dpName});

  },
  set_query_name(name) {
     if (name == undefined || name === "blank") {
         suffix = "";
         if (model.query_saved_state === "blank") {
           name = "selection1"
         } else {
           name = model.current_server_query_name; //TODO: drop \d from end of name if needed and seed suffix with that +1
         }
         forbiddenNames = model.server_query_list.map((sq) => sq.propName )
         while (forbiddenNames.includes(sanitize_query_name(name+suffix))) {
           if (suffix === "") { suffix = 2; }
           else { suffix += 1; }
         }
         name = sanitize_query_name(name+suffix);
     }
     model.current_server_query_name = name;
   }
}



var triggers = {
  ignoreJtreeClicks: false,
  initialization() { setup_components(); },
  query_content_changed() {  view.set_selections_from_query(); update_grid(); view.set_query_buttons(); model.set_query_name(undefined); view.update_name_display(); view.show_server_query_list(); view.populate_anno_projects();  },
  clicked_dp_checkbox() {  this.query_content_changed();  },
  server_query_list_changed() { view.show_server_query_list(); view.update_name_display(); },
  save_query_clicked() {  p_upload_query_to_server().then(() =>
    { model.query_saved_state = "saved";
      view.set_query_buttons();
      view.update_name_display();
      view.show_server_query_list();
      view.populate_anno_projects(); }).catch((err) => {inform_status(err)}); },
  download_query_clicked() {
    download_query_csv();
  },
  after_upload_query_to_server() {  p_query_list_refresh(); view.populate_anno_projects(); view.set_query_buttons(); },
  query_selection_change() {   view.update_name_display(); view.set_selections_from_query(); view.set_query_buttons(); view.populate_anno_projects(); update_grid(); },
  jtree_expand_node() { view.set_selections_from_query(); },
  brat_dirs_changed() { view.populate_anno_projects() },
  click_delete_brat(href) { delete_brat_dir(href) },
  click_import_brat(href) { import_brat_dir(href) },
  click_create_brat() { create_brat_dir() },
}

var view = {
  update_name_display() {
    $('#query_display_name').html(model.current_server_query_name);
  },
  populate_anno_projects() {
     if (model.query_saved_state === "blank") {
        html = "";
     } else {
         var bratinf = model.brat_dirs.find((bd) => bd.name==model.current_server_query_name);
         if (bratinf) {
           html = '<a target="brat" href="' + bratinf._links["Edit BRAT markup"].href + '" >'
                + '<i class="glyphicon glyphicon-edit" title="Add or edit annotations in the Brat tool"></i> &nbsp;Edit</a><br/>'
                + '<span class="bratImportLink fakelink" href="' + bratinf._links["Import BRAT markup"].href + '">'
                + '<i  class="glyphicon glyphicon-import" title="Import Brat annotations into DiscourseDB"></i> &nbsp;Import</span> <br/>'
                + '<span class="bratDeleteLink fakelink" href="' + bratinf._links["Delete BRAT markup"].href + '">'
                + '<i  class="glyphicon glyphicon-remove" title="Forget these annotations in the Brat tool"></i> &nbsp;Delete</span> <br/>';
         } else {
         html = '<br/><span class="createNewExport fakelink"><i class="glyphicon glyphicon-edit" title="Annotate current selection"></i> &nbsp;'
              + "Annotate</span>";
         }
     }
     $('#annotation_projects').html(html);
  },
  set_query_buttons() {
      $('#delete_query').prop('disabled', model.query_saved_state !== "saved");
      $('#save_query').prop('disabled', model.query_saved_state !== "unsaved");
      $('.when_something_selected').attr('disabled', model.query_saved_state == "blank");
      $('#download_query_direct').attr('href',
        baseUrl + "/browsing/action/downloadQueryCsv/discoursedb_data.csv?query=" + encodeURIComponent(JSON.stringify(model.query_content)));
  },
  set_selections_from_query() {
    // TODO: prop_new should replace if type and name are the same

    // go through tree and select things that should be selected
    var t = $("#jstree_dps").jstree(true)
    var v = t.get_json('#', {'flat': true});
    var dplist = model.query_content2dplist().map((dpid) => "DP/" + dpid + "/0");
    // Put count of selected DPs at top. Hyperlink to List tab
    $('#jstree_selection_count').html(dplist.length);
    for (i = 0; i < v.length; i++) {
       var z = v[i];
       triggers.ignoreJtreeClicks = true;
       if (dplist.includes(z["id"])) {
         t.check_node(z["id"]);
       } else {
         t.uncheck_node(z["id"]);
       }
       triggers.ignoreJtreeClicks = false;

    }
    // also write list to $('#dps_list') along with a delete icon
    var lst = "";
    model.query_content.rows.discourse_part.map(function(dp) {
       lst = lst + '\n<i dpid="' + dp["dpid"] +
          '" class="glyphicon removeQueryItem glyphicon-remove-circle"></i>&nbsp;<span class="ellipsis">'
          + dp["name"] + "</span><br/>";
    });
    $("#list_dps").html(lst);
  },


  show_server_query_list() {
    var ql = $('#query_list');
    html = "";
    $.each(model.server_query_list, function(i, item) {
      if (item.propName === model.current_server_query_name)
         { sel = ' selected="selected" '; } else { sel = ""; }
      html += '<option' + sel + '>' + item.propName + '</option>';
    });
    if (model.query_saved_state === "unsaved") {
      html += '<option selected="selected">(not saved)</option>';
    }
    ql.html(html);
  },

}




myprompt = function(question, defaulty) {
  return new Promise(function(g,b) {
    var ans = window.prompt(question, defaulty);
    if (ans == undefined) { b("Cancel"); }
    else { g(sanitize_query_name(ans)); }
  });
}

p_upload_query_to_server = function() {
  var chosenName = "";
  if (model.is_query_saved() || model.query_saved_state === "blank") {
    return Promise.resolve();
  } else {
    return myprompt('Please name this selection of ' +
        model.query_content.rows.discourse_part.length +
        ' discourse parts', $('#query_display_name').text())
    .then( (newname) => {
       chosenName = newname;
       return $.ajax({
          type: 'POST',
          xhrFields: { withCredentials: ($.access_token != null) },
          beforeSend: function (xhr) {
                    xhr.setRequestHeader("Authorization", "BEARER " + $.access_token);
          },
          data: {
            "ptype": "query",
            "pname": newname,
            "pvalue": JSON.stringify(model.query_content)
          },
          url: baseUrl + '/browsing/prop_add'})})
    .then(() => { p_query_list_refresh();  })
    .then(() => { model.set_query_name(chosenName); model.query_saved_state = "saved"; })
    .catch((err) => {inform_status(err)});
  }
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
      //north__paneSelector: ".io",
      center__paneSelector: ".io",
      applyDefaultStyles: true
  });
  layoutWest = $('#westpanel').layout({
      //north__paneSelector: ".io",
      center__paneSelector: "#select_discourseparts",
      applyDefaultStyles: true
  });

  $('#contributions').colResizable({
      liveDrag:true,
      gripInnerHtml:"<div class='grip'></div>",
      draggingClass:"dragging"
  });
  $("#io_accordion").accordion({
       heightStyle:    "content",
       active: 1
  });
  $('#dps_tabs').tabs();
  $('#jstree_annos').jstree({ "plugins" : [ "checkbox" ] });
  $('#jstree_dps').on('changed.jstree', function (eventt, objj) {
    if (!triggers.ignoreJtreeClicks) {
      console.log("JTREE", eventt);
      var tree = $('#jstree_dps').jstree(true);
      if (objj.node.state.selected && objj.node.id.startsWith("DP/")) {
        model.add_query_item(objj.node.id.split("/")[1], objj.node.text);
      } else if (!objj.node.state.selected && objj.node.id.startsWith("DP/")) {
        model.remove_query_item(objj.node.id.split("/")[1]);
      }
      model.query_saved_state = "unsaved";
      triggers.clicked_dp_checkbox();
    }
  });
  $("#jstree_dps").on("open_node.jstree", function (e, data) {
    triggers.jtree_expand_node  ();
  });
  $('#save_query').on('click', function (eventt, objj) {
    triggers.save_query_clicked();
  });
  $('#query_list').on('change', function (eventt) {
    if (!triggers.ignoreJtreeClicks) {
      if (eventt.currentTarget.value === "blank") {
        model.query_saved_state = "blank";
      } else {
        model.query_saved_state = "saved";
      }
      model.set_query_name(eventt.currentTarget.value);
      model.query_content = model.find_server_query(eventt.currentTarget.value);
      triggers.query_selection_change();
    }
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
      model.query_saved_state = "unsaved";
      model.remove_query_item(eventt.target.getAttribute("dpid"));
      triggers.clicked_dp_checkbox();
  });
  $(document).on('click', '.bratImportLink', function(eventt) {
    triggers.click_import_brat(eventt.currentTarget.getAttribute("href"))
  });
  $(document).on('click', '.bratDeleteLink', function(eventt) {
    triggers.click_delete_brat(eventt.currentTarget.getAttribute("href"))
  });
  $(document).on('click', '.createNewExport', function(eventt, objj) {
    triggers.click_create_brat()
  });
  $('#download_query_direct').on('click', function(eventt, objj) {
    window.open($('#download_query_direct').attr("href"), "_blank");
  });
  view.set_query_buttons();
}

start_spinner = function () {$('#status').html("").css('background', 'url(resources/img/loading.gif) no-repeat').css('display','block');}
stop_spinner = function() {$('#status').css('background', 'white').css('display','block'); window.setTimeout(hide_spinner,3000);}
hide_spinner = function() {$('#status').css('display','none');}

inform_status = function(info) {
  if (info === "") { stop_spinner(); hide_spinner(); return; }
  if (info.hasOwnProperty("responseJSON")) {
    info = info.responseJSON.error + ":" +  info.responseJSON.message;
  } else if (info.hasOwnProperty("message")) {
    info = info.message;
  } else {
    info = JSON.stringify(info);
  }
  console.log("STATUS: ", info);
  stop_spinner();
  $('#status').html("<h2>Error</h2><p>" + info + "</p>");
}

sanitize_query_name = function(qn) {
  return qn.replace("[^a-zA-Z0-9\\._]", "_");
}

download_query_csv = function() {
  return $.ajax({
    url: baseUrl + "/browsing/action/downloadQueryCsv/discoursedb_data.csv?query=" + encodeURIComponent(JSON.stringify(model.query_content)),
    type: 'GET',
    xhrFields: { withCredentials: ($.access_token != null) },
    beforeSend: function (xhr) {
              xhr.setRequestHeader("Authorization", "BEARER " + $.access_token);
    },
    success: function() {
        console.log("Here");
        window.location = 'discoursedb_data.csv';
    }
  }).done(function(th) { console.log("THENN" + th); })
  .fail((err) => {inform_status(err)});
}

p_brat_dirs_refresh = function() {
  return $.ajax({
    type: 'GET',
    xhrFields: { withCredentials: ($.access_token != null) },
    beforeSend: function (xhr) {
              xhr.setRequestHeader("Authorization", "BEARER " + $.access_token);
    },
    url: baseUrl + '/browsing/bratExports'}).then(
    (datback) => {
      return new Promise(function(g,b) {
        try {
           model.brat_dirs = datback._embedded.browsingBratExportResources;
           triggers.brat_dirs_changed();
           g("done");
         } catch (e) {
           model.brat_dirs = [];
           triggers.brat_dirs_changed();
           b(e);
         }
       })
    }).fail((err) => {inform_status(err)});
}



delete_brat_dir = function(href) {
  return $.ajax({type: 'GET',
          xhrFields: { withCredentials: ($.access_token != null) },
          beforeSend: function (xhr) {
              xhr.setRequestHeader("Authorization", "BEARER " + $.access_token);
          },
          url: href}).then(
          function(datback) {
               model.brat_dirs = datback._embedded.browsingBratExportResources;
               triggers.brat_dirs_changed();
          }).fail((err) => {inform_status(err)});;
}

import_brat_dir = function(href) {
  return $.ajax({type: 'GET',
          xhrFields: { withCredentials: ($.access_token != null) },
          beforeSend: function (xhr) {
              xhr.setRequestHeader("Authorization", "BEARER " + $.access_token);
          },
          url: href})
  .then(function (g,b) { update_grid(); })
  .fail((err) => {inform_status(err)});
}

create_brat_dir = function() {
  start_spinner();

  p_upload_query_to_server().then((g,b) => {
      var calls =  model.query_content2dplist().map(function(dpid) {
        console.log("Exporting one BRAT element: ", dpid);
        return $.ajax({type: 'GET',
            xhrFields: { withCredentials: ($.access_token != null) },
            beforeSend: function (xhr) {
                xhr.setRequestHeader("Authorization", "BEARER " + $.access_token);
            },
            data: {
              exportDirectory: model.current_server_query_name,
              dpId: dpid
            },
            url: baseUrl + "/browsing/action/exportBratItem"});
      });
      Promise.all(calls).then(() =>  p_brat_dirs_refresh() )
        // TODO: Add endpoint to read/write brat config file
        // TODO: write out codes to Brat config file.
      .then(() => {
        hide_spinner();
        var q = model.brat_dirs.find((bd) => bd.name==model.current_server_query_name);
        url = q._links["Edit BRAT markup"].href;
        window.open(url, "brat");
      })
      .catch((err) => {inform_status(err);});
  });
}



/*
*  Refresh the list of saved queries
*/
p_query_list_refresh = function () {
  return $.ajax({
    type: 'GET',
    xhrFields: { withCredentials: ($.access_token != null) },
    beforeSend: function (xhr) {
              xhr.setRequestHeader("Authorization", "BEARER " + $.access_token);
    },
    url: baseUrl + '/browsing/prop_list?ptype=query'}).then(
    function(datback) {
         model.server_query_list = [blank_server_query].concat(datback);
         triggers.server_query_list_changed();
    }).fail((err) => {inform_status(err)});
}


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
   p_query_list_refresh();
   dp_tree_refresh();
   p_brat_dirs_refresh();
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
        api.ajax.url(baseUrl + "/browsing/query?query=" + encodeURIComponent(JSON.stringify(query)));
        api.ajax.reload();
        api.columns.adjust();
	      api.draw();
      } else {
        $('#contributions').DataTable( {
          dom: 'lript',
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
                url: baseUrl + "/browsing/query?query=" + encodeURIComponent(JSON.stringify(query)),
                xhrFields: { withCredentials: ($.access_token != null) },
                beforeSend: function (xhr) {
                          xhr.setRequestHeader("Authorization", "BEARER " + $.access_token);
                },
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

        firstTime = false;
      }
 };
