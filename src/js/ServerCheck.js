/**
 * Created by X-ETHeREAL-X on 1/24/16.
 */


function checkAPI(){
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
        if (xhttp.readyState == 4) {
            if (xhttp.status != 200) {
                console.log("good");
                window.location.href = "https://sogparty.com/error.html";
            }
        }
    }

    xhttp.open('GET', 'https://sogparty.com/_api', true);
    xhttp.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    xhttp.send(null);
};

checkAPI();