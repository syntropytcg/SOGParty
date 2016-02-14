var BuySellAddressInDropdownItemModel = function (address, label, asset, balance) {
    this.ADDRESS = address;
    this.LABEL = label;
    this.SELECT_LABEL = (label ? ("<b>" + label + "</b><br/>" + address + "<br/>" + asset + " " + i18n.t('bal') + " " + balance) : (address + "<br/>" + asset + " " + i18n.t('bal') + " " + balance));
    this.BALANCE = parseFloat(balance);
};

ko.validation.rules['ordersIsExistingAssetName'] = {
    validator: function (asset, self) {
        if (asset == 'XCP') return true;
        var match = ko.utils.arrayFirst(self.allAssets(), function (item) {
            return item == asset;
        });
        return match;
    },
    message: i18n.t("asset_doesnt_exist")
};

ko.validation.rules['baseDivisibilityIsOk'] = {
    validator: function (value, self) {
        if (!self.baseAssetIsDivisible() && (value % 1) > 0) {
            return false;
        } else {
            return true;
        }
    },
    message: i18n.t("nodivisible_amount_incorrect")
};

ko.validation.rules['quoteDivisibilityIsOk'] = {
    validator: function (value, self) {
        if (!self.quoteAssetIsDivisible() && (value % 1) > 0) {
            return false;
        } else {
            return true;
        }
    },
    message: i18n.t("nodivisible_total_incorrect")
};

ko.validation.registerExtenders();

function ExchangeViewModel() {
    var self = this;
    self.dexHome = ko.observable(true);
    self.showSingleCurrency = ko.observable(true);
    self.showingSwapbots = ko.observable(false);
    self.availableFiat = ko.observableArray(['USD','CNY','GBP','AUD','EUR','MXN','CHF']);



    self._lastWindowWidth = null;

    self.latestTrades = ko.observableArray([]); //populated with the VIEW_PRICES_NUM_LATEST_TRADES latest trades (of any asset pair)
    self.allAssets = ko.observableArray([]);
    //^ a list of all existing assets (for choosing which asset to buy)
    self.tradeHistory = ko.observableArray([]);
    //^ a list of the last X trades for the specified asset pair
    self.askBook = ko.observableArray([]);
    self.bidBook = ko.observableArray([]);

    self.asset1IsDivisible = ko.observable(null);
    self.asset2IsDivisible = ko.observable(null);

    self.asset1 = ko.observable('').extend({
        required: true,
        ordersIsExistingAssetName: self
    });
    self.asset2 = ko.observable('').extend({
        required: true,
        ordersIsExistingAssetName: self,
        validation: {
            validator: function (val, self) {
                return val !== self.asset1();
            },
            message: i18n.t('same_as_other_asset'),
            params: self
        }
    });

    self.selectedQuoteAsset = ko.observable();
    self.selectedQuoteAsset.subscribe(function (value) {
        /*
        if (value == 'XCP') self.asset2(value);
        else self.asset2('')
         */
        self.asset2(value);
    });

    self.assetPair = ko.computed(function () {
        if (!self.asset1() || !self.asset2()) return null;
        var pair = assetsToAssetPair(self.asset1(), self.asset2());
        return pair; //2 element array, as [baseAsset, quoteAsset]
    }, self);
    self.dispAssetPair = ko.computed(function () {
        if (!self.assetPair()) return null;
        var pair = self.assetPair();
        return pair[0] + "/" + pair[1];
    }, self);
    self.dispAssetPair.subscribeChanged(function (newValue, prevValue) {
        self.currentMarketPrice(0);
    });
    self.baseAsset = ko.computed(function () {
        if (!self.assetPair()) return null;
        return self.assetPair()[0];
    }, self);
    self.quoteAsset = ko.computed(function () {
        if (!self.assetPair()) return null;
        return self.assetPair()[1];
    }, self);
    self.baseAssetIsDivisible = ko.computed(function () {
        if (!self.assetPair()) return null;
        return self.baseAsset() == self.asset1() ? self.asset1IsDivisible() : self.asset2IsDivisible();
    }, self);
    self.quoteAssetIsDivisible = ko.computed(function () {
        if (!self.assetPair()) return null;
        return self.quoteAsset() == self.asset1() ? self.asset1IsDivisible() : self.asset2IsDivisible();
    }, self);

    self.delayedAssetPairSelection = ko.computed(self.assetPair).extend({
        rateLimit: {
            method: "notifyWhenChangesStop",
            timeout: 400
        }
    });
    self.delayedAssetPairSelection.subscribeChanged(function (newValue, prevValue) {
        if (newValue == null || !self.validationModelBaseOrders.isValid() || self.asset1() == self.asset2()) {
            self.dexHome(true);
            return;
        }
        self.buyAmount(0);
        self.sellAmount(0);
        self.buyTotal(0);
        self.sellTotal(0);
        self.selectedAddressForBuy(null);
        self.selectedAddressForSell(null);
        $('table.buySellForm span.invalid').hide(); // hack
        self.baseAssetImage('');
        self.dexHome(false);
        self.fetchMarketDetails();
        $('a.top_user_pair').removeClass('selected_pair');
        $('a.top_user_pair.pair_' + self.baseAsset() + self.quoteAsset()).addClass('selected_pair');
    });

    //VALIDATION MODELS
    self.validationModelBaseOrders = ko.validatedObservable({
        asset1: self.asset1,
        asset2: self.asset2
    });


    self.balances = {};
    self.currentMarketPrice = ko.observable();
    self.marketProgression24h = ko.observable();
    self.baseAssetImage = ko.observable('');

    self.marketProgression24hDisp = ko.computed(function () {
        var span = $('<span></span>').css('font-size', '12px').css('color', '#000');
        if (self.marketProgression24h() == 0) {
            span.text('0%');
        } else if (self.marketProgression24h() > 0) {
            span.text('+' + self.marketProgression24h() + '%').addClass('txt-color-greenDark');
        } else {
            span.text('-' + self.marketProgression24h() + '%').addClass('txt-color-red');
        }
        return $('<div>').append(span).html();
    });

    /********************************************

     SELL FORM BEGIN

     ********************************************/

    self.highestBidPrice = ko.observable();
    self.sellPrice = ko.observable(0).extend({
        required: true,
        isValidPositiveQuantity: self
    });
    self.sellAmount = ko.observable(0).extend({
        required: true,
        baseDivisibilityIsOk: self
    });
    self.sellTotal = ko.observable(0).extend({
        required: true,
        isValidPositiveQuantity: self,
        quoteDivisibilityIsOk: self
    });
    self.sellPriceHasFocus = ko.observable();
    self.sellAmountHasFocus = ko.observable();
    self.sellTotalHasFocus = ko.observable();
    self.obtainableForSell = ko.observable();
    self.selectedAddressForSell = ko.observable();
    self.availableBalanceForSell = ko.observable();

    self.availableAddressesForSell = ko.computed(function () { //stores BuySellAddressInDropdownItemModel objects
        if (!self.baseAsset()) return null; //must have a sell asset selected
        //Get a list of all of my available addresses with the specified sell asset balance
        var addresses = WALLET.getAddressesList(true);
        var addressesWithBalance = [];
        var bal = null, address = null, addressObj = null;
        for (var i = 0; i < addresses.length; i++) {
            address = addresses[i][0];
            addressObj = WALLET.getAddressObj(address);
            bal = WALLET.getBalance(address, self.baseAsset());
            if (addressObj.IS_WATCH_ONLY) continue; //don't list watch addresses, obviously
            if (bal) {
                addressesWithBalance.push(new BuySellAddressInDropdownItemModel(addresses[i][0], addresses[i][1], self.baseAsset(), bal));
                self.balances[addresses[i][0] + '_' + self.baseAsset()] = parseFloat(bal);
            }
        }

        addressesWithBalance.sort(function (left, right) {
            return left.BALANCE == right.BALANCE ? 0 : (left.BALANCE > right.BALANCE ? -1 : 1);
        });

        if (addressesWithBalance.length == 0) {
            $('#sellButton').addClass('disabled');
            $('div.sellForm').addClass('disabled');
            self.availableBalanceForSell(0);
            self.obtainableForSell(0);
        } else {
            $('#sellButton').removeClass('disabled');
            $('div.sellForm').removeClass('disabled');
        }


        return addressesWithBalance;
    }, self);

    self.selectedAddressForSell.subscribe(function (value) {
        if (!value) return;
        var bal = self.balances[value + '_' + self.baseAsset()];
        self.availableBalanceForSell(bal);
        self.obtainableForSell(mulFloat(bal, self.highestBidPrice()));
    });

    self.sellPrice.subscribe(function (price) {
        if (!self.sellPriceHasFocus() || !self.sellAmount()) return;
        self.sellTotal(noExponents(mulFloat(self.sellAmount(), price)));
    });

    self.sellAmount.subscribe(function (amount) {
        if (!self.sellAmountHasFocus() || !self.sellPrice()) return;
        self.sellTotal(noExponents(mulFloat(self.sellPrice(), amount)));
    });

    self.sellTotal.subscribe(function (total) {
        if (!self.sellTotalHasFocus() || !self.sellPrice()) return;
        if (total == 0) {
            self.sellAmount(0);
        } else {
            self.sellAmount(noExponents(divFloat(total, self.sellPrice())));
        }
    });

    self.sellAmount.extend({
        required: true,
        isValidPositiveQuantity: self,
        validation: {
            validator: function (val, self) {
                return parseFloat(val) <= self.availableBalanceForSell();
            },
            message: i18n.t('quantity_exceeds_balance'),
            params: self
        }
    });

    self.sellValidation = ko.validatedObservable({
        sellAmount: self.sellAmount,
        sellPrice: self.sellPrice,
        sellTotal: self.sellTotal
    });

    self.sellFee = ko.computed(function () {
        var give_quantity = denormalizeQuantity(self.sellAmount(), self.baseAssetIsDivisible());
        var fee_provided = MIN_FEE;
        return normalizeQuantity(fee_provided);
    });

    self.sellRedeemableFee = ko.observable(normalizeQuantity(2 * MULTISIG_DUST_SIZE));

    self.selectBuyOrder = function (order, notFromClick) {
        var price = new Decimal(cleanHtmlPrice(order.price));
        var amount1 = new Decimal(self.availableBalanceForSell());
        var amount2 = new Decimal(order.base_depth);
        var amount = amount1.compare(amount2) > 0 ? amount2 : amount1;
        var total;

        if (self.quoteAssetIsDivisible() == self.baseAssetIsDivisible()) {
            total = price.mul(amount);
        } else if (self.quoteAssetIsDivisible() && !self.baseAssetIsDivisible()) {
            amount = Math.floor(amount);
            total = mulFloat(amount, price);
        } else if (!self.quoteAssetIsDivisible() && self.baseAssetIsDivisible()) {
            total = Math.floor(price.mul(amount));
            amount = divFloat(total, price);
        }

        self.sellPrice(roundAmount(price));
        self.sellAmount(roundAmount(amount));
        self.sellTotal(roundAmount(total));

        if (typeof(notFromClick) != 'boolean' || notFromClick == false) {
            self.selectSellOrder(order, true);
        }
    };

    self.setMaxSellAmount = function () {
        var amount = self.availableBalanceForSell();
        if (self.sellPrice()) {
            if (self.quoteAssetIsDivisible()) {
                self.sellTotal(mulFloat(self.sellPrice(), amount));
            } else {
                var total = Math.floor(mulFloat(self.sellPrice(), amount));
                self.sellTotal(total);
                amount = divFloat(total, self.sellPrice());
            }
        }
        self.sellAmount(amount);
    };

    self.doSell = function () {
        var give_quantity = denormalizeQuantity(self.sellAmount(), self.baseAssetIsDivisible());
        var get_quantity = denormalizeQuantity(self.sellTotal(), self.quoteAssetIsDivisible());
        var fee_required = 0;
        var fee_provided = MIN_FEE;
        var expiration = parseInt(WALLET_OPTIONS_MODAL.orderDefaultExpiration());

        var params = {
            source: self.selectedAddressForSell(),
            give_quantity: give_quantity,
            give_asset: self.baseAsset(),
            _give_divisible: self.baseAssetIsDivisible(),
            get_quantity: get_quantity,
            get_asset: self.quoteAsset(),
            _get_divisible: self.quoteAssetIsDivisible(),
            fee_required: fee_required,
            fee_provided: fee_provided,
            expiration: expiration
        };

        var onSuccess = function (txHash, data, endpoint, addressType, armoryUTx) {
            trackEvent('Exchange', 'Sell', self.dispAssetPair());

            var message = "";
            if (armoryUTx) {
                message = i18n.t("you_sell_order_will_be_placed", self.sellAmount(), self.baseAsset());
            } else {
                message = i18n.t("you_sell_order_has_been_placed", self.sellAmount(), self.baseAsset());
            }

            WALLET.showTransactionCompleteDialog(message + " " + i18n.t(ACTION_PENDING_NOTICE), message, armoryUTx);
        };

        WALLET.doTransaction(self.selectedAddressForSell(), "create_order", params, onSuccess);
    };

    self.sell = function () {
        if (!self.sellValidation.isValid()) {
            self.sellValidation.errors.showAllMessages();
            return false;
        }

        var buyOrders = self.bidBook();
        var amountCumul = 0;
        var estimatedTotalPrice = 0;
        for (var i = 0; i < buyOrders.length; i++) {
            if (buyOrders[i]['price'] >= self.sellPrice() && amountCumul < self.sellAmount()) {
                var vol = Math.min(self.sellAmount() - amountCumul, buyOrders[i]['amount']);
                estimatedTotalPrice += mulFloat(vol, buyOrders[i]['price']);
                amountCumul += vol;
            }
        }
        if (amountCumul < self.sellAmount()) {
            estimatedTotalPrice += mulFloat(self.sellAmount() - amountCumul, self.sellPrice());
        }

        estimatedTotalPrice = smartFormat(estimatedTotalPrice);

        var message = '<table class="confirmOrderBox">';
        message += '<tr><td><b>' + i18n.t('price') + ': </b></td><td style="text-align:right">' + self.sellPrice() + '</td><td>' + self.quoteAsset() + '/' + self.baseAsset() + '</td></tr>';
        message += '<tr><td><b>' + i18n.t('amount') + ': </b></td><td style="text-align:right">' + self.sellAmount() + '</td><td>' + self.baseAsset() + '</td></tr>';
        message += '<tr><td><b>' + i18n.t('total') + ': </b></td><td style="text-align:right">' + self.sellTotal() + '</td><td>' + self.quoteAsset() + '</td></tr>';
        message += '<tr><td><b>' + i18n.t('real_estimated_total') + ': </b></td><td style="text-align:right">' + estimatedTotalPrice + '</td><td>' + self.quoteAsset() + '</td></tr>';
        message += '</table>';

        bootbox.dialog({
            title: i18n.t("confirm_your_order"),
            message: message,
            buttons: {
                "cancel": {
                    label: i18n.t("close"),
                    className: "btn-danger",
                    callback: function () {
                        bootbox.hideAll();
                        return false;
                    }
                },
                "confirm": {
                    label: i18n.t("confirm_order"),
                    className: "btn-primary",
                    callback: function () {
                        bootbox.hideAll();
                        self.doSell();
                        return true;
                    }
                }

            }
        });

    };
    /* SELL FORM END */

    /********************************************

     BUY FORM BEGIN

     ********************************************/

    self.lowestAskPrice = ko.observable();
    self.buyPrice = ko.observable(0).extend({
        required: true,
        isValidPositiveQuantity: self
    });
    self.buyAmount = ko.observable(0).extend({
        required: true,
        isValidPositiveQuantity: self,
        baseDivisibilityIsOk: self
    });
    self.buyTotal = ko.observable(0).extend({
        required: true,
        isValidPositiveQuantity: self,
        quoteDivisibilityIsOk: self
    });
    self.buyPriceHasFocus = ko.observable();
    self.buyAmountHasFocus = ko.observable();
    self.buyTotalHasFocus = ko.observable();
    self.obtainableForBuy = ko.observable();
    self.selectedAddressForBuy = ko.observable();
    self.availableBalanceForBuy = ko.observable();

    self.availableAddressesForBuy = ko.computed(function () { //stores BuySellAddressInDropdownItemModel objects
        if (!self.quoteAsset()) return null; //must have a sell asset selected
        //Get a list of all of my available addresses with the specified sell asset balance
        var addresses = WALLET.getAddressesList(true);
        var addressesWithBalance = [];
        var bal = null, address = null, addressObj = null;
        for (var i = 0; i < addresses.length; i++) {
            address = addresses[i][0];
            addressObj = WALLET.getAddressObj(address);
            bal = WALLET.getBalance(address, self.quoteAsset());
            if (addressObj.IS_WATCH_ONLY) continue; //don't list watch addresses, obviously
            if (bal) {
                addressesWithBalance.push(new BuySellAddressInDropdownItemModel(addresses[i][0], addresses[i][1], self.quoteAsset(), bal));
                self.balances[addresses[i][0] + '_' + self.quoteAsset()] = parseFloat(bal);
            }
        }

        addressesWithBalance.sort(function (left, right) {
            return left.BALANCE == right.BALANCE ? 0 : (left.BALANCE > right.BALANCE ? -1 : 1);
        });

        if (addressesWithBalance.length == 0) {
            $('#buyButton').addClass('disabled');
            $('div.buyForm').addClass('disabled');
            self.availableBalanceForBuy(0);
            self.obtainableForBuy(0);
        } else {
            $('#buyButton').removeClass('disabled');
            $('div.buyForm').removeClass('disabled');
        }

        return addressesWithBalance;
    }, self);

    self.selectedAddressForBuy.subscribe(function (value) {
        var bal = self.balances[value + '_' + self.quoteAsset()];
        self.availableBalanceForBuy(bal);
        if (self.lowestAskPrice()) {
            if (bal == 0) {
                self.obtainableForBuy(0);
            } else {
                self.obtainableForBuy(divFloat(bal, self.lowestAskPrice()));
            }
        }
    });

    self.buyPrice.subscribe(function (price) {
        if (!self.buyPriceHasFocus() || !self.buyAmount()) return;
        self.buyTotal(noExponents(mulFloat(self.buyAmount(), price)));
    });

    self.buyAmount.subscribe(function (amount) {
        if (!self.buyAmountHasFocus() || !self.buyPrice()) return;
        self.buyTotal(noExponents(mulFloat(self.buyPrice(), amount)));
    });

    self.buyTotal.subscribe(function (total) {
        if (!self.buyTotalHasFocus() || !self.buyPrice()) return;
        if (total == 0) {
            self.buyAmount(0);
        } else {
            self.buyAmount(noExponents(divFloat(total, self.buyPrice())));
        }
    });

    self.buyTotal.extend({
        required: true,
        isValidPositiveQuantity: self,
        validation: {
            validator: function (val, self) {
                return parseFloat(val) <= self.availableBalanceForBuy();
            },
            message: i18n.t('quantity_exceeds_balance'),
            params: self
        }
    });

    self.buyValidation = ko.validatedObservable({
        buyTotal: self.buyTotal,
        buyPrice: self.buyPrice,
        buyAmount: self.buyAmount
    });

    self.buyFee = ko.computed(function () {
        var give_quantity = denormalizeQuantity(self.buyTotal(), self.quoteAssetIsDivisible());
        var fee_provided = MIN_FEE;
        return normalizeQuantity(fee_provided);
    });

    self.buyRedeemableFee = ko.observable(normalizeQuantity(2 * MULTISIG_DUST_SIZE));

    self.selectSellOrder = function (order, notFromClick) {
        var price = new Decimal(cleanHtmlPrice(order.price));
        var amount = new Decimal(order.base_depth);
        var total1 = price.mul(amount);
        var total2 = new Decimal(self.availableBalanceForBuy());
        var total = total1.compare(total2) > 0 ? total2 : total1;

        if (self.quoteAssetIsDivisible() == self.baseAssetIsDivisible()) {
            amount = total.div(price);
        } else if (self.quoteAssetIsDivisible() && !self.baseAssetIsDivisible()) {
            amount = Math.floor(total.div(price));
            total = mulFloat(amount, price);
        } else if (!self.quoteAssetIsDivisible() && self.baseAssetIsDivisible()) {
            total = Math.floor(total);
            amount = divFloat(total, price);

        }

        self.buyPrice(roundAmount(price));
        self.buyTotal(roundAmount(total));
        self.buyAmount(roundAmount(amount));

        if (typeof(notFromClick) != 'boolean' || notFromClick == false) {
            self.selectBuyOrder(order, true);
        }
    };

    self.setMaxBuyAmount = function () {
        var total = self.availableBalanceForBuy();
        if (self.buyPrice()) {
            if (total == 0) {
                self.buyAmount(0);
            } else {
                if (self.baseAssetIsDivisible()) {
                    self.buyAmount(divFloat(total, self.buyPrice()));
                } else {
                    var amount = Math.floor(divFloat(total, self.buyPrice()));
                    self.buyAmount(amount);
                    total = mulFloat(amount, self.buyPrice());
                }
            }
        }
        self.buyTotal(total);
    };

    self.doBuy = function () {
        var give_quantity = denormalizeQuantity(self.buyTotal(), self.quoteAssetIsDivisible());
        var get_quantity = denormalizeQuantity(self.buyAmount(), self.baseAssetIsDivisible());
        var fee_required = 0;
        var fee_provided = MIN_FEE;
        var expiration = parseInt(WALLET_OPTIONS_MODAL.orderDefaultExpiration());

        var params = {
            source: self.selectedAddressForBuy(),
            give_quantity: give_quantity,
            give_asset: self.quoteAsset(),
            _give_divisible: self.quoteAssetIsDivisible(),
            get_quantity: get_quantity,
            get_asset: self.baseAsset(),
            _get_divisible: self.baseAssetIsDivisible(),
            fee_required: fee_required,
            fee_provided: fee_provided,
            expiration: expiration
        };

        var onSuccess = function (txHash, data, endpoint, addressType, armoryUTx) {
            trackEvent('Exchange', 'Buy', self.dispAssetPair());

            var message = "";
            if (armoryUTx) {
                message = i18n.t("you_buy_order_will_be_placed", self.buyAmount(), self.baseAsset());
            } else {
                message = i18n.t("you_buy_order_has_been_placed", self.buyAmount(), self.baseAsset());
            }

            WALLET.showTransactionCompleteDialog(message + " " + i18n.t(ACTION_PENDING_NOTICE), message, armoryUTx);
        };

        WALLET.doTransaction(self.selectedAddressForBuy(), "create_order", params, onSuccess);
    };

    self.buy = function () {
        if (!self.buyValidation.isValid()) {
            self.buyValidation.errors.showAllMessages();
            return false;
        }

        var sellOrders = self.askBook();
        var amountCumul = 0;
        var estimatedTotalPrice = 0;
        for (var i = 0; i < sellOrders.length; i++) {
            if (sellOrders[i]['price'] <= self.buyPrice() && amountCumul < self.buyAmount()) {
                var vol = Math.min(self.buyAmount() - amountCumul, sellOrders[i]['amount']);
                estimatedTotalPrice += mulFloat(vol, sellOrders[i]['price']);
                amountCumul += vol;
            }
        }
        if (amountCumul < self.buyAmount()) {
            estimatedTotalPrice += mulFloat(self.buyAmount() - amountCumul, self.buyPrice());
        }

        estimatedTotalPrice = smartFormat(estimatedTotalPrice);

        var message = '<table class="confirmOrderBox">';
        message += '<tr><td><b>' + i18n.t('price') + ': </b></td><td style="text-align:right">' + self.buyPrice() + '</td><td>' + self.quoteAsset() + '/' + self.baseAsset() + '</td></tr>';
        message += '<tr><td><b>' + i18n.t('amount') + ': </b></td><td style="text-align:right">' + self.buyAmount() + '</td><td>' + self.baseAsset() + '</td></tr>';
        message += '<tr><td><b>' + i18n.t('total') + ': </b></td><td style="text-align:right">' + self.buyTotal() + '</td><td>' + self.quoteAsset() + '</td></tr>';
        message += '<tr><td><b>' + i18n.t('real_estimated_total') + ': </b></td><td style="text-align:right">' + estimatedTotalPrice + '</td><td>' + self.quoteAsset() + '</td></tr>';
        message += '</table>';

        bootbox.dialog({
            title: i18n.t("confirm_your_order"),
            message: message,
            buttons: {
                "cancel": {
                    label: i18n.t("close"),
                    className: "btn-danger",
                    callback: function () {
                        bootbox.hideAll();
                        return false;
                    }
                },
                "confirm": {
                    label: i18n.t("confirm_order"),
                    className: "btn-primary",
                    callback: function () {
                        bootbox.hideAll();
                        self.doBuy();
                        return true;
                    }
                }

            }
        });

    };
    /* BUY FORM END */

    /* TOP USER PAIRS */
    self.topUserPairs = ko.observableArray([]);

    self.displayTopUserPairs = function (data) {
        for (var p in data) {
            var classes = ['top_user_pair'];
            if (data[p]['trend'] > 0) classes.push('txt-color-greenDark');
            else if (data[p]['trend'] < 0) classes.push('txt-color-red');
            if (parseFloat(data[p]['progression']) > 0) classes.push('progression-up');
            else if (parseFloat(data[p]['progression']) < 0) classes.push('progression-down');
            if (data[p]['my_order_count']) classes.push('with-open-order');
            classes.push("pair_" + data[p]['base_asset'] + data[p]['quote_asset']);
            data[p]['pair_classes'] = classes.join(" ");
        }
        self.topUserPairs(data);
    };

    self.fetchTopUserPairs = function () {
        return;
        var params = {
            'addresses': WALLET.getAddressesList(),
            'max_pairs': 12
        };
        failoverAPI('get_users_pairs', params, self.displayTopUserPairs);
    };

    /* USER OPEN ORDERS */
    self.userOpenOrders = ko.observableArray([]);

    self.displayOpenUserOrders = function (data) {
        for (var i in data) {

            data[i].amount = formatHtmlPrice(normalizeQuantity(data[i].amount, self.baseAssetIsDivisible()));
            data[i].total = formatHtmlPrice(normalizeQuantity(data[i].total, self.quoteAssetIsDivisible()));
            data[i].price = formatHtmlPrice(parseFloat(data[i].price));
            data[i].cancelled = WALLET.cancelOrders.indexOf(data[i].tx_hash) != -1;
        }
        self.userOpenOrders(data);
    };

    self.fetchOpenUserOrders = function () {
        self.userOpenOrders([]);
        var params = {
            'asset1': self.asset1(),
            'asset2': self.asset2(),
            'addresses': WALLET.getAddressesList()
        };
        failoverAPI('get_market_orders', params, self.displayOpenUserOrders);
    };

    /* USER OPEN ORDERS */
    self.userLastTrades = ko.observableArray([]);

    self.displayUserLastTrades = function (data) {
        for (var i in data) {
            data[i].amount = formatHtmlPrice(normalizeQuantity(data[i].amount, self.baseAssetIsDivisible()));
            data[i].total = formatHtmlPrice(normalizeQuantity(data[i].total, self.quoteAssetIsDivisible()));
            data[i].block_time = moment(data[i].block_time * 1000).format('YYYY/MM/DD hh:mm:ss A Z');
            data[i].price = formatHtmlPrice(parseFloat(data[i].price));
        }
        self.userLastTrades(data);
    };

    self.fetchUserLastTrades = function () {
        self.userOpenOrders([]);
        var params = {
            'asset1': self.asset1(),
            'asset2': self.asset2(),
            'addresses': WALLET.getAddressesList()
        };
        failoverAPI('get_market_trades', params, self.displayUserLastTrades);
    };

    /* ALL PAIRS LIST */
    self.allPairs = ko.observableArray([]);

    self.AssetPairLoading = ko.observable(false);


    self.allHomePairs = ko.observableArray([]);
    self.numSOGHomePairs = 0;
    self.SOGHomePairsData = [];


    self.getorderdata = function (data) {

        var rev = false;

        if (data.base_asset == "BITCRYSTALS") {
            //need to reverse
            rev = true;
            data.base_asset = data.quote_asset;
            data.quote_asset = "BITCRYSTALS";
            data.base_asset_divisible = data.quote_asset_divisible;
            data.quote_asset_divisible = true;


        }


        for (var j = 0; j < SOGAssetArray.length; j++) {
            if (data.base_asset == SOGAssetArray[j]) {
                var c = j + 1;
                var p = c % 10,
                    k = c % 100;
                if (p == 1 && k != 11) {
                    data.issued = c + "st";
                } else if (p == 2 && k != 12) {
                    data.issued = c + "nd";
                } else if (p == 3 && k != 13) {
                    data.issued = c + "rd";
                } else {
                    data.issued = c + "th";
                }
            }
        }
        data.issued = "This was the " + data.issued + " Card Issued";

        data.divisible = data.base_asset_divisible;
        if (typeof(data.divisible) === 'undefined') data.divisible = true;
        if (data.divisible) {
            data.divisible = "Yes!";

        } else {
            data.divisible = "No";
        }
        if (rev) {
            var last = data['last_trades'].shift();
            if (last == undefined) {
                data.lasttrade = "None";
            } else {
                data.lasttrade = smartFormat(1.0 / parseFloat(last.price)) + " " + data['quote_asset'] + " (" + last.type + ")";
            }
        } else {
            var last = data['last_trades'].shift();
            if (last == undefined) {
                data.lasttrade = "None";
            } else {
                data.lasttrade = smartFormat(parseFloat(last.price)) + " " + data['quote_asset'] + " (" + last.type + ")";
            }

        }


        data.volume = smartFormat(normalizeQuantity(data.volume, data.quote__asset_divisible)) + " " + data.quote_asset;


        if (rev)
            data.volume = "Not Available In BITCRYSTALS View";

        data.supply = smartFormat(normalizeQuantity(data.supply, data.base_asset_divisible));
        if (data.base_asset == "SATOSHICARD")
            data.supply = "199";
        if (data.base_asset == "GENESISCARD")
            data.supply = "557";
        if (data.base_asset == "RIPPLECARD")
            data.supply = "500";
        if (rev)
            data.supply = "Not Available In BITCRYSTALS View";

        if (parseFloat(data.progression) > 0) {
            data.prog_class = 'UP';
            data.progression = '+' + data.progression;
        } else if (parseFloat(data.progression) < 0) {
            data.prog_class = 'DOWN'
        } else {
            data.prog_class = '';
        }
        data.progression += '%';

        if (parseFloat(data.trend) > 0) {
            data.price_class = 'UP';
        } else if (parseFloat(data.trend) < 0) {
            data.price_class = 'DOWN';
        } else {
            data.price_class = '';
        }
        data.price = smartFormat(parseFloat(data.price));

        if (rev) {
            var sellorder = data['buy_orders'].shift();

            var buyorder = data['sell_orders'].shift();
            if (buyorder == undefined) {
                data.highbuy = "None";

            } else {
                var m = smartFormat(1.0 / parseFloat(buyorder.price));
                data.highbuy = m + " " + data['quote_asset'];
            }
            if (sellorder == undefined) {
                data.lowsell = "None";
            } else {
                var m = smartFormat(1.0 / parseFloat(sellorder.price));
                data.lowsell = m + " " + data['quote_asset'];
            }

        } else {
            if (data['quote_asset'] == 'BTC') {

                data.highbuy = "Not Currently Supported";
            } else {

                var buyorder = data['buy_orders'].shift();


                if (buyorder == undefined) {
                    data.highbuy = "None";

                } else {
                    data.highbuy = smartFormat(parseFloat(buyorder.price)) + " " + data['quote_asset'];
                }
            }
            var sellorder = data['sell_orders'].shift();
            if (sellorder == undefined) {
                data.lowsell = "None";
            } else {
                data.lowsell = smartFormat(parseFloat(sellorder.price)) + " " + data['quote_asset'];
            }
        }





        self.SOGHomePairsData = self.SOGHomePairsData.concat(data);

        self.numSOGHomePairs++;
        if (self.SOGHomePairsData.length  == SOGAssetArray.length) {
            console.log("done should load now");
            document.getElementById("AssetPairMarketInfo-loader").innerHTML = "";
            document.getElementById("AssetPairMarketInfo-loader-done").style.display = "block";

            self.allPairs([]);

            $('#AssetPairMarketInfo').dataTable().fnClearTable();
            self.allPairs(self.SOGHomePairsData);

            runDataTables('#AssetPairMarketInfo', true, {});
            spinner.stop();
        } else {

            var h = "<h3><b>Loading Market Data For Market Number " + self.SOGHomePairsData.length + " Out Of " + SOGAssetArray.length + "</b></h3>";
            document.getElementById("AssetPairMarketInfo-loader").innerHTML = h;

        }


    };


    self.displayAllPairs = function (data_) {


        var single = [];
        var newdata = [];
        var counter = -1;

        for (var i in data_) {
            var basesog = false;
            var quotesog = false;
            single = data_[i];
            for (var j = 0; j < SOGAssetArray.length; j++) {
                if (data_[i].base_asset == SOGAssetArray[j]) {
                    basesog = true;

                }
            }
            for (var k = 0; k < SOGAssetArray.length; k++) {
                if (data_[i].quote_asset == SOGAssetArray[k]) {

                    quotesog = true;
                }
            }
            if (basesog && quotesog) {
                //card for card, not on homepage
                continue;
            }
            if (basesog || quotesog) {
                counter++;
                newdata[counter] = single;

            }
        }
        data_ = newdata;


        for (var i in data_) {
            for (var j = 0; j < SOGAssetArray.length; j++) {
                if (data_[i].base_asset == SOGAssetArray[j]) {
                    var c = j + 1;
                    var p = c % 10,
                        k = c % 100;
                    if (p == 1 && k != 11) {
                        data_[i].issued = c + "st";
                    } else if (p == 2 && k != 12) {
                        data_[i].issued = c + "nd";
                    } else if (p == 3 && k != 13) {
                        data_[i].issued = c + "rd";
                    } else {
                        data_[i].issued = c + "th";
                    }
                }
            }
            data_[i].issued = "This was the " + data_[i].issued + " Card Issued";

            data_[i].volume = smartFormat(normalizeQuantity(data_[i].volume, data_[i].quote_divisibility));

            data_[i].supply = smartFormat(normalizeQuantity(data_[i].supply, data_[i].base_divisibility));
            if (data_[i].base_asset == "SATOSHICARD")
                data_[i].supply = "199";
            if (data_[i].base_asset == "GENESISCARD")
                data_[i].supply = "557";
            if (data_[i].base_asset == "RIPPLECARD")
                data_[i].supply = "500";
            data_[i].market_cap = smartFormat(normalizeQuantity(data_[i].market_cap, data_[i].quote_divisibility));
            if (parseFloat(data_[i].progression) > 0) {
                data_[i].prog_class = 'UP';
                data_[i].progression = '+' + data_[i].progression;
            } else if (parseFloat(data_[i].progression) < 0) {
                data_[i].prog_class = 'DOWN'
            } else {
                data_[i].prog_class = '';
            }
            data_[i].progression += '%';

            if (parseFloat(data_[i].trend) > 0) {
                data_[i].price_class = 'UP';
            } else if (parseFloat(data_[i].trend) < 0) {
                data_[i].price_class = 'DOWN';
            } else {
                data_[i].price_class = '';
            }
            data_[i].price = smartFormat(parseFloat(data_[i].price));
            var single = data_[i];

            data_[i].highbuy = "Loading...";
            data_[i].lowsell = "Loading...";
        }


        self.SOGPairsData = data_;

        if (data_.length) {
            //console.log(self.SOGHomePairsData.length);
            self.numSOGPairs = 0;

            for (var i in data_) {

                var params = {
                    'asset1': data_[i].base_asset,
                    'asset2': data_[i].quote_asset
                    //'datachunk': data_[i];
                };
                failoverAPI('get_market_details', params, self.getorderdata);
            }

            //runDataTables('#HomeAssetPairMarketInfo', true,{});
        }
    };

    self.fetchAllHomePairs = function () {
        self.showSingleCurrency(true);
        self.showingSwapbots(false);
        self.exchangSelection = "XCP";
        try {
            self.allPairs([]);
            $('#AssetPairMarketInfo').dataTable().fnClearTable();
        } catch (e) {
        }

        var opts = {
            lines: 13 // The number of lines to draw
            , length: 16 // The length of each line
            , width: 9 // The line thickness
            , radius: 17 // The radius of the inner circle
            , scale: 1 // Scales overall size of the spinner
            , corners: 1 // Corner roundness (0..1)
            , color: '#000' // #rgb or #rrggbb or array of colors
            , opacity: 0.45 // Opacity of the lines
            , rotate: 31 // The rotation offset
            , direction: 1 // 1: clockwise, -1: counterclockwise
            , speed: 1.3 // Rounds per second
            , trail: 60 // Afterglow percentage
            , fps: 20 // Frames per second when using setTimeout() as a fallback for CSS
            , zIndex: 2e9 // The z-index (defaults to 2000000000)
            , className: 'spinner' // The CSS class to assign to the spinner
            , top: '49%' // Top position relative to parent
            , left: '51%' // Left position relative to parent
            , shadow: false // Whether to render a shadow
            , hwaccel: false // Whether to use hardware acceleration
            , position: 'absolute' // Element positioning
        };
        var target = document.getElementById('AssetPairMarketInfo');
        spinner = new Spinner(opts).spin(target);
        self.SOGHomePairsData = [];
        self.numSOGHomePairs = 0;
        document.getElementById("AssetPairMarketInfo-loader-done").style.display = "none";
        var h = "<h3><b>Loading Market Data...</b></h3>";
        document.getElementById("AssetPairMarketInfo-loader").innerHTML = h;

        for (var i = 0; i < SOGAssetArray.length; i++) {

            var params = {
                'asset1': SOGAssetArray[i],
                'asset2': "XCP"

            };
            failoverAPI('get_market_details', params, self.getorderdata);
        }



    };

    self.fetchAllPairsByBase = function (base) {
        self.showSingleCurrency(true);
        self.showingSwapbots(false);
        self.exchangSelection = base;
        try {
            self.allPairs([]);
            $('#AssetPairMarketInfo').dataTable().fnClearTable();
        } catch (e) {
        }
        var opts = {
            lines: 13 // The number of lines to draw
            , length: 16 // The length of each line
            , width: 9 // The line thickness
            , radius: 17 // The radius of the inner circle
            , scale: 1 // Scales overall size of the spinner
            , corners: 1 // Corner roundness (0..1)
            , color: '#000' // #rgb or #rrggbb or array of colors
            , opacity: 0.45 // Opacity of the lines
            , rotate: 31 // The rotation offset
            , direction: 1 // 1: clockwise, -1: counterclockwise
            , speed: 1.3 // Rounds per second
            , trail: 60 // Afterglow percentage
            , fps: 20 // Frames per second when using setTimeout() as a fallback for CSS
            , zIndex: 2e9 // The z-index (defaults to 2000000000)
            , className: 'spinner' // The CSS class to assign to the spinner
            , top: '49%' // Top position relative to parent
            , left: '51%' // Left position relative to parent
            , shadow: false // Whether to render a shadow
            , hwaccel: false // Whether to use hardware acceleration
            , position: 'absolute' // Element positioning
        };
        var target = document.getElementById('AssetPairMarketInfo');
        spinner = new Spinner(opts).spin(target);

        self.SOGHomePairsData = [];
        self.numSOGHomePairs = 0;
        document.getElementById("AssetPairMarketInfo-loader-done").style.display = "none";

        var h = "<h3><b>Loading Market Data...</b></h3>";
        document.getElementById("AssetPairMarketInfo-loader").innerHTML = h;

        for (var i = 0; i < SOGAssetArray.length; i++) {

            var params = {
                'asset1': SOGAssetArray[i],
                'asset2': base
                //'datachunk': data_[i];
            };
            failoverAPI('get_market_details', params, self.getorderdata);
        }



    };

    self.fetchAllPairs = function () {



        self.fetchAllHomePairs();
        /*
         try {
         self.allPairs([]);
         $('#AssetPairMarketInfo').dataTable().fnClearTable();
         } catch (e) {
         }
         self.AssetPairLoading(false);
         self.SOGPairsData = [];
         document.getElementById("AssetPairMarketInfo-loader-done").style.display = "none";

         var target = document.getElementById('AssetPairMarketInfo');
         spinner = new Spinner(opts).spin(target);
         var h = "<h3><b>Loading Market Data...</b></h3>";
         document.getElementById("AssetPairMarketInfo-loader").innerHTML = h;

         failoverAPI('get_markets_list', {}, self.displayAllPairs);
         //failoverAPI('get_sog_cardforcard_markets_list', [], self.donothing);
         */
    };

    self.fetchAllPairsByXCP = function () {


        self.fetchAllPairsByBase("XCP");
        /*
         try {
         self.allPairs([]);
         $('#AssetPairMarketInfo').dataTable().fnClearTable();
         } catch (e) {
         }
         var target = document.getElementById('AssetPairMarketInfo');
         spinner = new Spinner(opts).spin(target);
         self.SOGPairsData = [];
         document.getElementById("AssetPairMarketInfo-loader-done").style.display = "none";
         var h = "<h3><b>Loading Market Data...</b></h3>";
         document.getElementById("AssetPairMarketInfo-loader").innerHTML = h;

         var params = {'quote_asset': 'XCP'};

         failoverAPI('get_markets_list', params, self.displayAllPairs);
         //failoverAPI('get_sog_cardforcard_markets_list', [], self.donothing);
         */
    };

    self.fetchAllPairsByBCY = function () {

        self.fetchAllPairsByBase("BITCRYSTALS");
        /*
         try {
         self.allPairs([]);
         $('#AssetPairMarketInfo').dataTable().fnClearTable();
         } catch (e) {
         }
         var target = document.getElementById('AssetPairMarketInfo');
         spinner = new Spinner(opts).spin(target);
         self.SOGPairsData = [];
         document.getElementById("AssetPairMarketInfo-loader-done").style.display = "none";
         var h = "<h3><b>Loading Market Data...</b></h3>";
         document.getElementById("AssetPairMarketInfo-loader").innerHTML = h;
         var params = {'quote_asset': 'BITCRYSTALS'};
         failoverAPI('get_markets_list', params, self.displayAllPairs);
         //failoverAPI('get_sog_cardforcard_markets_list', [], self.donothing);
         */
    };

    self.fetchAllPairsByBTC = function () {


        self.fetchAllPairsByBase("BTC");
    };


    self.getorderdata_all = function (data) {

        //self.SOGHomePairsData already has one dataset in it for the base asset

        for (var k in self.SOGHomePairsData) {
            if (self.SOGHomePairsData[k].base_asset == data.base_asset) {
                //on the right card
                if (data['quote_asset'] == "XCP") {

                    var last = data['last_trades'].shift();
                    if (last == undefined) {
                        self.SOGHomePairsData[k].lasttrade_xcp = "No XCP Trades";
                    } else {
                        self.SOGHomePairsData[k].lasttrade_xcp = smartFormat(parseFloat(last.price)) + " XCP (" + last.type + ")";

                    }


                    var buyorder = data['buy_orders'].shift();

                    var sellorder = data['sell_orders'].shift();
                    if (buyorder == undefined) {
                        self.SOGHomePairsData[k].highbuy_xcp = "No XCP Buy Offers";

                    } else {
                        self.SOGHomePairsData[k].highbuy_xcp = smartFormat(parseFloat(buyorder.price)) + " XCP";
                    }
                    if (sellorder == undefined) {
                        self.SOGHomePairsData[k].lowsell_xcp =  "No XCP Sell Offers";
                    } else {
                        self.SOGHomePairsData[k].lowsell_xcp = smartFormat(parseFloat(sellorder.price)) + " XCP";
                    }
                } else if (data['quote_asset'] == "BITCRYSTALS") {

                    var last = data['last_trades'].shift();
                    if (last == undefined) {
                        self.SOGHomePairsData[k].lasttrade_bcy = "No BITCRYSTALS Trades";
                    } else {
                        self.SOGHomePairsData[k].lasttrade_bcy = smartFormat(parseFloat(last.price)) + " BITCRYSTALS (" + last.type + ")";

                    }


                    var buyorder = data['buy_orders'].shift();

                    var sellorder = data['sell_orders'].shift();
                    if (buyorder == undefined) {
                        self.SOGHomePairsData[k].highbuy_bcy = "No BITCRYSTALS Buy Offers";

                    } else {
                        self.SOGHomePairsData[k].highbuy_bcy = smartFormat(parseFloat(buyorder.price)) + " BITCRYSTALS";
                    }
                    if (sellorder == undefined) {
                        self.SOGHomePairsData[k].lowsell_bcy =  "No BITCRYSTALS Sell Offers";
                    } else {
                        self.SOGHomePairsData[k].lowsell_bcy = smartFormat(parseFloat(sellorder.price)) + " BITCRYSTALS";
                    }
                } else if (data['quote_asset'] == "BTC") {

                    var last = data['last_trades'].shift();
                    if (last == undefined) {
                        self.SOGHomePairsData[k].lasttrade_btc = "No BTC Trades";
                    } else {
                        self.SOGHomePairsData[k].lasttrade_btc = smartFormat(parseFloat(last.price)) + " BTC (" + last.type + ")";

                    }


                    var buyorder = data['buy_orders'].shift();

                    var sellorder = data['sell_orders'].shift();
                    if (buyorder == undefined) {
                        self.SOGHomePairsData[k].highbuy_btc = "BTC Buy Orders Are Not Supported";

                    } else {
                        self.SOGHomePairsData[k].highbuy_btc = "BTC Buy Orders Are Not Supported";
                    }
                    if (sellorder == undefined) {
                        self.SOGHomePairsData[k].lowsell_btc = "No BTC Sell Offers";
                    } else {
                        self.SOGHomePairsData[k].lowsell_btc = smartFormat(parseFloat(sellorder.price))+ " BTC";
                    }
                } else console.log("Something went wrong");
            }
        }



        self.numSOGHomePairs++;
        if (self.numSOGHomePairs == (SOGAssetArray.length * 3)) {
            console.log("done should load now");
            document.getElementById("AssetPairMarketInfo-loaderAll").innerHTML = "";
            document.getElementById("AssetPairMarketInfo-loader-doneAll").style.display = "block";

            self.allPairs([]);
            $('#AssetPairMarketInfoAll').dataTable().fnClearTable();

            self.allPairs(self.SOGHomePairsData);
            runDataTables('#AssetPairMarketInfoAll', true, {});

            spinner.stop();
        } else {

            var h = "<h3><b>Loading Market Data For Market Number " + self.numSOGHomePairs + " Out Of " + (SOGAssetArray.length*3) + "</b></h3>";
            document.getElementById("AssetPairMarketInfo-loaderAll").innerHTML = h;

        }


    };


    self.fetchAllPairsCombined = function () {
        self.showSingleCurrency(false);
        self.showingSwapbots(false);
        self.exchangSelection = "All";



        try {
            self.allPairs([]);
            $('#AssetPairMarketInfoAll').dataTable().fnClearTable();
        } catch (e) {
        }

        var opts = {
            lines: 13 // The number of lines to draw
            , length: 16 // The length of each line
            , width: 9 // The line thickness
            , radius: 17 // The radius of the inner circle
            , scale: 1 // Scales overall size of the spinner
            , corners: 1 // Corner roundness (0..1)
            , color: '#000' // #rgb or #rrggbb or array of colors
            , opacity: 0.45 // Opacity of the lines
            , rotate: 31 // The rotation offset
            , direction: 1 // 1: clockwise, -1: counterclockwise
            , speed: 1.3 // Rounds per second
            , trail: 60 // Afterglow percentage
            , fps: 20 // Frames per second when using setTimeout() as a fallback for CSS
            , zIndex: 2e9 // The z-index (defaults to 2000000000)
            , className: 'spinner' // The CSS class to assign to the spinner
            , top: '49%' // Top position relative to parent
            , left: '51%' // Left position relative to parent
            , shadow: false // Whether to render a shadow
            , hwaccel: false // Whether to use hardware acceleration
            , position: 'absolute' // Element positioning
        };
        var target = document.getElementById('AssetPairMarketInfoAll');
        spinner = new Spinner(opts).spin(target);
        //we keep the old data from one of the prior sets to set the structure, this
        //will always be set since all never gets called first.
        //self.SOGHomePairsData = [];
        self.numSOGHomePairs = 0;

        document.getElementById("AssetPairMarketInfo-loader-doneAll").style.display = "none";
        var h = "<h3><b>Loading Market Data...</b></h3>";
        document.getElementById("AssetPairMarketInfo-loaderAll").innerHTML = h;

        for (var i = 0; i < SOGAssetArray.length; i++) {

            var params = {
                'asset1': SOGAssetArray[i],
                'asset2': "XCP"

            };
            failoverAPI('get_market_details', params, self.getorderdata_all);
        }
        for (var i = 0; i < SOGAssetArray.length; i++) {

            var params = {
                'asset1': SOGAssetArray[i],
                'asset2': "BITCRYSTALS"

            };
            failoverAPI('get_market_details', params, self.getorderdata_all);
        }
        for (var i = 0; i < SOGAssetArray.length; i++) {

            var params = {
                'asset1': SOGAssetArray[i],
                'asset2': "BTC"

            };
            failoverAPI('get_market_details', params, self.getorderdata_all);
        }
    };

    self.allSwaps = ko.observableArray([]);
    self.SOGSwapsData = ko.observableArray([]);



    self.fetchAllSwaps = function () {
        self.showSingleCurrency(false);
        self.showingSwapbots(true);

        try {
            self.allSwaps([]);
            $('#AssetPairMarketSwaps').dataTable().fnClearTable();
        } catch (e) {
        }

        var opts = {
            lines: 13 // The number of lines to draw
            , length: 16 // The length of each line
            , width: 9 // The line thickness
            , radius: 17 // The radius of the inner circle
            , scale: 1 // Scales overall size of the spinner
            , corners: 1 // Corner roundness (0..1)
            , color: '#000' // #rgb or #rrggbb or array of colors
            , opacity: 0.45 // Opacity of the lines
            , rotate: 31 // The rotation offset
            , direction: 1 // 1: clockwise, -1: counterclockwise
            , speed: 1.3 // Rounds per second
            , trail: 60 // Afterglow percentage
            , fps: 20 // Frames per second when using setTimeout() as a fallback for CSS
            , zIndex: 2e9 // The z-index (defaults to 2000000000)
            , className: 'spinner' // The CSS class to assign to the spinner
            , top: '49%' // Top position relative to parent
            , left: '51%' // Left position relative to parent
            , shadow: false // Whether to render a shadow
            , hwaccel: false // Whether to use hardware acceleration
            , position: 'absolute' // Element positioning
        };
        var target = document.getElementById('AssetPairMarketSwaps');
        spinner = new Spinner(opts).spin(target);

        document.getElementById("AssetPairMarketSwaps-loader-done").style.display = "none";
        var h = "<h3><b>Loading Market Data...</b></h3>";
        document.getElementById("AssetPairMarketSwaps-loader").innerHTML = h;

        //get all the bots
        var push = false;
        $.ajax("https://sogparty.com/swapbots/bots", {
            success: self.doSwaps
        });



    };

    self.doSwaps = function(data) {
        var bigHolder = [];
        for (var i in data) {
            for (var s in data[i]['swaps']) {
                for (var k=0; k < SOGAssetArray.length; k++) {
                    var card = SOGAssetArray[k];
                    //active, out is sog, in is btc/bcy/xcp, and balance of card is not 0
                    if ((data[i].state == "active") &&
                        (data[i]['swaps'][s].out == SOGAssetArray[k]) &&
                        (data[i]['swaps'][s].in == "BTC" || data[i]['swaps'][s].in == "XCP" || data[i]['swaps'][s].in == "BITCRYSTALS") &&
                        (data[i]['balances'][card] > 0)) {
                        var holder = {};
                        holder.balance = data[i]['balances'][card];

                        holder.card = card;
                        //do issued
                        var data_ = '';
                        var c = k + 1;
                        var p = c % 10,
                            j = c % 100;
                        if (p == 1 && j != 11) {
                            data_ = c + "st";
                        } else if (p == 2 && j != 12) {
                            data_ = c + "nd";
                        } else if (p == 3 && j != 13) {
                            data_= c + "rd";
                        } else {
                            data_ = c + "th";
                        }

                        holder.issued = "This was the " + data_ + " Card Issued";
                        console.log(holder.issued);


                        //setup output
                        if (data[i]['swaps'][s].strategy == "fixed") {
                            holder.in_qty = data[i]['swaps'][s].in_qty;
                            holder.in = data[i]['swaps'][s].in;
                            holder.out = data[i]['swaps'][s].out;
                            holder.out_qty = data[i]['swaps'][s].out_qty;

                            holder.priceline = holder.in_qty + " " + holder.in + " / Available: " + holder.balance;
                        } else {

                            holder.in = data[i]['swaps'][s].in;
                            holder.out = data[i]['swaps'][s].out;
                            holder.price = data[i]['swaps'][s].price;
                            holder.rate = data[i]['swaps'][s].rate;
                            holder.min = data[i]['swaps'][s].min;

                            holder.priceline = holder.price + " " + holder.in + " Per 1 Card (Accepts Fractional Orders - min. " + holder.min + " " + holder.in + ") / Available: "+ holder.balance;


                        }
                        holder.visit = data[i].botUrl;
                        holder.address = data[i].address;
                        holder.id = data[i].id;
                        holder.balance = data[i]['balances'][card];
                        holder.name = data[i].name;

                        if (holder.name.indexOf("Partner") > -1) {
                            holder.restriction = "SOG Partner Only";

                        } else if (holder.name.indexOf("Premium") > -1) {
                            holder.restriction = "SOG Premium Only";

                        } else holder.restriction = "None";

                        bigHolder = bigHolder.concat(holder);
                    }
                }
            }
        }











        console.log("done should load now");
        document.getElementById("AssetPairMarketSwaps-loader").innerHTML = "";
        document.getElementById("AssetPairMarketSwaps-loader-done").style.display = "block";

        self.allSwaps([]);
        $('#AssetPairMarketSwaps').dataTable().fnClearTable();

        self.allSwaps(bigHolder);
        runDataTables('#AssetPairMarketSwaps', true, {});

        spinner.stop();


    }




    /* OLD
     self.allPairs = ko.observableArray([]);

     self.displayAllPairs = function(data) {

     for (var i in data) {
     data[i].volume = smartFormat(normalizeQuantity(data[i].volume, data[i].quote_divisibility));
     data[i].supply = smartFormat(normalizeQuantity(data[i].supply, data[i].base_divisibility));
     data[i].market_cap = smartFormat(normalizeQuantity(data[i].market_cap, data[i].quote_divisibility));
     if (parseFloat(data[i].progression) > 0) {
     data[i].prog_class = 'UP';
     data[i].progression = '+' + data[i].progression;
     } else if (parseFloat(data[i].progression) < 0) {
     data[i].prog_class = 'DOWN'
     } else {
     data[i].prog_class = '';
     }
     data[i].progression += '%';

     if (parseFloat(data[i].trend) > 0) {
     data[i].price_class = 'UP';
     } else if (parseFloat(data[i].trend) < 0) {
     data[i].price_class = 'DOWN';
     } else {
     data[i].price_class = '';
     }
     data[i].price = smartFormat(parseFloat(data[i].price));
     }
     self.allPairs(data);
     if (self.allPairs().length) {
     runDataTables('#assetPairMarketInfo', true, {"aaSorting": [[0, 'asc']]});
     }
     }

     self.fetchAllPairs = function() {
     try {
     self.allPairs([]);
     $('#assetPairMarketInfo').dataTable().fnClearTable();
     } catch (e) {}
     failoverAPI('get_markets_list', [], self.displayAllPairs);
     }
     */
    /* MARKET DETAILS */
    self.showgraph = ko.observable(false);

    self.displayMarketDetails = function (data) {

        if (data['base_asset_infos'] && data['base_asset_infos']['valid_image']) {
            self.baseAssetImage(assetImageUrl(data['base_asset']));
        }

        if (self.asset1() == data['base_asset']) {
            self.asset1IsDivisible(data['base_asset_divisible']);
            self.asset2IsDivisible(data['quote_asset_divisible']);
        } else {
            self.asset1IsDivisible(data['quote_asset_divisible']);
            self.asset2IsDivisible(data['base_asset_divisible']);
        }

        self.currentMarketPrice(roundAmount(data['price']));
        self.marketProgression24h(data['progression']);

        self.bidBook([]);
        self.askBook([]);
        try {
            $('#asset1OpenBuyOrders').dataTable().fnClearTable();
        } catch (err) {
        }
        try {
            $('#asset2OpenBuyOrders').dataTable().fnClearTable();
        } catch (err) {
        }

        var base_depth = 0;
        var buy_orders = [];

        for (var i in data['buy_orders']) {
            if (data['sell_orders'].length > 0 && data['buy_orders'][i]['price'] >= data['sell_orders'][0]['price']) {
                data['buy_orders'][i]['exclude'] = true;
            } else {
                if (base_depth == 0) {
                    self.highestBidPrice(data['buy_orders'][i]['price']);
                    self.sellPrice(data['buy_orders'][i]['price']);
                    var a = new Decimal(self.availableBalanceForSell());
                    var h = new Decimal(self.highestBidPrice());
                    var o = roundAmount(a.mul(h));
                    self.obtainableForSell(o);
                }
                var amount = normalizeQuantity(data['buy_orders'][i]['amount'], data['base_asset_divisible']);
                var noHtmlAmount = roundAmount(amount);
                var noHtmlTotal = roundAmount(normalizeQuantity(data['buy_orders'][i]['total'], data['quote_asset_divisible']));
                data['buy_orders'][i]['exclude'] = false;

                data['buy_orders'][i]['amount'] = formatHtmlPrice(noHtmlAmount);
                data['buy_orders'][i]['total'] = formatHtmlPrice(noHtmlTotal);
                var a = new Decimal(noHtmlAmount);
                var t = new Decimal(noHtmlTotal);
                var p = roundAmount(t.div(a));
                data['buy_orders'][i]['price'] = formatHtmlPrice(p);
                data['buy_orders'][i]['base_depth'] = amount + base_depth;
                base_depth = data['buy_orders'][i]['base_depth'];
            }
        }
        base_depth = 0;
        for (var i in data['sell_orders']) {
            if (base_depth == 0) {
                self.lowestAskPrice(data['sell_orders'][i]['price']);
                self.buyPrice(data['sell_orders'][i]['price']);
                var a = new Decimal(self.availableBalanceForBuy());
                var l = new Decimal(self.lowestAskPrice());
                var o = roundAmount(a.div(l));
                self.obtainableForBuy(o);
            }
            var amount = normalizeQuantity(data['sell_orders'][i]['amount'], data['base_asset_divisible']);
            var noHtmlAmount = roundAmount(amount);
            var noHtmlTotal = roundAmount(normalizeQuantity(data['sell_orders'][i]['total'], data['quote_asset_divisible']));
            data['sell_orders'][i]['exclude'] = false;
            data['sell_orders'][i]['amount'] = formatHtmlPrice(noHtmlAmount);
            data['sell_orders'][i]['total'] = formatHtmlPrice(noHtmlTotal);
            var a = new Decimal(noHtmlAmount);
            var t = new Decimal(noHtmlTotal);
            var p = roundAmount(t.div(a));
            data['sell_orders'][i]['price'] = formatHtmlPrice(p);
            data['sell_orders'][i]['base_depth'] = amount + base_depth;
            base_depth = data['sell_orders'][i]['base_depth'];
        }

        self.bidBook(data['buy_orders']);
        self.askBook(data['sell_orders']);

        self.tradeHistory([]);
        try {
            $('#tradeHistory').dataTable().fnClearTable();
        } catch (err) {
        }

        for (var i in data['last_trades']) {
            data['last_trades'][i]['price'] = formatHtmlPrice(roundAmount(data['last_trades'][i]['price']));
            data['last_trades'][i].amount = formatHtmlPrice(roundAmount(normalizeQuantity(data['last_trades'][i].amount, self.baseAssetIsDivisible())));
            data['last_trades'][i].total = formatHtmlPrice(roundAmount(normalizeQuantity(data['last_trades'][i].total, self.quoteAssetIsDivisible())));
            data['last_trades'][i].block_time = moment(data['last_trades'][i].block_time * 1000).format('YYYY/MM/DD hh:mm:ss A Z');
        }
        self.tradeHistory(data['last_trades']);
        if (self.tradeHistory().length) {
            runDataTables('#tradeHistory', true, {"aaSorting": [[1, 'desc']]});
            self.showgraph(true);
        }else {
            self.showgraph(false);
        }

        self.fetchOpenUserOrders();
        self.fetchUserLastTrades();

    };

    self.selectMarket = function (item) {
        self.asset1(item.base_asset);
        if (item.quote_asset == 'XCP') {
            self.selectedQuoteAsset(item.quote_asset);
        } else {
            self.selectedQuoteAsset('Other');
            self.asset2(item.quote_asset);
        }
        trackEvent('Exchange', 'MarketSelected', self.dispAssetPair());
    };


    self.showMarketPage = function (a1) {
        self.asset1(a1);
        self.asset2('XCP');
        self.selectedQuoteAsset('XCP');

        trackEvent('Exchange', 'MarketSelected', self.dispAssetPair());
    };

    self.showCurBTC = function(){
        self.showMarketPage('BTC');

    }
    self.showCurBCY = function(){

        self.showMarketPage('BITCRYSTALS');
    }
    self.showCurMAGICFLDC = function(){

        self.showMarketPage('MAGICFLDC');
    }


    self.fetchMarketDetails = function (item) {
        self.highestBidPrice(0);
        self.lowestAskPrice(0);
        self.sellPrice(0);
        self.buyPrice(0);
        self.obtainableForSell(0);
        self.obtainableForBuy(0);
        self.metricsRefreshPriceChart();
        var params = {
            'asset1': self.asset2(),
            'asset2': self.asset1()
        };
        failoverAPI('get_market_details', params, self.displayMarketDetails);
    };

    self.init = function () {
        //self.fetchTopUserPairs();
        self.fetchAllPairs();

        //Get a list of all assets
        //failoverAPI("get_asset_names", {}, function(data, endpoint) {
        var data = [];
        data = ['XCP'].concat(data);
        data = ['BTC'].concat(data);
        data = ['BITCRYSTALS'].concat(data);
        data = ['MAGICFLDC'].concat(data);
        data = SOGAssetArray.concat(data);
        self.allAssets(data);

        //data = ['XCP'].concat(data);
        //self.allAssets(data);

        //Set up typeahead bindings manually for now (can't get knockout and typeahead playing well together...)
        var assets = new Bloodhound({
            datumTokenizer: Bloodhound.tokenizers.whitespace,
            queryTokenizer: Bloodhound.tokenizers.whitespace,
            local: self.allAssets()
        });
        assets.initialize();
        $('#asset1, #asset2').typeahead(null, {
            source: assets.ttAdapter(),
            displayKey: function (obj) {
                return obj;
            }
        }).on('typeahead:selected', function ($e, datum) {
            if ($($e.target).attr('name') == 'asset1')
                self.asset1(datum); //gotta do a manual update...doesn't play well with knockout
            else if ($($e.target).attr('name') == 'asset2')
                self.asset2(datum); //gotta do a manual update...doesn't play well with knockout
        });

    };
    self.exchangSelection = "XCP";
    self.refresh = function () {

        if (self.showingSwapbots()) return;
        setTimeout(function () {


            if (self.dexHome()) {
                if (self.exchangSelection == "All")
                    self.fetchAllPairsCombined();
                else
                    self.fetchAllPairsByBase(self.exchangSelection);

            } else {
                self.fetchMarketDetails();
            }
        }, Math.floor(Math.random() * 15000));

    };

    self.backtodexhome = function(){
        self.dexHome(true);


    }

    self.metricsRefreshPriceChart = function () {
        var deferred = $.Deferred();
        //now that an asset pair is picked, we can show a price chart for that pair
        failoverAPI("get_market_price_history", {
            'asset1': self.asset1(),
            'asset2': self.asset2()
        }, function (data, endpoint) {
            deferred.resolve();
            if (data.length) {
                ExchangeViewModel.doChart(self.dispAssetPair(), $('#priceHistory'), data);
            }
        }, function (jqXHR, textStatus, errorThrown, endpoint) {
            deferred.resolve();
            return defaultErrorHandler(jqXHR, textStatus, errorThrown, endpoint);
        });
    };

    self.cancelOrder = function (order) {

        if (WALLET.cancelOrders.indexOf(order.tx_hash) != -1) {

            bootbox.alert(i18n.t('order_already_cancelled'));

        } else {

            var message = i18n.t('cancel_consume_btc');

            bootbox.dialog({
                title: i18n.t("confirm_cancellation_order"),
                message: message,
                buttons: {
                    "cancel": {
                        label: i18n.t("close"),
                        className: "btn-danger",
                        callback: function () {
                            bootbox.hideAll();
                            return false;
                        }
                    },
                    "confirm": {
                        label: i18n.t("confirm_cancellation"),
                        className: "btn-primary",
                        callback: function () {
                            bootbox.hideAll();
                            self.cancelOpenOrder(order);
                            return true;
                        }
                    }

                }
            });

        }

    };

    self.cancelOpenOrder = function (order) {
        var params = {
            offer_hash: order.tx_hash,
            source: order.source,
            _type: 'order',
            _tx_index: order.tx_index
        };

        var onSuccess = function (txHash, data, endpoint, addressType, armoryUTx) {
            trackEvent('Exchange', 'OrderCanceled');
            WALLET.showTransactionCompleteDialog("<b>" + i18n.t("order_was_cancelled") + "</b> " + i18n.t(ACTION_PENDING_NOTICE),
                "<b>" + i18n.t("order_will_be_cancelled") + "</b>", armoryUTx);
        };

        WALLET.doTransaction(order.source, "create_cancel", params, onSuccess);
    }
}
ExchangeViewModel.doChart = function (dispAssetPair, chartDiv, data) {
    // split the data set into ohlc and volume
    var ohlc = [];
    var midline = [];
    var volume = [];

    for (var i = 0; i < data.length; i++) {
        ohlc.push([
            data[i][0], // the date
            data[i][1], // open
            data[i][2], // high
            data[i][3], // low
            data[i][4]  // close
        ]);
        midline.push([
            data[i][0], // the date
            data[i][7]  // the midline for that sample
        ]);
        volume.push([
            data[i][0], // the date
            data[i][5]  // the volume
        ])
    }

    // set the allowed units for data grouping
    var groupingUnits = [[
        'week',                         // unit name
        [1]                             // allowed multiples
    ], [
        'month',
        [1, 2, 3, 4, 6]
    ]];

    //graph.highcharts('StockChart', {
    chartDiv.highcharts('StockChart', {


        xAxis: {
            type: 'datetime'
        },
        legend: {
            enabled: false
        },
        plotOptions: {
            candlestick: {
                color: '#f01717',
                upColor: '#0ab92b'
            },
            volume: {
                color: '#0000FF'
            }
        },
        scrollbar: {
            enabled: false
        },
        navigator: {
            enabled: true
        },
        rangeSelector: {
            /*enabled: false,
             inputEnabled: false,*/
            selected: 0
        },
        tooltip: {
            crosshairs: true,
            shared: true,
            valueDecimals: 8
        },
        credits: {
            enabled: false
        },

        yAxis: [{
            labels: {
                style: {
                    color: '#CC3300'
                }
            },
            title: {
                text: 'Price',
                style: {color: '#CC3300'}
            }
        }, {
            title: {
                text: 'Amount',
                style: {color: '#4572A7'}
            },
            labels: {
                style: {
                    color: '#4572A7'
                }
            },
            opposite: true
        }],

        series: [
            {
                type: 'column',
                name: 'Volume',
                data: volume,
                yAxis: 1,
                dataGrouping: {
                    units: groupingUnits
                }
            },
            {
                type: 'candlestick',
                name: dispAssetPair,
                data: ohlc,
                yAxis: 0,
                dataGrouping: {
                    units: groupingUnits
                }
            },
            {
                name: 'Trace Line',
                id: 'primary',
                type: 'line',
                data: midline,
                yAxis: 0,
                visible: false,
                showInLegend: false
            },
            {
                name: '7-Sample SMA',
                linkedTo: 'primary',
                showInLegend: true,
                yAxis: 0,
                type: 'trendline',
                algorithm: 'SMA',
                periods: 7
            }]
    });
};


function OpenOrdersViewModel() {
    var self = this;

    self.openOrders = ko.observableArray([]);
    self.addressesLabels = {};

    self.init = function () {
        self.addressesLabels = {};
        var wallet_adressess = WALLET.getAddressesList(true);
        var addresses = [];
        for (var i = 0; i < wallet_adressess.length; i++) {
            addresses.push(wallet_adressess[i][0]);
            self.addressesLabels[wallet_adressess[i][0]] = wallet_adressess[i][1];
        }

        var params = {
            filters: [
                {'field': 'source', 'op': 'IN', 'value': addresses},
                {'field': 'give_remaining', 'op': '>', 'value': 0}
            ],
            status: 'open'
        };
        failoverAPI("get_orders", params, self.displayOpenOrders);
    };

    self.displayOpenOrders = function (data) {
        self.openOrders([]);
        var assets = {};
        var orders = [];
        for (var i = 0; i < data.length; i++) {
            var order = {};
            order.tx_index = data[i].tx_index;
            order.tx_hash = data[i].tx_hash;
            order.source = data[i].source;
            order.address_label = self.addressesLabels[order.source];
            order.give_asset = data[i].give_asset;
            order.get_asset = data[i].get_asset;
            order.give_quantity = data[i].give_quantity;
            order.get_quantity = data[i].get_quantity;
            order.give_remaining = Math.max(data[i].give_remaining, 0);
            order.get_remaining = Math.max(data[i].get_remaining, 0);
            order.expire_index = data[i].expire_index;
            order.expire_date = expireDate(data[i].expire_index);
            order.cancelled = WALLET.cancelOrders.indexOf(order.tx_hash) != -1;
            orders.push(order);
            assets[data[i].give_asset] = true;
            assets[data[i].get_asset] = true;
        }
        assets = _.keys(assets);

        WALLET.getAssetsDivisibility(assets, function (assetsDivisibility) {
            for (var i = 0; i < orders.length; i++) {
                orders[i].give_quantity_str = smartFormat(normalizeQuantity(orders[i].give_quantity, assetsDivisibility[orders[i].give_asset])) + ' ' + orders[i].give_asset;
                orders[i].get_quantity_str = smartFormat(normalizeQuantity(orders[i].get_quantity, assetsDivisibility[orders[i].get_asset])) + ' ' + orders[i].get_asset;
                orders[i].give_remaining_str = smartFormat(normalizeQuantity(orders[i].give_remaining, assetsDivisibility[orders[i].give_asset])) + ' ' + orders[i].give_asset;
                orders[i].get_remaining_str = smartFormat(normalizeQuantity(orders[i].get_remaining, assetsDivisibility[orders[i].get_asset])) + ' ' + orders[i].get_asset;
            }
            self.openOrders(orders);
            var openOrdersTable = $('#openOrdersTable').dataTable();
        });
    };

    self.cancelOpenOrder = function (order) {

        if (WALLET.cancelOrders.indexOf(order.tx_hash) != -1) {

            bootbox.alert(i18n.t('order_already_cancelled'));

        } else {

            var message = i18n.t('cancel_consume_btc');

            bootbox.dialog({
                title: i18n.t("confirm_cancellation_order"),
                message: message,
                buttons: {
                    "cancel": {
                        label: i18n.t("close"),
                        className: "btn-danger",
                        callback: function () {
                            bootbox.hideAll();
                            return false;
                        }
                    },
                    "confirm": {
                        label: i18n.t("confirm_cancellation"),
                        className: "btn-primary",
                        callback: function () {
                            bootbox.hideAll();
                            self.cancelOrder(order);
                            return true;
                        }
                    }
                }
            });

        }
    };

    self.cancelOrder = function (order) {
        var params = {
            offer_hash: order.tx_hash,
            source: order.source,
            _type: 'order',
            _tx_index: order.tx_index
        };

        var onSuccess = function (txHash, data, endpoint, addressType, armoryUTx) {
            trackEvent('OpenOrders', 'OrderCancelled');
            WALLET.showTransactionCompleteDialog("<b>" + i18n.t("order_was_cancelled") + "</b> " + i18n.t(ACTION_PENDING_NOTICE),
                "<b>" + i18n.t("order_will_be_cancelled") + "</b>", armoryUTx);
        };

        WALLET.doTransaction(order.source, "create_cancel", params, onSuccess);
    }
}

function OrderMatchesViewModel() {
    self = this;

    self.orderMatches = ko.observableArray([]);
    self.addressesLabels = {};

    self.init = function () {
        self.addressesLabels = {};
        var wallet_adressess = WALLET.getAddressesList(true);
        var addresses = [];
        for (var i = 0; i < wallet_adressess.length; i++) {
            addresses.push(wallet_adressess[i][0]);
            self.addressesLabels[wallet_adressess[i][0]] = wallet_adressess[i][1];
        }

        var params = {
            filters: [
                {'field': 'tx0_address', 'op': 'IN', 'value': addresses},
                {'field': 'tx1_address', 'op': 'IN', 'value': addresses}
            ],
            filterop: 'OR',
            status: ['pending', 'completed', 'expired'],
            order_by: 'block_index',
            order_dir: 'DESC'
        };
        failoverAPI("get_order_matches", params, self.displayOrderMatches);
    };

    self.displayOrderMatches = function (data) {
        self.orderMatches([]);
        var order_matches = [];
        var assets = {};

        for (var i = 0; i < data.length; i++) {
            var order_match = {};

            if (self.addressesLabels[data[i].tx0_address]) {
                order_match.address_label = self.addressesLabels[data[i].tx0_address];
                order_match.give_quantity = data[i].forward_quantity;
                order_match.get_quantity = data[i].backward_quantity;
                order_match.give_asset = data[i].forward_asset;
                order_match.get_asset = data[i].backward_asset;
            } else {
                order_match.address_label = self.addressesLabels[data[i].tx1_address];
                order_match.give_quantity = data[i].backward_quantity;
                order_match.get_quantity = data[i].forward_quantity;
                order_match.give_asset = data[i].backward_asset;
                order_match.get_asset = data[i].forward_asset;
            }
            order_match.status = data[i].status;
            order_match.block_index = data[i].block_index;

            assets[order_match.give_asset] = true;
            assets[order_match.get_asset] = true;

            var classes = {
                'completed': 'success',
                'pending': 'primary',
                'expired': 'danger'
            };
            var label_for_status = {
                'completed': i18n.t('completed'),
                'pending': i18n.t('pending'),
                'expired': i18n.t('expired')
            };
            order_match.status_html = '<span class="label label-' + classes[order_match.status] + '">' + label_for_status[order_match.status] + '</span>';

            order_matches.push(order_match);
        }

        assets = _.keys(assets);

        WALLET.getAssetsDivisibility(assets, function (assetsDivisibility) {
            for (var i = 0; i < order_matches.length; i++) {
                order_matches[i].give_quantity_str = smartFormat(normalizeQuantity(order_matches[i].give_quantity, assetsDivisibility[order_matches[i].give_asset])) + ' ' + order_matches[i].give_asset;
                order_matches[i].get_quantity_str = smartFormat(normalizeQuantity(order_matches[i].get_quantity, assetsDivisibility[order_matches[i].get_asset])) + ' ' + order_matches[i].get_asset;
            }
            $('#orderMatchesTable').dataTable().fnClearTable();
            self.orderMatches(order_matches);
            runDataTables('#orderMatchesTable', true, {
                "aaSorting": [[1, 'desc']]
            });
        });

    }

}


/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
 first load and subsequent ajax page switches in the .html <script> tag*/
