// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    pcn = require('../../../pcn').pcn,
    createRule = require('almost').createRule;

exports.rules = [
    createRule( // map System Event
        function (element, model) { return model.isSystem(element); },
        function (systemEvent, model) {
            var id = model.toId(systemEvent),
                obj = {
                    controls: {children: 'C-' + id}
                };
            obj['C-' + id] = {isFolder: true, name: 'c-' + id, children: ['C-' + id + '-VM', 'C-' + id + '-V']};
            obj['C-' + id + '-VM'] = {name: 'index.js', content: require('./templates/system-event-vm.js.ejs')({id: id})};
            obj['C-' + id + '-V'] = {name: 'index.html', content: require('./templates/system-event-v.html.ejs')({})};
            return obj;
        }
    )
];
