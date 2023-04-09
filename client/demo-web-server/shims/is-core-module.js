// Copyright (c) 2023, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true */
/*globals self */
"use strict";

module.exports = function (module) {
  switch (module) {
    case 'assert':
    case 'buffer':
    case 'console':
    case 'fs':
    case 'http':
      return true;
    default:
      return false;
  }
};
