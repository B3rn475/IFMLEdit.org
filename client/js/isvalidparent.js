// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true */
"use strict";

var utils = require('almost-joint').utils;

function isValidParent(cellView, parentCellView) {
    var element = cellView && cellView.model,
        parent = parentCellView && parentCellView.model,
        containers;
    if (!parent) {
        return !element.requireEmbedding;
    }
    if (element.fixedParent && element.get('parent')) {
        return element.get('parent') === parent.id;
    }
    containers = element.containers || [];
    if (-1 === containers.indexOf(parent.get('type'))) {
        return false;
    }
    if (element.fullyContained) {
        return utils.isFullyContained(element, parent);
    }
    return true;
}

exports.isValidParent = isValidParent;
