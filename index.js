
var empty_server_query = { database: "", rows: { discourse_part: [] } };
var blank_server_query = {propName: "blank", propValue: "{ \"database\": \"\", \"rows\": { \"discourse_part\": [] } }"};

var model = {
  current_server_database_name: "",
  server_database_list: [""],
  query_content: $.extend(true,{},empty_server_query),
  server_query_list: [$.extend(true,{},blank_server_query)],
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
    return $.extend(true, {}, empty_server_query);
  },
  remove_query_item(dpid) {
    model.query_content.rows.discourse_part =
       model.query_content.rows.discourse_part.
          filter(function(i) { return i.dpid !== dpid; })

  },
  clear_query() {
    model.query_content = $.extend(true,{},empty_server_query);
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
  database_selection_change() {
    model.clear_query();
    view.show_server_database_list();
    this.after_upload_query_to_server();
    this.query_content_changed();
    dp_tree_refresh();
    p_brat_dirs_refresh();
  },
  delete_query_clicked() {
    p_delete_query_from_server().done(() => {
      model.query_saved_state = "unsaved";
      view.set_query_buttons();
      view.update_name_display();
      view.show_server_query_list();
      view.populate_anno_projects(); }).fail((err) => {inform_status(err)});
  },
  save_query_clicked() {  p_upload_query_to_server().then(() =>
    { model.query_saved_state = "saved";
      view.set_query_buttons();
      view.update_name_display();
      view.show_server_query_list();
      view.populate_anno_projects(); }).catch((err) => {inform_status(err)}); },
  /*download_query_clicked() {
    download_query_csv();
  },*/
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
  update_database_display() {
    $('#database_display_name').html(model.current_server_database_name);
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
        baseUrl + "/browsing/action/downloadQueryCsv/discoursedb_data.csv?query=" +
        encodeURIComponent(JSON.stringify(model.query_content)));
      $('#csvexport_noanno').attr('href',
          baseUrl + "/browsing/action/" +
               'downloadLightsideQuery/unannotated.csv?' +
               "query=" + encodeURIComponent(JSON.stringify(model.query_content))
             + "&withAnnotations=false" );
      $('#csvexport_anno').attr('href',
                 baseUrl + "/browsing/action/" +
                      'downloadLightsideQuery/annotated.csv?' +
                      "query=" + encodeURIComponent(JSON.stringify(model.query_content))
                    + "&withAnnotations=true" );
      /*$('#csvimport').attr('href',
                 baseUrl + "/browsing/action/" +
                      'database/' + model.current_server_query_name + '/uploadLightside?' +
                      "query=" + encodeURIComponent(JSON.stringify(model.query_content))
                    + "&withAnnotations=true" );*/
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
       ignore = triggers.ignoreJtreeClicks;
       triggers.ignoreJtreeClicks = true;
       if (dplist.includes(z["id"]) && !t.is_checked(z["id"])) {
         t.check_node(z["id"]);
       } else if (!dplist.includes(z["id"]) && t.is_checked(z["id"])) {
         t.uncheck_node(z["id"]);
       }
       triggers.ignoreJtreeClicks = ignore;

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

  show_server_database_list() {
    var dl = $('#database_list');
    html = "";
    $.each(model.server_database_list, function(i, item) {
      if (item === model.current_server_database_name)
         { sel = ' selected="selected" '; } else { sel = ""; }
      html += '<option' + sel + '>' + item + '</option>';
    });
    dl.html(html);
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

p_delete_query_from_server = function() {
  var chosenName = "";
  if (!model.is_query_saved() || model.query_saved_state === "blank") {
    return Promise.resolve();
  } else {
    model.query_content.database = model.current_server_database_name;
     return $.ajax({
          type: 'GET',
          /*xhrFields: { withCredentials: ($.access_token != null) },
          beforeSend: function (xhr) {
                    xhr.setRequestHeader("Authorization", "BEARER " + $.access_token);
          },*/
          data: {
            "ptype": "query",
            "pname": model.current_server_query_name
          },
          url: baseUrl + '/browsing/prop_del'})
    .done(() => { p_query_list_refresh();  })
    .done(() => { model.set_query_name(undefined); model.query_saved_state = "unsaved"; })
    .fail((err) => {inform_status(err)});
  }
}

p_upload_query_to_server = function() {
  var chosenName = "";
  if (model.is_query_saved() || model.query_saved_state === "blank") {
    return Promise.resolve();
  } else {
    model.query_content.database = model.current_server_database_name;
    return myprompt('Please name this selection of ' +
        model.query_content.rows.discourse_part.length +
        ' discourse parts', $('#query_display_name').text())
    .then( (newname) => {
       chosenName = newname;
       return $.ajax({
          type: 'POST',
          /*xhrFields: { withCredentials: ($.access_token != null) },
          beforeSend: function (xhr) {
                    xhr.setRequestHeader("Authorization", "BEARER " + $.access_token);
          },*/
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

set_jstree_hooks = function() {
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
}

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
  set_resizable();
  $("#io_accordion").accordion({
       heightStyle:    "content",
       active: 1
  });
  $('#dps_tabs').tabs();
  $('#jstree_annos').jstree({ "plugins" : [ "checkbox" ] });
  set_jstree_hooks();

  $('#save_query').on('click', function (eventt, objj) {
    triggers.save_query_clicked();
  });
  $('#delete_query').on('click', function (eventt, objj) {
    triggers.delete_query_clicked();
  });
  $('#database_list').on('change', function (eventt) {
    model.current_server_database_name = eventt.currentTarget.value;
    triggers.database_selection_change();
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
  $('#csvexport_anno').on('click', function(eventt, objj) {
    window.open($('#csvexport_anno').attr("href"), "_blank");
  });
  $('#csvexport_noanno').on('click', function(eventt, objj) {
    window.open($('#csvexport_noanno').attr("href"), "_blank");
  });

  $('#csvimport_trigger').on('click', function() {
    $('#csvimport')[0].value="";
    $('#csvimport').click();
  });
  $('#csvimport').on('change', function () {
    upload_annotations().then( function() {
      update_grid();
    });
  });
  view.set_query_buttons();
  showLoginState("out");
}


upload_annotations = function() {
  return $.ajax({   //SBM
    target: '#output',
    type: 'POST',
    data: new FormData($('#uploadLightsideForm')[0]),
    url: baseUrl + "/browsing/action/database/" + model.current_server_database_name + "/uploadLightside",
    /*xhrFields: { withCredentials: true },
    beforeSend: function (xhr) {
        xhr.setRequestHeader("Authorization", "BEARER " + $.access_token);
    },*/
    processData: false,
    contentType: false,
    success: function (result, statusText, xhr, $form) {
         // no need to act
         return;
    }
  }).done(function(th) { inform_success("Successful upload. " + JSON.stringify(th)); })
  .fail((err) => {inform_error(err)});
}

start_spinner = function () {$('#status').html("").css('background', 'url(resources/img/loading.gif) no-repeat').css('display','block');}
stop_spinner = function() {$('#status').css('background', 'white').css('display','block'); window.setTimeout(hide_spinner,3000);}
hide_spinner = function() {$('#status').css('display','none');}

inform = function(info, header) {
  if (info === "") { stop_spinner(); hide_spinner(); return; }
  if (info.hasOwnProperty("responseJSON")) {
    if (info.responseJSON.exception ==
      "edu.cmu.cs.lti.discoursedb.api.browsing.controller.BrowsingRestController$UnauthorizedDatabaseAccess") {
        $("#applyForAccount").show();
        info = $("#applyForAccount").innerHtml;
        signOut();
    } else {
        info = info.responseJSON.error + ":" +  info.responseJSON.message;
    }
  } else if (info.hasOwnProperty("responseText") && info["responseText"] == "Unknown User") {
    info = "Unknown user or password";
    signOut();
  } else if (info.hasOwnProperty("message")) {
    info = info.message;
  } else {
    info = JSON.stringify(info);
  }
  console.log("STATUS: ", info);
  stop_spinner();
  $('#status').html("<h2>" + header + "</h2><p>" + info + "</p>");
}
inform_success = function(info) { inform(info, "Success"); }
inform_status = function(info) {inform(info, "Result"); }
inform_error = function(info) {inform(info, "Error"); }


sanitize_query_name = function(qn) {
  return qn.replace("[^a-zA-Z0-9\\._]", "_");
}

download_query_csv = function() {
  return $.ajax({
    url: baseUrl + "/browsing/action/downloadQueryCsv/discoursedb_data.csv",
    data: { query : model.query_content }, //encodeURIComponent(JSON.stringify(model.query_content)),
    type: 'GET',
    /*xhrFields: { withCredentials: ($.access_token != null) },
    beforeSend: function (xhr) {
              xhr.setRequestHeader("Authorization", "BEARER " + $.access_token);
    },*/
    success: function() {
        console.log("Here");
        window.location = 'discoursedb_data.csv';
    }
  }).done(function(th) { console.log("THENN" + th); })
  .fail((err) => {inform_error(err)});
}

download_lightside_csv = function(withAnno) {
  filename = "lightside_" + model.current_server_database_name + ".csv"
  return $.ajax({
    url: baseUrl + "/browsing/action/downloadLightsideQuery/" + filename ,
    data: { withAnnotations: withAnno?"true":"false",
            query: model.query_content },
    type: 'GET',
    /*xhrFields: { withCredentials: ($.access_token != null) },
    beforeSend: function (xhr) {
              xhr.setRequestHeader("Authorization", "BEARER " + $.access_token);
    },*/
    success: function() {
        console.log("Here");
        window.location = filename;
    }
  }).done(function(th) { console.log("THENN" + th); })
  .fail((err) => {inform_error(err)});
}

p_brat_dirs_refresh = function() {
  return $.ajax({
    type: 'GET',
    /*xhrFields: { withCredentials: ($.access_token != null) },
    beforeSend: function (xhr) {
              xhr.setRequestHeader("Authorization", "BEARER " + $.access_token);
    },*/
    url: baseUrl + '/browsing/database/' + model.current_server_database_name + '/bratExports'}).then(
    (datback) => {
      return new Promise(function(g,b) {
        try {
           model.brat_dirs = datback._embedded.browsingBratExportResources;
           triggers.brat_dirs_changed();
           g("done");
         } catch (e) {
           console.log("Could not make sense in brat-dirs-refresh, of:");
           console.log(datback);
           model.brat_dirs = [];
           triggers.brat_dirs_changed();
           b(e);
         }
       })
    }).fail((err) => {inform_error(err)});
}



delete_brat_dir = function(href) {
  return $.ajax({type: 'GET',
          /*xhrFields: { withCredentials: ($.access_token != null) },
          beforeSend: function (xhr) {
              xhr.setRequestHeader("Authorization", "BEARER " + $.access_token);
          },*/
          url: href}).then(
          function(datback) {
               model.brat_dirs = datback._embedded.browsingBratExportResources;
               triggers.brat_dirs_changed();
          }).fail((err) => {inform_error(err)});;
}

import_brat_dir = function(href) {
  return $.ajax({type: 'GET',
          /*xhrFields: { withCredentials: ($.access_token != null) },
          beforeSend: function (xhr) {
              xhr.setRequestHeader("Authorization", "BEARER " + $.access_token);
          },*/
          url: href })
  .then(function (g,b) { update_grid(); })
  .fail((err) => {inform_error(err)});
}



create_brat_dir = function() {
  start_spinner();

  p_upload_query_to_server().then((g,b) => {
      var calls =  model.query_content2dplist().map(function(dpid) {
        console.log("Exporting one BRAT element: ", dpid);
        return $.ajax({type: 'GET',
            /*xhrFields: { withCredentials: ($.access_token != null) },
            beforeSend: function (xhr) {
                xhr.setRequestHeader("Authorization", "BEARER " + $.access_token);
            },*/
            data: {
              exportDirectory: model.current_server_query_name,
              dpId: dpid
            },
            url: baseUrl + "/browsing/action/database/" + model.current_server_database_name + "/exportBratItem"});
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
    /*xhrFields: { withCredentials: ($.access_token != null) },
    beforeSend: function (xhr) {
              xhr.setRequestHeader("Authorization", "BEARER " + $.access_token);
    },*/
    data: { ptype: "query" },
    url: baseUrl + '/browsing/prop_list'}).then(
    function(datback) {
         model.server_query_list = [$.extend(true,{},blank_server_query)].concat(
              datback.filter( function (q) { return JSON.parse(q.propValue).database===model.current_server_database_name} ));
         triggers.server_query_list_changed();
    }).fail((err) => {inform_error(err)});
}


/*
*  Refresh the list of saved queries
*/
test_roles = function () {
  return $.ajax({
    type: 'GET',
    /*xhrFields: { withCredentials: ($.access_token != null) },
    beforeSend: function (xhr) {
              xhr.setRequestHeader("Authorization", "BEARER " + $.access_token);
    },*/
    url: baseUrl + '/browsing/roles'}).then(
    function(datback) {
         console.log(datback);
    }).fail((err) => {inform_error(err)});
}

/*
*  Refresh the list of saved queries
*/
p_database_list_refresh = function () {
  return $.ajax({
    type: 'GET',
    /*xhrFields: { withCredentials: ($.access_token != null) },
    beforeSend: function (xhr) {
              xhr.setRequestHeader("Authorization", "BEARER " + $.access_token);
    },*/
    url: baseUrl + '/browsing/databases'}).then(
    function(datback) {
         console.log(datback);
         if (datback._embedded.browsingDatabasesResources.length > 0) {
           model.server_database_list = datback._embedded.browsingDatabasesResources[0].databases;
           model.current_server_database_name=model.server_database_list[0];
         } else {
           model.server_database_list = [];
         }

    }).fail((err) => {inform_error(err)});
}


jstree_node2url = function (node) {
  /* # -> root;    /browsing/stats
   * D/1 -> Discourse 1 p1 of 1       /browsing/discourses/1
   * DT/1/3/2   -> Disc 1 type 3 p2   /browsing/1/discoursePartTypes/3?page=2
   * DP/1/2  -> DiscoursePart 1 page 1   /browsing/subDiscourseParts/1?page=2
   *
   *
   */
  current_context.node_id = node.id;
  if (node.id === '#') { return baseUrl + "/browsing/database/" + model.current_server_database_name + "/stats"; }
  var parts = node.id.split("/");
  if (parts[0] === "D") { return baseUrl + "/browsing/database/" + model.current_server_database_name +"/discourses/" + parts[1]; }
  if (parts[0] === "DT") { return baseUrl + "/browsing/database/" + model.current_server_database_name + "/discourses/" +
      parts[1] + "/discoursePartTypes/" + parts[2] + "?page=" + parts[3]; }
  if (parts[0] === "DP") { return baseUrl + "/browsing/database/" + model.current_server_database_name +
          "/subDiscourseParts/" + parts[1]
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

var set_resizable = function() {
    //$('#contributions').colResizable({disabled:true});
    var cc = $('#contributions');
    cc.resizable({handles: "e"});
    cc.colResizable({
        liveDrag:true,
        headerOnly: true,
        gripInnerHtml:"<div class='grip'></div>",
        draggingClass:"dragging"
    });
    cc.width(cc.width());
}



/*
*    Refresh the discourse part tree
*/

var current_context = new Object();
var dp_tree_refresh = function() {
  $('#jstree_dps').jstree("destroy");
  $('#jstree_dps').jstree({
      core: {
        data: {
          context: current_context,
          url: jstree_node2url,
          type: 'GET',
          /*xhrFields: { withCredentials: ($.access_token != null) },
          beforeSend: function (xhr) {
                    xhr.setRequestHeader("Authorization", "BEARER " + $.access_token);
          },*/
          dataFilter: dpsTopLevelDataFilter,
        }
     },
  types: dptype2icon,

  "plugins" : [ "wholerow", "checkbox", "types" ]
});
set_jstree_hooks();
//$('#jstree_dps').jstree("refresh");
}

function showLoginState(st) {
  if (st == "out") {
    if (auths.indexOf("basic") >= 0) {
      $("#signInBasic").show();
    } else {
      $("#signInBasic").hide();
    }
    if (auths.indexOf("google") >= 0) {
      $("#signInGoogle").show();
    }else {
      $("#signInGoogle").hide();
    }
    $("#signedInDisplay").hide();
    $("#applyForAccount").show();
  } else if (st == "in") {
    $("#signInGoogle").hide();
    $("#signInBasic").hide();
    $("#signedInDisplay").show();
    $("#applyForAccount").hide();
  }
}


function signOut() {
  console.log("In signout function");
  authorizer["serviceSignout"]().then(function () {
    console.log("Signed out");
    showLoginState("out");
    $("#currentuser").html("Current user: (none)");
    model.server_database_list = [];
    view.show_server_database_list();
    model.server_query_list = [];
    triggers.server_query_list_changed();
    dp_tree_refresh();
    model.brat_dirs = [];
    triggers.brat_dirs_changed();

  });
}

$("#signOutButton").on('click', function (e) {
  console.log("HERE!");
  signOut();
  e.preventDefault();
  return false;
});


console.log("in index: window.authorizer=", window.authorizer);
authorizer["onSignIn"] = function() {
  $("#currentuser").html("Current user: " + authorizer.name);
  showLoginState("in");

  p_database_list_refresh().then(() => {
    view.show_server_database_list();
    p_query_list_refresh();
    dp_tree_refresh();
    p_brat_dirs_refresh();
  });
}



function expand_annotations(record) {
  return record.map((r) => r.type + " " + r.features.join(";")).join(",");
}

 /*
 *   Populate the grid
   https://datatables.net/reference/option/ajax
 */
var firstTime = true;
function update_grid() {
      var query = model.query_content;
      if (model.query_content.database.length == 0) {
        model.query_content.database = model.current_server_database_name;
      }
      console.log("Updating grid with query results: " + JSON.stringify(query));
      if (firstTime == false) {
        var api = $('#contributions').dataTable().api();
        api.ajax.url(baseUrl + "/browsing/query?query=" + encodeURIComponent(JSON.stringify(query)));
        api.ajax.reload();

        api.columns.adjust();
	      api.draw();
        set_resizable();

      } else {
        $('#contributions').DataTable( {
          dom: 'lript',
          serverSide: true,
          //autoWidth: true,
          searching: false,
          ordering: false,
          //sScrollX: false,
          //sScrollY: false,
          columns: [
            { data: "contributor" },
            { data: "annotations" },
            { data: "type" },
            { data: "content", width:"420" },
            { data: "title" },
            { data: "discourseParts" },
            { data: "startTime", width:"10%"},
	          { data: "contributionId" },
            { data: "parentId" }
          ],
          initComplete: function(settings) {
            set_resizable();
          },
          ajax: {
                url: baseUrl + "/browsing/query?query=" + encodeURIComponent(JSON.stringify(query)),
                /*xhrFields: { withCredentials: ($.access_token != null) },
                beforeSend: function (xhr) {
                          xhr.setRequestHeader("Authorization", "BEARER " + $.access_token);
                },*/
                dataFilter: function(data){
                    var json = jQuery.parseJSON( data );
                    json.recordsTotal = json.page.totalElements;
                    json.recordsFiltered = json.page.totalElements;
                    if (json._embedded) {
                        json.data = json._embedded.browsingContributionResources;
                        json.data.forEach((k) => k.annotations = expand_annotations(k.annotations));
            		    } else {
            		        json.data = [];
            		    };
                    /*json.data.forEach((row) => Object.keys(row).forEach((key) => {
                    if (typeof(row[key]) === "object") { row[key] = JSON.stringify(row[key]) }} ));*/
                    return JSON.stringify( json ); // return JSON string
                }
            }
           } );

        firstTime = false;
      }
 };
