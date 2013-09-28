'use strict';

var InvoiceChecker = {
  isValid: function ic_isValid(invoiceNumber) {
    if (typeof invoiceNumber !== 'string')
      invoiceNumber = invoiceNumber.toString(10);

    if (invoiceNumber.length !== 8)
      return false;

    if (/^\d/.test(invoiceNumber))
      return false;

    var cX = [1, 2, 1, 2, 1, 2, 4, 1];
    var cN = invoiceNumber.split('').map(function(n) {
      return parseInt(n, 10);
    });

    var sum = 0;
    cN.forEach(function(n, i) {
      var s = n * cX[i];
      if (s > 9) {
        s = Math.floor(s / 10) + (s % 10);
      }
      sum += s;
    });

    if ((sum % 10) === 0) {
      return true;
    }

    if (cN[6] === 7 && (sum % 10) === 1) {
      return true;
    }

    return false;
  }
};
