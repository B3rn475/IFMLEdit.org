// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    backbone = require('backbone'),
    joint = require('joint');

function isBottomPlaceChart(place) {
    return _.all(place.getEmbeddedCells(), function (cell) { return cell.get('type') !== 'pcn.PlaceChart'; });
}

function getTokens(place) {
    if (isBottomPlaceChart(place)) {
        return place.get('tokens');
    }
    return _.chain(place.getEmbeddedCells())
        .filter(function (cell) { return cell.get('type') === 'pcn.PlaceChart'; })
        .map(function (place) { return getTokens(place); })
        .max().value();
}

function Simulator(options) {
    if (!(this instanceof Simulator)) { return new Simulator(options); }
    _.extend(this, backbone.Events);
    options = options || {};

    var self = this,
        model = options.model,
        paper = options.paper,
        running = false;

    function getActiveTransitions() {
        return _.chain(model.getCells())
            .filter(function (cell) { return cell.get('type') === 'pcn.Transition'; })
            .filter(function (transition) {
                var inbound = model.getConnectedLinks(transition, {inbound: true});
                return _.all(inbound, function (link) {
                    return getTokens(link.getSourceElement()) >= link.get('tokens');
                });
            })
            .value();
    }

    function activateTransition(transition, next) {
        var inbound = model.getConnectedLinks(transition, {inbound: true}),
            outbound = _.map(model.getConnectedLinks(transition, {outbound: true}), function (link) { return {link: link, multiplier: 1}; });
        _.each(inbound, function (link) {
            link.findView(paper).sendToken(joint.V('circle', { r: 7, fill: 'orange' }).node, 1000);
            var place = link.getSourceElement();
            if (isBottomPlaceChart(place)) {
                place.set('tokens', Math.max(0, parseInt(place.get('tokens'), 10) - parseInt(link.get('tokens'), 10)));
            } else {
                _.each(_.chain(place.getEmbeddedCells({deep: true}))
                        .filter(function (cell) { return cell.get('type') === 'pcn.PlaceChart'; })
                        .filter(isBottomPlaceChart).value(),
                    function (place) { place.set('tokens', 0); });
            }
        });
        function subStep() {
            if (outbound.length) {
                var later = [];
                outbound = _.chain(outbound).map(function (descriptor) {
                    if (!descriptor.link.graph) { return []; }
                    var link = descriptor.link,
                        multiplier = descriptor.multiplier,
                        place = link.getTargetElement();
                    link.findView(paper).sendToken(joint.V('circle', { r: 7, fill: 'orange' }).node, 1000);
                    if (isBottomPlaceChart(place)) {
                        later.push({place: place, tokens: parseInt(place.get('tokens'), 10) + parseInt(link.get('tokens'), 10) * multiplier});
                        return [];
                    }
                    return _.chain(model.getConnectedLinks(place, {outbound: true}))
                        .filter(function (link) { return link.getTargetElement().get('type') === 'pcn.PlaceChart'; })
                        .map(function (l) { return {link: l, multiplier: parseInt(link.get('tokens'), 10) * multiplier}; }).value();
                }).flatten().value();
                setTimeout(function () {
                    _.each(later, function (descriptor) {
                        descriptor.place.set('tokens', descriptor.tokens);
                    });
                    subStep();
                }, 1000);
            } else {
                setTimeout(next, 1000);
            }
        }
        setTimeout(subStep, 1000);
    }

    function doStep() {
        if (!running) { return; }
        var transitions = getActiveTransitions(),
            priorities = _.chain(transitions)
                .groupBy(function (t) { return t.get('priority'); })
                .pairs()
                .sortBy(function (p1, p2) { return parseInt(p1[0], 10) - parseInt(p2[0], 10); })
                .map(function (p) { return p[1]; })
                .value();
        if (transitions.length) {
            while (priorities.length > 1 && !_.random(0, 10)) {
                priorities = _.rest(priorities);
            }
            activateTransition(_.sample(_.first(priorities)), doStep);
        } else {
            self.trigger('stop');
            running = false;
        }
    }

    this.isRunning = function () {
        return running;
    };

    this.start = function () {
        if (running) { return; }
        this.trigger('start');
        running = true;
        doStep();
    };

    this.stop = function () {
        if (!running) { return; }
        this.trigger('stop');
        running = false;
    };
}

exports.Simulator = Simulator;
