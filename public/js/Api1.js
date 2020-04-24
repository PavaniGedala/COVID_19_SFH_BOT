// The Api module is designed to handle all interactions with the server

var Api = (function() {
    var messageEndpoint = '/api/message';
    var sessionEndpoint = '/api/session';
    var sessionId = null;
  
    // Publicly accessible methods defined
    return {
      sendRequest: sendRequest,
      getSessionId: getSessionId
    };
  
    function getResponse(responses, gen) {
        var title = '', description = '';
        if (gen.hasOwnProperty('title')) {
          title = gen.title;
        }
        if (gen.hasOwnProperty('description')) {
          description = '<div>' + gen.description + '</div>';
        }
        if (gen.response_type === 'image') {
          var img = '<div><img src="' + gen.source + '" width="300"></div>';
          responses.push({
            type: gen.response_type,
            innerhtml: title + description + img
          });
        } else if (gen.response_type === 'text') {
          responses.push({
            type: gen.response_type,
            innerhtml: gen.text
          });
        } else if (gen.response_type === 'pause') {
          responses.push({
            type: gen.response_type,
            time: gen.time,
            typing: gen.typing
          });
        } else if (gen.response_type === 'option') {
          var preference = 'text';
          if (gen.hasOwnProperty('preference')) {
            preference = gen.preference;
          }
    
          var list = getOptions(gen.options, preference);
          responses.push({
            type: gen.response_type,
            innerhtml: title + description + list
          });
        }
      }
    // Constructs new DOM element from a message
    function getDivObject(res, isUser, isTop) {
        var classes = [(isUser ? 'from-user' : 'from-watson'), 'latest', (isTop ? 'top' : 'sub')];
        var messageJson = {
          // <div class='segments'>
          'tagName': 'div',
          'classNames': ['segments'],
          'children': [{
            // <div class='from-user/from-watson latest'>
            'tagName': 'div',
            'classNames': classes,
            'children': [{
              // <div class='message-inner'>
              'tagName': 'div',
              'classNames': ['message-inner'],
              'children': [{
                // <p>{messageText}</p>
                'tagName': 'p',
                'text': res.innerhtml
              }]
            }]
          }]
        };
        return Common.buildDomElement(messageJson);
      }
        // Constructs new generic elements from a message payload
    function buildMessageDomElements(newPayload) {
        var textArray = isUser ? newPayload.input.text : newPayload.output.text;
        if (Object.prototype.toString.call(textArray) !== '[object Array]') {
          textArray = [textArray];
        }
      var responses = [];
  
      if (newPayload.hasOwnProperty('output')) {
        if (newPayload.output.hasOwnProperty('generic')) {
  
          var generic = newPayload.output.generic;
  
          generic.forEach(function (gen) {
            getResponse(responses, gen);
          });
        }
      } else if (newPayload.hasOwnProperty('input')) {
        var input = '';
        textArray.forEach(function (msg) {
          input += msg + ' ';
        });
        input = input.trim()
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
  
        if (input.length !== 0) {
          responses.push({
            type: 'text',
            innerhtml: input
          });
        }
      }
      return responses;
    }

    function displayMessage(newPayload, typeValue) {
        var isUser = isUserMessage(typeValue);
        //var textExists = newPayload.generic;
        if ((newPayload.output && newPayload.output.generic) ||  newPayload.input){
          // Create new message generic elements
          var responses = buildMessageDomElements(newPayload, isUser);
          var chatBoxElement = document.querySelector(".chat");
          var previousLatest = chatBoxElement.querySelectorAll((isUser ? settings.selectors.fromUser : settings.selectors.fromWatson) +
            settings.selectors.latest);
          // Previous "latest" message is no longer the most recent
          if (previousLatest) {
            Common.listForEach(previousLatest, function (element) {
              element.classList.remove('latest');
            });
          }
          setResponse(responses, isUser, chatBoxElement, 0, true);
        }
      }
    function getSessionId(callback) {
      var http = new XMLHttpRequest();
      http.open('GET', sessionEndpoint, true);
      http.setRequestHeader('Content-type', 'application/json');
      http.onreadystatechange = function () {
        if (http.readyState === XMLHttpRequest.DONE) {
          let res = JSON.parse(http.response);
          sessionId = res.result.session_id;
          callback();
        }
      };
      http.send();
    }
  
    function sendRequest(text, lang) {
      var payloadToWatson = {
        session_id: sessionId,
        languagePreference: lang
      };
  
      payloadToWatson.input = {
        message_type: 'text',
        text: text
      };

      var http = new XMLHttpRequest();
      http.open('POST', messageEndpoint, true);
      http.setRequestHeader('Content-type', 'application/json');
      http.onreadystatechange = function() {
        if (http.readyState === XMLHttpRequest.DONE && http.status === 200 && http.responseText) {
            // $('.chat').append('<div class="bubble you">' + "http.responseTextqq" + '</div>');
            displayMessage(http.responseText.result, ".from-watson");
        } else if (http.readyState === XMLHttpRequest.DONE && http.status !== 200) {
            
            $('.chat').append('<div class="bubble you">' + "http.responseTextqq1" + '</div>');
          return ({
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
      http.send(params);
    }
  }());
  