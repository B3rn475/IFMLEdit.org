// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true */
"use strict";

var joint = require('joint'),
    elements = require('../elements').elements,
    links = require('../links').links;

function createContainer(options) {
    options = options || {};
    var name = options.name || 'Container',
        id = options.id || joint.util.uuid(),
        container = new elements.PlaceChart({id: id, position: {x: 0, y: 0}, size: {width: 80, height: 140}, name: {text: name}}),
        view_p = new elements.PlaceChart({id: container.id + '-view-p', position: {x: 20, y: 20}, name: {text: 'View_{' + name + '}'}}),
        init_view_p = new links.Link({source: {id: container.id}, target: {id: view_p.id}}),
        view_n = new elements.PlaceChart({id: container.id + '-view-n', position: {x: 20, y: 80}, name: {text: '\\overline{View}_{' + name + '}'}});
    container.embed(view_p);
    container.embed(init_view_p);
    container.embed(view_n);
    return [container, view_p, view_n, init_view_p];
}

exports.createContainer = createContainer;
