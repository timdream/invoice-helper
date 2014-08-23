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
      encodeURIComponent(queryString),
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
      this.API_URL + 'show/' + companyId,
      function(res) {
        if (!res || !res.data) {
          callback();

          return;
        }

        callback(this._getSingleCompanyName(res.data));
      }.bind(this));
  }
};

var CompanyNameIdWidget = function CompanyNameIdWidget(config) {
  this.config = config = config || {};
  config.companyIdElement =
    config.companyIdElement || document.getElementById('company-id');
  config.companyNameElement =
    config.companyNameElement || document.getElementById('company-name');
  config.companyNamesElement =
    config.companyNamesElement || document.getElementById('company-names');
  config.checkingElement =
    config.checkingElement || document.getElementById('company-id-name-checking');

  config.companyIdElement.addEventListener('input', this);
  config.companyIdElement.addEventListener('blur', this);
  config.companyNameElement.addEventListener('input', this);
  config.companyNameElement.addEventListener('blur', this);

  this._companyNameTimer = undefined;
  this._apiRequestId = 0;

  this._companyNames =
    JSON.parse(localStorage.getItem('company-autocomplete') || '[]');

  var $companyNames = $(this.config.companyNamesElement);

  this._companyNames.forEach(function(str) {
    var data = str.split('::', 2);
    $companyNames.append($('<option />').val(data[1]));
  }, this);
};
CompanyNameIdWidget.prototype.LOCAL_STORAGE_KEY = 'company-autocomplete';
CompanyNameIdWidget.prototype.INPUT_WAIT = 250;
CompanyNameIdWidget.prototype.handleEvent = function(evt) {
  var el = evt.target;
  switch (el) {
    case this.config.companyIdElement:
      this.checkCompanyId(evt.type === 'blur');

      break;

    case this.config.companyNameElement:
      if ('isComposing' in evt && evt.isComposing) {
        return;
      }

      this.checkCompanyName(evt.type === 'blur');

      break;
  }
};
CompanyNameIdWidget.prototype.checkCompanyId = function(blur) {
  var $id = $(this.config.companyIdElement);
  var $name = $(this.config.companyNameElement);
  var $checking = $(this.config.checkingElement);
  var val = $.trim($id.val());

  clearTimeout(this._companyNameTimer);
  this._apiRequestId++;
  $checking.removeClass('show');

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

  var apiRequestId = this._apiRequestId;
  $checking.addClass('show');
  CompanyNameService.getCompanyFullNameFromId(val, function(name) {
    // Ignore the callback if we have another API request in-flight.
    if (apiRequestId !== this._apiRequestId)
      return;

    $checking.removeClass('show');

    if (!name) {
      $name.parent().removeClass('has-error has-success').addClass('has-warning');

      return;
    }

    $name.parent().removeClass('has-warning has-error').addClass('has-success');
    this.addCompanyNameRecords(val, name);

    if ($name.val() !== name)
      $name.val(name);
  }.bind(this));
};
CompanyNameIdWidget.prototype.addCompanyNameRecords = function(val, name) {
  var str = val + '::' + name;

  if (this._companyNames.indexOf(str) !== -1) {
    return;
  }

  this._companyNames.push(str);
  $(this.config.companyNamesElement).append($('<option />').val(name));
  localStorage.setItem(
    this.LOCAL_STORAGE_KEY, JSON.stringify(this._companyNames));
};
CompanyNameIdWidget.prototype.checkCompanyName = function(blur) {
  clearTimeout(this._companyNameTimer);
  this._apiRequestId++;

  var $id = $(this.config.companyIdElement);
  var $name = $(this.config.companyNameElement);
  var $checking = $(this.config.checkingElement);
  var val = $.trim($name.val());

  $checking.removeClass('show');
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
CompanyNameIdWidget.prototype._checkCompanyNameRemote = function(blur) {
  var $id = $(this.config.companyIdElement);
  var $checking = $(this.config.checkingElement);
  var companyNameElement = this.config.companyNameElement;
  var $nameContainer = $(companyNameElement.parentNode);

  var apiRequestId = this._apiRequestId;
  $checking.addClass('show');
  CompanyNameService.getCompany(companyNameElement.value, function(info) {
    // Ignore the callback if we have another API request in-flight.
    if (apiRequestId !== this._apiRequestId)
      return;

    $checking.removeClass('show');

    if (!info) {
      $nameContainer.removeClass('has-error has-success').addClass('has-warning');

      return;
    }

    if (companyNameElement.value !== info.name) {
      if (blur) {
        companyNameElement.value = info.name;
      } else {
        var caretPosition = companyNameElement.selectionStart;
        companyNameElement.value = info.name;
        companyNameElement.selectionStart = caretPosition;
        companyNameElement.selectionEnd = info.name.length;
      }
    }
    $nameContainer.removeClass('has-warning has-error').addClass('has-success');
    this.addCompanyNameRecords(info.id, info.name);

    if ($id.val() !== info.id) {
      $id.val(info.id);
    }
    $id.parent().removeClass('has-warning has-error').addClass('has-success');
  }.bind(this));
};

var PriceWidget = function PriceWidget(config) {
  this.config = config = config || {};

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

  config.priceElement.addEventListener('input', this);
  config.priceElement.addEventListener('blur', this);
  config.taxPrecentElement.addEventListener('input', this);
  config.taxPrecentElement.addEventListener('blur', this);
  config.totalElement.addEventListener('input', this);
  config.totalElement.addEventListener('blur', this);
};
PriceWidget.prototype.handleEvent = function(evt) {
  this.calculatePrice(evt.target, evt.type === 'blur');
};
PriceWidget.prototype.calculatePrice = function(baseElement, blur) {
  var priceElement = this.config.priceElement;
  var taxPrecentElement = this.config.taxPrecentElement;
  var taxElement = this.config.taxElement;
  var totalElement = this.config.totalElement;
  var $word = $(this.config.totalWordElement);

  switch (baseElement) {
    case priceElement:
      var price = this.getIntValue(priceElement) || 0;
      var rate = 0.01 * parseFloat(taxPrecentElement.value, 10) || 0;
      var tax = Math.round(price * rate);

      if (blur) {
        priceElement.value = price;
      }
      taxElement.value = tax;
      totalElement.value = price + tax;

      break;

    case taxPrecentElement:
      var price = this.getIntValue(priceElement) || 0;
      var rate = 0.01 * parseFloat(taxPrecentElement.value, 10) || 0;
      var tax = Math.round(price * rate);

      priceElement.value = price;
      taxElement.value = tax;
      totalElement.value = price + tax;

      break;

    case totalElement:
      var total = this.getIntValue(totalElement) || 0;
      var rate = 0.01 * parseFloat(taxPrecentElement.value, 10) || 0;
      var price = Math.round(total / (1 + rate));
      var tax = total - price;

      taxElement.value = tax;
      priceElement.value = price;
      if (blur) {
        totalElement.value = total;
      }

      break;
  }
  $word.text(this.getNumInWord(this.getIntValue(totalElement)));
  // XXX Workaround Mobile Safari where it did not update caret position
  // in the input event function loop.
  if (!blur) {
    window.setTimeout(function() {
      this.updateNumberSeparatorToElement(priceElement);
      this.updateNumberSeparatorToElement(taxElement);
      this.updateNumberSeparatorToElement(totalElement);
    }.bind(this));
  } else {
    this.updateNumberSeparatorToElement(priceElement);
    this.updateNumberSeparatorToElement(taxElement);
    this.updateNumberSeparatorToElement(totalElement);
  }
};
PriceWidget.prototype.getNumInWord = function(num) {
  var cWord = '零壹貳參肆伍陸柒捌玖';
  var cOrder = ' 拾佰仟萬拾佰仟億';

  if (typeof num !== 'string')
    num = num.toString(10);

  if (num.length > cOrder.length) {
    return '∞';
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

  return word;
};
PriceWidget.prototype.getIntValue = function(el) {
  return parseInt(el.value.replace(/[^\d]/g, ''), 10) || 0;
};
PriceWidget.prototype.updateNumberSeparatorToElement = function(el) {
  var caretPosition = el.selectionStart;
  var caretOffset = 0;
  var val = [];

  // Remove non-number characters
  el.value.split('').forEach(function(c, i) {
    if (/[^\d]/.test(c)) {
      if (i < caretPosition)
        caretOffset--;
    } else {
      val.push(c);
    }
  });

  // Adding separator
  var value = '';
  val.forEach(function(c, i) {
    value += c;
    // Add separator for every three digit but not behind the 0th digit.
    if (i !== (val.length - 1) && !((val.length - 1 - i) % 3)) {
      // Move caret after adding a separator but not to do it
      // if we will endded up moving caret behind the separator.
      if (i < caretPosition && value.length !== caretPosition + caretOffset) {
        caretOffset++;
      }
      value += ',';
    }
  });

  if (el.value !== value) {
    el.value = value;
    // Only set the selectionEnd/Start when the element is currently focused.
    if (document.activeElement === el) {
      el.selectionStart = el.selectionEnd = caretPosition + caretOffset;
    }
  }
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
new CompanyNameIdWidget();
new PriceWidget();
new TodayWidget();
