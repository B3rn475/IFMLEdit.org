// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true */
"use strict";

var elements = require('../elements').elements,
    links = require('../links').links;

function createList() {
    return [
        new elements.ViewComponent({position: {x: 0, y: 0}, stereotype: 'details'})
    ];
}

exports.createList = createList;
