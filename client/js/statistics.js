// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var $ = require('jquery'),
    _ = require('lodash');

function StatisticsMenu(options) {
    if (!(this instanceof StatisticsMenu)) { return new StatisticsMenu(options); }

    var self = this,
        position = options.position,
        property = options.property,
        normalize = options.normalize || false,
        model = options.model,
        ul = $(options.ul);

    self.clear = function () {
        ul.empty();
    };

    function clear(el) {
        ul.children().removeClass('active');
        if (el) {
            $(el).addClass('active');
        }
        _.forEach(model.getCells(), function (cell) {
            cell.unset(property);
        });
    }

    function accent(options) {
        clear(options.el);
        var min = options.limits.min,
            range = options.limits.max - options.limits.min;
        _.forEach(model.getCells(), function (cell) {
            var value = _.chain(cell.statistics() || [])
                .filter({name: options.name, type: options.type})
                .map('value')
                .first().value();
            if (typeof value === 'number') {
                if (normalize) {
                    value = (value - min) / range;
                }
                cell.set(property, value);
            }
        });
    }

    self.load = function () {
        var statistics = _.chain(model.getCells()).map(function (cell) {
            return cell.statistics() || [];
        }).flatten().filter({position: position}).groupBy('type').value();

        _.chain(statistics.percentage || []).map('name').uniq().sort()
            .forEach(function (name) {
                var a = $('<a class="list-group-item"></a>');
                a.text(name + ' (%)');
                ul.append(a);
                a.click(function () {
                    accent({
                        name: name,
                        el: a,
                        type: 'percentage',
                        limits: { min: 0, max: 1}
                    });
                });
            }).value();

        _.chain(statistics.number || []).groupBy('name')
            .mapValues(function (values) {
                return {
                    min: _.chain(values).map('value').min().value(),
                    max: _.chain(values).map('value').max().value()
                };
            })
            .forEach(function (limits, name) {
                var a = $('<a class="list-group-item"></a>');
                a.text(name + ' [' + limits.min + ', ' + limits.max + ']');
                ul.append(a);
                a.click(function () {
                    accent({
                        name: name,
                        el: a,
                        type: 'number',
                        limits: limits
                    });
                });
            }).value();

        (function () {
            var a = $('<a class="list-group-item active"></a>');
            a.text('Nothing');
            ul.prepend(a);
            a.click(function () {
                clear(a);
            });
        }());
    };

    self.reload = function () {
        self.clear();
        self.load();
    };
}

exports.StatisticsMenu = StatisticsMenu;
