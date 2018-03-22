// Copyright (c) 2018, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var almost = require('almost'),
    createRule = almost.createRule,
    pcn = require('../../').pcn;

module.exports = [
    createRule(
        function (element, model) {
            return model.isPlaceChart(element);
        },
        function (element) {
            return new pcn.elements.PlaceChart(element);
        }
    ),
    createRule(
        function (element, model) {
            return model.isTransition(element);
        },
        function (element) {
            return new pcn.elements.Transition(element);
        }
    ),
    createRule(
        function (element, model) {
            return model.isLink(element);
        },
        function (element) {
            return new pcn.links.Link(element);
        }
    )
];
