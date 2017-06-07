// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true */
"use strict";

var joint = require('joint'),
    elements = require('../elements').elements,
    links = require('../links').links;

function createAction(options) {
    options = options || {};
    var name = options.name || 'Action',
        id = options.id || joint.util.uuid(),
        action = new elements.PlaceChart({id: id, position: {x: 0, y: 0}, size: {width: 80, height: 140}, name: {text: name}}),
        running_p = new elements.PlaceChart({id: action.id + '-running-p', position: {x: 20, y: 20}, name: {text: 'Running_{' + name + '}'}}),
        running_n = new elements.PlaceChart({id: action.id + '-running-n', position: {x: 20, y: 80}, name: {text: '\\overline{Running}_{' + name + '}'}}),
        init_running_p = new links.Link({source: {id: action.id}, target: {id: running_p.id}});
    action.embed(running_p);
    action.embed(running_n);
    action.embed(init_running_p);
    return [action, running_p, running_n, init_running_p];
}

exports.createAction = createAction;
