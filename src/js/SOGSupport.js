/**
 * Created by X-ETHeREAL-X on 1/24/16.
 */

/* Trending List */
/*

self.allHomePairs = ko.observableArray([]);

self.displayHomeAllPairs = function(data_) {



    for (var i in data_) {

        var found = false;
        for (var j = 0; j < SOGAssetArray.length; j++) {
            if (data_[i].base_asset == SOGAssetArray[j]){
                found = true;
            }
        }
        if (found == false){
            data_.splice(i, 1);
            continue;
        }


        data_[i].volume = smartFormat(normalizeQuantity(data_[i].volume, data_[i].quote_divisibility));

        data_[i].supply = smartFormat(normalizeQuantity(data_[i].supply, data_[i].base_divisibility));
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
    }

    self.allHomePairs(data_);
    //allHomePairs = allHomePairs.sort(function (left, right) { return left.quote_asset == right.quote_asset ? 0 : (left.quote_asset < right.quote_asset ? -1 : 1) });
    if(self.allHomePairs().length) {

        runDataTables('#HomeAssetPairMarketInfo', true, { "aaSorting": [ [0, 'asc'] ] });

    }
}

self.fetchAllHomePairs = function(){
    try {
        allHomePairs([]);
        $('#HomeAssetPairMarketInfo').dataTable().fnClearTable();
    } catch(e) {}
    failoverAPI('get_markets_list', [], displayHomeAllPairs);
}


function setUpHome(){

    //pageSetUp(); //init smartadmin featureset

    //This code is run on each visit to the page
    window.EXCHANGE_Home = new ExchangeViewModel();
    EXCHANGE_Home.init(true);


}

var homeCalled = false;
*/
//fetchAllHomePairs();