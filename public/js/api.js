// The Api module is designed to handle all interactions with the server

var Api = (function() {
  var requestPayload;
  var responsePayload;
  var messageEndpoint = '/api/message';

  var sessionEndpoint = '/api/session';
//sessionId
  var sessionIds = {};
  var bot = "";

  // Publicly accessible methods defined
  return {
    sendRequest: sendRequest,
    getSessionId: getSessionId,
    getCasesCount: getCasesCount,
    updateBot: updateBot,

    // The request/response getters/setters are defined here to prevent internal methods
    // from calling the methods without any of the callbacks that are added elsewhere.
    getRequestPayload: function() {
      return requestPayload;
    },
    setRequestPayload: function(newPayloadStr) {
      requestPayload = JSON.parse(newPayloadStr);
    },
    getResponsePayload: function() {
      return responsePayload;
    },
    setResponsePayload: function(newPayloadStr) {
      responsePayload = JSON.parse(newPayloadStr).result;
    },
    setErrorPayload: function() {
    }
  };

  function updateBot(botName){
    bot = botName;
  }

  function getSessionId(callback) {
    var http = new XMLHttpRequest();
    http.open('GET', sessionEndpoint+"?bot="+bot, true);
    http.setRequestHeader('Content-type', 'application/json');
    http.onreadystatechange = function () {
      if (http.readyState === XMLHttpRequest.DONE) {
        let res = JSON.parse(http.response);
        //bot = botName;
        sessionIds[bot] = res.result.session_id;
        callback();
      }else{
        console.log("someting went wrong")
      }
    };
    http.send();
  }
  function addCommas(nStr){
    nStr += '';
    var x = nStr.split('.');
    var x1 = x[0];
    var x2 = x.length > 1 ? '.' + x[1] : '';
    var rgx = /(\d+)(\d{3})/;
    while (rgx.test(x1)) {
     x1 = x1.replace(rgx, '$1' + ',' + '$2');
    }
    return x1 + x2;
   }

  function getCasesCount() {
    var http = new XMLHttpRequest();
    http.open('GET', "https://corona.lmao.ninja/v2/all", true);
    http.setRequestHeader('Content-type', 'application/json');
    http.onreadystatechange = function () {
      if (http.readyState === XMLHttpRequest.DONE) {
        let res = JSON.parse(http.response);
        console.log(res);
        var title = document.getElementsByClassName("title");
        title[0].innerHTML = "Active Cases : "+addCommas(res.active);
        title[1].innerHTML = "Recovered : "+addCommas(res.recovered);
        title[2].innerHTML = "Deaths : "+addCommas(res.deaths);
      }
    };
    http.send();
  }

  // Send a message request to the server
  function sendRequest(text, lang) {
    // Build request payload
    var payloadToWatson = {
      session_id: sessionIds[bot],
      languagePreference: lang,
      bot: bot
    };

    payloadToWatson.input = {
      message_type: 'text',
      text: text
    };

    // Built http request
    var http = new XMLHttpRequest();
    http.open('POST', messageEndpoint, true);
    http.setRequestHeader('Content-type', 'application/json');
    http.onreadystatechange = function() {
      if (http.readyState === XMLHttpRequest.DONE && http.status === 200 && http.responseText) {
        ConversationPanel.updateLastUpdatedBotTime(bot);
        Api.setResponsePayload(http.responseText);
      } else if (http.readyState === XMLHttpRequest.DONE && http.status !== 200) {
        Api.setErrorPayload({
          'output': {
            'generic': [
              {
                'response_type': 'text',
                'text': 'I\'m having trouble connecting to the server, please refresh the page'
              }
            ],
          }
        });
      }
    };

    var params = JSON.stringify(payloadToWatson);
    // Stored in variable (publicly visible through Api.getRequestPayload)
    // to be used throughout the application
    if (Object.getOwnPropertyNames(payloadToWatson).length !== 0) {
      Api.setRequestPayload(params);
    }

    // Send request
    http.send(params);
  }
}());
