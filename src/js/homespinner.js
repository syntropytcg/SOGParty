/**
 * Created by x-ethereal-x on 2/4/16.
 */


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
}
var target = document.getElementById('HomeAssetPairMarketInfo');
var spinner = new Spinner(opts).spin(target);



