// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true */
"use strict";

var joint = require('joint'),
    elements = require('../elements').elements,
    links = require('../links').links;

function createApplication(options) {
    options = options || {};
    var id = options.id || joint.util.uuid(),
        application = new elements.PlaceChart({id: id, position: {x: 100, y: 0}, size: {width: 80, height: 140}, name: {text: 'Application'}}),
        waiting_p = new elements.PlaceChart({id: id + '-waiting-p', position: {x: 0, y: 0}, name: {text: 'Waiting', vertical: 'top'}}),
        waiting_n = new elements.PlaceChart({id: id + '-waiting-n', position: {x: 0, y: 100}, name: {text: '\\overline{Waiting}'}}),
        open = new elements.Transition({position: {x: 50, y: 0}, name: {text: 'open'}}),
        waiting_p_to_open = new links.Link({source: {id: waiting_p.id}, target: {id: open.id}}),
        open_to_waiting_n = new links.Link({source: {id: open.id}, target: {id: waiting_n.id}}),
        open_to_application = new links.Link({source: {id: open.id}, target: {id: application.id}}),
        close = new elements.Transition({position: {x: 50, y: 100}, name: {text: 'close', vertical: 'top'}}),
        application_to_close = new links.Link({source: {id: application.id}, target: {id: close.id}}),
        close_to_waiting_p = new links.Link({source: {id: close.id}, target: {id: waiting_p.id}}),
        waiting_p_to_close = new links.Link({source: {id: waiting_n.id}, target: {id: close.id}}),
        view_p = new elements.PlaceChart({position: {x: 120, y: 20}, name: {text: 'View_{Application}'}}),
        init_view_p = new links.Link({source: {id: application.id}, target: {id: view_p.id}}),
        view_n = new elements.PlaceChart({position: {x: 120, y: 80}, name: {text: '\\overline{View}_{Application}'}}),
        close_to_view_n = new links.Link({source: {id: close.id}, target: {id: view_n.id}});
    application.embed(view_p);
    application.embed(init_view_p);
    application.embed(view_n);
    return [
        application,
        waiting_p, waiting_n,
        view_p, init_view_p, view_n,
        open,
        waiting_p_to_open, open_to_waiting_n, open_to_application,
        close,
        application_to_close, close_to_waiting_p, waiting_p_to_close, close_to_view_n];
}

exports.createApplication = createApplication;
