
'use strict';

var express = require('express'); // app server
var bodyParser = require('body-parser'); // parser for post requests
var AssistantV2 = require('ibm-watson/assistant/v2'); // watson sdk
const LanguageTranslatorV3 = require('ibm-watson/language-translator/v3');
const { IamAuthenticator, BearerTokenAuthenticator } = require('ibm-watson/auth');
const async = require("async");
var app = express();
var path = require('path');

// Bootstrap application settings
app.use(express.static('./public')); // load UI from public folder
app.use(bodyParser.json());

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});
app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname + '/public/chatui.html'));
});
// Create the service wrapper

let authenticator;
if (process.env.ASSISTANT_IAM_APIKEY) {
  authenticator = new IamAuthenticator({
    apikey: process.env.ASSISTANT_IAM_APIKEY
  });
} else if (process.env.BEARER_TOKEN) {
  authenticator = new BearerTokenAuthenticator({
    bearerToken: process.env.BEARER_TOKEN
  });
}

var assistant = new AssistantV2({
  version: '2019-02-28',
  authenticator: authenticator,
  url: process.env.ASSISTANT_URL,
  disableSslVerification: process.env.DISABLE_SSL_VERIFICATION === 'true' ? true : false
});

var targetLanguage = '';
const languageTranslator = new LanguageTranslatorV3({
  authenticator: new IamAuthenticator({ apikey: process.env.LANGUAGE_TRANSLATOR_APIKEY }),
  url: process.env.LANGUAGE_TRANSLATOR_URL,
  version: '2020-04-21',
});

function tester56(text, target) {
  return new Promise(function (resolve, reject) {
    languageTranslator.translate(
      {
        text: text,
        source: 'en',
        target: target
      }).then(function (results) {
        resolve(results.result.translations);
      })
      .catch(function (error) {
        reject(error);
      })
  })
}


// Endpoint to be call from the client side
app.post('/api/message', function (req, res) {
  let assistantId;
  if (req.body.bot) {
    assistantId = process.env[req.body.bot] || '<assistant-id>';
  }

  if (!assistantId || assistantId === '<assistant-id>') {
    return res.json({
      output: {
        text:
          'The app has not been configured with a <b>ASSISTANT_ID</b> environment variable. Please refer to the ' +
          '<a href="https://github.com/watson-developer-cloud/assistant-simple">README</a> documentation on how to set this variable. <br>' +
          'Once a workspace has been defined the intents may be imported from ' +
          '<a href="https://github.com/watson-developer-cloud/assistant-simple/blob/master/training/car_workspace.json">here</a> in order to get a working application.',
      },
    });
  }

  var textIn = '';
  if (req.body.input) {
    textIn = req.body.input.text;
  }

  if (req.body && req.body.languagePreference) {
    targetLanguage = req.body.languagePreference;
  }
  var payload = {
    assistantId: assistantId,
    sessionId: req.body.session_id,
    input: {
      message_type: 'text',
      text: textIn,
      options: {
        'return_context': true
      }
    }
  };

  // Send the input to the assistant service
  assistant.message(payload, function (err, data) {
    if (err) {
      const status = err.code !== undefined && err.code > 0 ? err.code : 500;
      return res.status(status).json(err);
    }
    //console.log(data.result.context.skills['main skill'].user_defined);//.skills['main skill'].user_defined
    // if (data.result.output.intents.length > 0) intent = data.result.output.intents[0].intent;
    // if (data.result.output.entities.length > 0) entity = data.result.output.entities[0].entity;
    // if (data.result.context.skills['main skill'].user_defined) contextVariable = data.result.context.skills['main skill'].user_defined;

    if (targetLanguage != "en") {
      var generic = data.result.output.generic;
      async.parallel({
        text: function (callback) {
          var textCount = 0;
          var nonTextCount = 0;
          generic.forEach(function (gen, index) {
            if (gen.hasOwnProperty('text')) {
              tester56(gen.text, targetLanguage).then(function (result) {
                data.result.output.generic[index].text = result[0].translation;
                textCount++;
                if ((nonTextCount + textCount) == generic.length) {
                  callback(null, "success");
                }
              })
            }
            else {
              nonTextCount++;
              if ((nonTextCount + textCount) == generic.length) {
                callback(null, "success");
              }
            }
          })
        },
        title: function (callback) {
          var titleCount = 0;
          var nonTitleCount = 0;
          generic.forEach(function (gen, index) {
            if (gen.hasOwnProperty('title')) {
              tester56(gen.title, targetLanguage).then(function (response) {
                data.result.output.generic[index].title = response[0].translation;
                titleCount++;
                if ((titleCount + nonTitleCount) == generic.length) {
                  callback(null, "success");
                }
              });
            }
            else {
              nonTitleCount++;
              if ((titleCount + nonTitleCount) == generic.length) {
                callback(null, "success");
              }
            }
          })
        },
        options: function (callback) {
          var labels = [];
          var optionsCount = 0;
          var nonOptionsCount = 0;
          generic.forEach(function (gen, index) {
            if (gen.hasOwnProperty('options')) {
              gen.options.map(function (obj, i) {
                labels[i] = obj.label;
                if (labels.length == gen.options.length) {
                  tester56(labels, targetLanguage).then(function (response) {
                    response.forEach(function (obj, j) {
                      data.result.output.generic[index].options[j].label = obj.translation;
                      if (j == (response.length - 1)) {
                        optionsCount++;
                        if ((optionsCount + nonOptionsCount) == generic.length) {
                          callback(null, "success");
                        }
                      }
                    })

                  })
                }
              })

            }
            else {
              nonOptionsCount++;
              if ((optionsCount + nonOptionsCount) == generic.length) {
                callback(null, "success");
              }
            }
          })
        }
      }, function (err, result) {
        return res.json(data);
      })
    }
    else {
      console.log(JSON.stringify(err));
      console.log(JSON.stringify(data));
      res.json(data);
    }
  });
});
app.get('/api/session', function (req, res) {
  let assistantId;
  if (req.query.bot) {
    console.log(req.query.bot)
    assistantId = process.env[req.query.bot];
  }

  assistant.createSession(
    {
      assistantId: assistantId || '{assistant_id}',
    },
    function (error, response) {
      if (error) {
        console.log(error);
        return res.send(error);
      } else {
        console.log(response)
        return res.send(response);
      }
    }
  );
});

module.exports = app;
