'use strict';

var TaxIdChecker = {
  isValid: function(invoiceNumber) {
    if (typeof invoiceNumber !== 'string')
      invoiceNumber = invoiceNumber.toString(10);

    if (invoiceNumber.length !== 8)
      return false;

    if (/[^\d]/.test(invoiceNumber))
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

var CompanyNameService = {
  API_URL: 'http://company.g0v.ronny.tw/api/',
  _getSingleCompanyName: function(companyData) {
    if (typeof companyData['公司名稱'] === 'string') {
      return companyData['公司名稱'];
    }

    // Company has multiple names
    return companyData['公司名稱'][0];
  },
  getCompany: function(queryString, callback) {
    $.getJSON(
      this.API_URL + 'search?q=' +
      encodeURIComponent(queryString) +
      '&callback=?',
      function(res) {
        if (!res || !res.data || res.found !== 1) {
          callback();

          return;
        }

        var companyInfo = {
          name: this._getSingleCompanyName(res.data[0]),
          id: res.data[0]['統一編號']
        };

        callback(companyInfo);
      }.bind(this));
  },
  getCompanyFullNameFromId: function(companyId, callback) {
    $.getJSON(
      this.API_URL + 'show/' + companyId + '?callback=?',
      function(res) {
        if (!res || !res.data) {
          callback();

          return;
        }

        callback(this._getSingleCompanyName(res.data));
      }.bind(this));
  }
};

var InvoiceHelper = function InvoiceHelper(config) {
  this.config = config = config || {};
  config.companyIdElement =
    config.companyIdElement || document.getElementById('company-id');
  config.companyNameElement =
    config.companyNameElement || document.getElementById('company-name');

  config.priceElement =
    config.priceElement || document.getElementById('price');
  config.taxPrecentElement =
    config.taxPrecentElement || document.getElementById('tax-precent');
  config.taxElement =
    config.taxElement || document.getElementById('tax');
  config.totalElement =
    config.totalElement || document.getElementById('total');

  config.totalWordElement =
    config.totalWordElement || document.getElementById('total-word');

  config.companyIdElement.addEventListener('input', this);
  config.companyIdElement.addEventListener('blur', this);
  config.companyNameElement.addEventListener('input', this);
  config.companyNameElement.addEventListener('blur', this);

  config.priceElement.addEventListener('input', this);
  config.priceElement.addEventListener('blur', this);
  config.taxPrecentElement.addEventListener('input', this);
  config.taxPrecentElement.addEventListener('blur', this);
  config.totalElement.addEventListener('input', this);
  config.totalElement.addEventListener('blur', this);

  this._companyNameTimer = undefined;
};
InvoiceHelper.prototype.INPUT_WAIT = 250;
InvoiceHelper.prototype.handleEvent = function(evt) {
  var el = evt.target;
  switch (el) {
    case this.config.companyIdElement:
      this.checkCompanyId(evt.type === 'blur');

      break;

    case this.config.companyNameElement:
      this.checkCompanyName(evt.type === 'blur');

      break;

    case this.config.priceElement:
    case this.config.taxPrecentElement:
    case this.config.totalElement:
      this.calculatePrice(el, evt.type === 'blur');

      break;
  }
};
InvoiceHelper.prototype.checkCompanyId = function(blur) {
  var $id = $(this.config.companyIdElement);
  var $name = $(this.config.companyNameElement);
  var val = $.trim($id.val());

  $id.parent().removeClass('has-error has-warning has-success');
  $name.parent().removeClass('has-error has-warning has-success');

  if (!TaxIdChecker.isValid(val)) {
    if (blur || val.length === 8) {
      $id.parent().addClass('has-error');
      $name.parent().addClass('has-warning');
    } else {
      $id.parent().addClass('has-warning');
      $name.parent().addClass('has-warning');
    }

    return;
  }

  $id.parent().addClass('has-success');
  $name.parent().addClass('has-warning');

  CompanyNameService.getCompanyFullNameFromId(val, function(name) {
    if (!name) {
      $name.parent().removeClass('has-error has-success').addClass('has-warning');

      return;
    }

    $name.parent().removeClass('has-warning has-error').addClass('has-success');
    if ($name.val() !== name)
      $name.val(name);
  });
};
InvoiceHelper.prototype.checkCompanyName = function(blur) {
  clearTimeout(this._companyNameTimer);

  var $id = $(this.config.companyIdElement);
  var $name = $(this.config.companyNameElement);
  var val = $.trim($name.val());

  $name.parent().removeClass('has-error has-warning has-success');

  if (blur && val.length < 3) {
    $name.parent().addClass('has-warning');

    return;
  }

  if (val.length < 3) {
    return;
  }

  $name.parent().addClass('has-warning');

  if (blur) {
    this._checkCompanyNameRemote(true);
  } else {
    this._companyNameTimer = setTimeout(function() {
      this._checkCompanyNameRemote(false);
    }.bind(this), this.INPUT_WAIT);
  }
};
InvoiceHelper.prototype._checkCompanyNameRemote = function(blur) {
  var $id = $(this.config.companyIdElement);
  var $name = $(this.config.companyNameElement);
  var val = $.trim($name.val());

  CompanyNameService.getCompany(val, function(info) {
    if (!info) {
      $name.parent().removeClass('has-error has-success').addClass('has-warning');

      return;
    }

    if (blur) {
      if ($name.val() !== info.name) {
        $name.val(info.name);
      }
      $name.parent().removeClass('has-warning has-error').addClass('has-success');
    }
    if ($id.val() !== info.id) {
      $id.val(info.id);
    }
    $id.parent().removeClass('has-warning has-error').addClass('has-success');
  });
};
InvoiceHelper.prototype.calculatePrice = function(baseElement, blur) {
  var $price = $(this.config.priceElement);
  var $taxPrecent = $(this.config.taxPrecentElement);
  var $tax = $(this.config.taxElement);
  var $total = $(this.config.totalElement);

  switch (baseElement) {
    case this.config.priceElement:
      var price = parseInt($price.val(), 10) || 0;
      var rate = 0.01 * parseFloat($taxPrecent.val(), 10) || 0;
      var tax = Math.floor(price * rate);

      if (blur) {
        $price.val(price);
      }
      $tax.val(tax);
      $total.val(price + tax);
      this._updateTotalWord(price + tax);

      break;

    case this.config.taxPrecentElement:
      var price = parseInt($price.val(), 10) || 0;
      var rate = 0.01 * parseFloat($taxPrecent.val(), 10) || 0;
      var tax = Math.floor(price * rate);

      $price.val(price);
      $tax.val(tax);
      $total.val(price + tax);
      this._updateTotalWord(price + tax);

      break;

    case this.config.totalElement:
      var total = parseInt($total.val(), 10) || 0;
      var rate = 0.01 * parseFloat($taxPrecent.val(), 10) || 0;
      var price = Math.ceil(total / (1 + rate));
      var tax = total - price;

      $tax.val(tax);
      $price.val(price);
      if (blur) {
        $total.val(total);
      }
      this._updateTotalWord(total);

      break;
  }
};
InvoiceHelper.prototype._updateTotalWord = function(num) {
  var cWord = '零壹貳參肆伍陸柒捌玖';
  var cOrder = ' 拾佰仟萬拾佰仟億';

  if (typeof num !== 'string')
    num = num.toString(10);

  if (num.length > cOrder.length) {
    $(this.config.totalWordElement).text('∞');

    return;
  }

  var word = '';
  var cNum = num.split('').map(function(n) {
      return parseInt(n, 10);
  });

  cNum.reverse().forEach(function(n, i) {
    if ((i !== 0 && n !== 0) ||
      ((i % 4 === 0) && (cNum[i + 1] || cNum[i + 2] || cNum[i + 3]))) {
      word = cOrder[i] + word;
    }

    if (n !== 0 || (i === 0 && n === 0 && num.length === 1))
      word = cWord[n] + word;
  });

  $(this.config.totalWordElement).text(word);
};

var TodayWidget = function TodayWidget(config) {
  this.config = config = config || {};
  config.yearElement =
    config.yearElement || document.getElementById('rocYear');
  config.monthElement =
    config.monthElement || document.getElementById('month');
  config.dateElement =
    config.dateElement || document.getElementById('date');

  this.update();

  // TODO: update labels after midnight here.
  // window.addElementListener('moztimechange', ...)
  // setTimeout(..., timeToMidnight);
};
TodayWidget.prototype.update = function() {
  var d = new Date();
  $(this.config.yearElement).text(d.getFullYear() - 1911);
  $(this.config.monthElement).text(d.getMonth() + 1);
  $(this.config.dateElement).text(d.getDate());
};


// TODO: move these calls to another file so we don't run them
// on the unit test page.
new InvoiceHelper();
new TodayWidget();
