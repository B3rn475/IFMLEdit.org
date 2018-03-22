// Copyright (c) 2018, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var almost = require('almost'),
    createRule = almost.createRule,
    ifml = require('../../').ifml;

module.exports = [
    createRule(
        function (element, model) {
            return model.isViewContainer(element);
        },
        function (element) {
            return new ifml.elements.ViewContainer(element);
        }
    ),
    createRule(
        function (element, model) {
            return model.isViewComponent(element);
        },
        function (element) {
            return new ifml.elements.ViewComponent(element);
        }
    ),
    createRule(
        function (element, model) {
            return model.isEvent(element);
        },
        function (element) {
            return new ifml.elements.Event(element);
        }
    ),
    createRule(
        function (element, model) {
            return model.isAction(element);
        },
        function (element) {
            return new ifml.elements.Action(element);
        }
    ),
    createRule(
        function (element, model) {
            return model.isDataFlow(element);
        },
        function (element) {
            return new ifml.links.DataFlow(element);
        }
    ),
    createRule(
        function (element, model) {
            return model.isNavigationFlow(element);
        },
        function (element) {
            return new ifml.links.NavigationFlow(element);
        }
    )
];
