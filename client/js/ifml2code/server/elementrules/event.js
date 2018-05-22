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
    createRule( // map lists without an active selection event
        function (element, model) {
            if (!(model.isViewComponent(element) && element.attributes.stereotype === 'list')) {
                return false;
            }
            var selection = _.chain(model.getChildren(element))
                .filter(function (id) { return model.isEvent(id); })
                .map(function (id) { return model.toElement(id); })
                .filter(function (event) { return model.getOutbounds(event).length && event.attributes.stereotype === 'selection'; });
            return selection.length === 0;
        },
        function (list, model) {
            var id = model.toId(list),
                top = model.getTopLevelAncestor(list),
                currentTopLevel = top.id,
                path = model.isDefault(top) ? '' : currentTopLevel,
                obj = {};
            obj[currentTopLevel + '-viewmodel'] = {children: id + '-view-js'};
            obj[id + '-view-js'] = {name: id + '.js', content: templates.list({
                id: id,
                component: id,
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
