// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    pcn = require('../../../pcn').pcn,
    createRule = require('almost').createRule;

var templates = {
    list: require('./templates/list.event.js.ejs')
};

exports.rules = [
    createRule( // map selected event without outbound navigation flow
        function (element, model) {
            if (!model.isEvent(element) || model.getOutbounds(element).length) {return false; }
            var parent = model.getParent(element);
            return model.isViewComponent(parent) && parent.attributes.stereotype === 'list' && element.attributes.name === 'selected';
        },
        function (element, model) {
            var id = model.toId(element),
                list = model.getParent(element),
                top = model.getTopLevelAncestor(list),
                currentTopLevel = top.id,
                path = model.isDefault(top) ? '' : currentTopLevel,
                obj = {};
            obj[currentTopLevel + '-viewmodel'] = {children: id + '-view-js'};
            obj[id + '-view-js'] = {name: id + '.js', content: templates.list({
                id: id,
                component: list.id,
                path: path,
                currentTopLevel: currentTopLevel,
                isSameTopLevel: true,
                targetsAction: false,
                targetActives: [],
                broken: [],
                outcoming: undefined
            })};
            return obj;
        }
    )
];
