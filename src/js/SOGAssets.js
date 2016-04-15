
var SOGAssetArray = [
    "FDCARD",
    "SJCXCARD",
    "GEMZCARD",
    "XCPCARD",
    "SWARMCD",
    "ETHEREUMCARD",
    "SATOSHICARD",
    "CLEFCARD",
    "GENESISCARD",
    "SHUMAICARD",
    "CNPCARD",
    "SHAPESHIFTCD",
    "RIPPLECARD",
    "BLOCKSIZECD",
    "ETHXCPCARD",
    "BEARWHALECD",
    "LTBCARD",
    "ZAIFCARD",
    "XAJIBASILAAR",
    "XAJIJASPAAR",
    "BAZAARCARD",
    "XAJIARKETAAR",
    "GOXCARD",
    "XAJIYEREMAAR",
    "MINERCARD",
    "XAJIBESAAR",
    "CARDAUGUR",
    "BTCDRAGONCD",
    "BCYDRAGON",
    "CARDASTEMA",
    "XAJIBOSS",
    "CARDAIRBITZ",
    "TALISMANCARD",
    "DOGECOINCARD",
    "SAPPHIRECARD",
    "SGDARKNESS",
    "RUBYCARD",
    "BLOCKTRAILCD",
    "WAGATECARD",
    "EMERALDCARD",
    "CARDAMBER",
    "WHEREBCYCARD",
    "GOBLINCARD",
    "SATOSHILITE",
    "SAYOSIATAX",
    "DARYENCARD",
    "LTCDRAGON",
    "SARUTOBICARD",
    "SHIELDWALLCD",
    "MERCHANTCARD",
    "COINOFLITECD",
    "MAIDSAFECD",
    "SHOPKEEPERCD",
    "FOOTSOLDIER"
];

var numSOGAssets = SOGAssetArray.length;

function getSOGImage(name){

    return "https://sogparty.com/pages/SOGImages/" + name.toString() + ".jpg";
}
function getSOGSupply(base, supply){

    if (base == "SATOSHICARD"){
        return "199**";}
    else if (base == "GENESISCARD") {
        return "557**";}
    else if (base == "RIPPLECARD") {
        return "500**";}
    else
        return supply;

}
function getSOGOrder(base){

    for(var i=0; i < numSOGAssets; i++){
        if (base == SOGAssetArray[i]){
            var j = i % 10,
                k = i % 100;
            if (j == 1 && k != 11) {
                return i + "st";
            }
            if (j == 2 && k != 12) {
                return i + "nd";
            }
            if (j == 3 && k != 13) {
                return i + "rd";
            }
            return i + "th";

        }

    }

}