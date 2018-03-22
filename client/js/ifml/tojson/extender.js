// Copyright (c) 2018, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    createExtender = require('almost-extend').createExtender;

exports.extend = createExtender({
    custom: {
        isViewContainer: function (element) {
            return element.get('type') === 'ifml.ViewContainer';
        },
        isViewComponent: function (element) {
            return element.get('type') === 'ifml.ViewComponent';
        },
        isViewElement: function (element) {
            return this.isViewContainer(element) || this.isViewComponent(element);
        },
        isAction: function (element) {
            return element.get('type') === 'ifml.Action';
        },
        isEvent: function (element) {
            return element.get('type') === 'ifml.Event';
        },
        isDataFlow: function (element) {
            return element.get('type') === 'ifml.DataFlow';
        },
        isNavigationFlow: function (element) {
            return element.get('type') === 'ifml.NavigationFlow';
        },
        isFlow: function (element) {
            return this.isDataFlow(element) || this.isNavigationFlow(element);
        },
        isList: function (element) {
            return this.isViewComponent(element) && element.get('stereotype') === 'list';
        },
        isDetails: function (element) {
            return this.isViewComponent(element) && element.get('stereotype') === 'details';
        },
        isListOrDetails: function (element) {
            return this.isList(element) || this.isDetails(element);
        },
        isElement: function (element) {
            return this.isEvent(element) || this.isAction(element)
                || this.isViewElement(element) || this.isFlow(element);
        },
        isElementWithPosition: function (element) {
            return this.isEvent(element) || this.isAction(element)
                || this.isViewElement(element);
        },
        isElementWithSize: function (element) {
            return this.isAction(element) || this.isViewElement(element);
        },
        isChildElement: function (element) {
            return this.isEvent(element) || this.isViewComponent(element) || (this.isViewContainer(element)
                && element.get('parent'));
        }
    }
});
