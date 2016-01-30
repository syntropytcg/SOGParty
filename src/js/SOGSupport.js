/**
 * Created by X-ETHeREAL-X on 1/24/16.
 */

/* Trending List */
var allHomePairs = ko.observableArray([]);

function displayHomeAllPairs(dataRAW) {
    var data = ko.observableArray([]);
    for (var i in dataRAW) {
        for (var j = 0; j < numSOGAssets; j++) {
            if (dataRAW[i].base_asset == SOGAssetArray[j])
                data.push(dataRAW[i]);
        }
    }

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
    data = data.sort(function (left, right) { return left.quote_asset == right.quote_asset ? 0 : (left.quote_asset < right.quote_asset ? -1 : 1) });
    allHomePairs(data);
    if(self.allHomePairs().length) {
        runDataTables('#HomeAssetPairMarketInfo', true, { "aaSorting": [ [0, 'asc'] ] });

    }
}

function fetchAllHomePairs(){
    try {
        allHomePairs([]);
        $('#HomeAssetPairMarketInfo').dataTable().fnClearTable();
    } catch(e) {}
    failoverAPI('get_markets_list', [], displayHomeAllPairs);
}
var homeCalled = false;

//fetchAllHomePairs();