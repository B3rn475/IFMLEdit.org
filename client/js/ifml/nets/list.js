// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true */
"use strict";

var elements = require('../elements').elements,
    links = require('../links').links;

function createList() {
    var component = new elements.ViewComponent({position: {x: 0, y: 0}, stereotype: 'list'}),
        selected = new elements.Event({position: {x: 140, y: 50}, parentLifecicle: true, name: {text: 'selected', vertical: 'bottom', horizontal: 'right'}});
    component.embed(selected);
    return [component, selected];
}

exports.createList = createList;
