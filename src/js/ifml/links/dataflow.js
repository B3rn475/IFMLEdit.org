// Copyright (c) 2016, the webratio-web project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var joint = require('joint'),
    Base = require('./base').Base;

exports.DataFlow = Base.extend({
    defaults: joint.util.deepSupplement({
        type: 'ifml.DataFlow',
        attrs: {
            '.connection' : { stroke: 'black', 'stroke-dasharray': '7.5,7.5'},
            '.marker-target': { fill: 'black', stroke: 'black', d: 'M 10 0 L 0 5 L 10 10 z' }
        }
    }, Base.prototype.defaults),

    validSources: ['ifml.ViewComponent'],
    validTargets: ['ifml.ViewComponent', 'ifml.Action']
});
