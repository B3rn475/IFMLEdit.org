// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    $ = require('jquery'),
    ko = require('knockout'),
    document = require('document');

function ElementViewModel(options, close) {
    var self = this;
    self.statistics = options.statistics;
    this.close = close;
}

function ModalStatistics(options) {
    if (!(this instanceof ModalStatistics)) { return new ModalStatistics(options); }
    options = options || {};

    if (typeof options.cell !== 'object') { throw new Error('At least element or link should be provided'); }

    var cell = options.cell,
        statistics = cell.statistics && cell.statistics(),
        el = $(require('./modal.html'));

    if (!statistics) { return; }

    $(document.body).append(el);

    function tearDown() {
        el.remove();
    }

    ko.applyBindings(new ElementViewModel({statistics: statistics}, function () { el.modal('hide'); }), el.find('.modal-content')[0]);

    el.modal('show').on('hidden.bs.modal', tearDown);
}

exports.ModalStatistics = ModalStatistics;
