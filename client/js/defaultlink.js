// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true */
"use strict";

var joint = require('joint'),
    ifml = require('./ifml').ifml,
    pcn = require('./pcn').pcn;

function ignore() { return undefined; }

exports.defaultLink = function (cellView, magnet) {
    ignore(magnet);
    switch (cellView.model.get('type')) {
    case 'ifml.ViewComponent':
        return new ifml.links.DataFlow();
    case 'ifml.Event':
        return new ifml.links.NavigationFlow();
    case 'pcn.PlaceChart':
        return new pcn.links.Link();
    case 'pcn.Transition':
        return new pcn.links.Link();
    }
};
